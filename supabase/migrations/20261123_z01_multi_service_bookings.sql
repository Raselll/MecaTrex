-- MECATREX: atomic multi-service garage reservations.
-- Depends on 20261107_booking_calendar_reviews.sql and 20261123_towing_requests_and_dispatch.sql.
-- Existing single-service bookings remain readable; new bookings snapshot every selected item.

create table if not exists public.garage_booking_items (
  booking_id uuid not null references public.garage_bookings(id) on delete cascade,
  service_id uuid not null references public.provider_services(id) on delete restrict,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  position integer not null check (position > 0),
  primary key (booking_id, service_id),
  unique (booking_id, position)
);
alter table public.garage_booking_items enable row level security;
revoke all on public.garage_booking_items from public, anon, authenticated;
grant select on public.garage_booking_items to authenticated;
drop policy if exists "Booking participants read booked items" on public.garage_booking_items;
create policy "Booking participants read booked items"
on public.garage_booking_items for select to authenticated using (
  exists (
    select 1 from public.garage_bookings b
    join public.service_providers sp on sp.id = b.provider_id
    where b.id = booking_id
      and (b.client_id = (select auth.uid()) or sp.owner_id = (select auth.uid()) or private.is_admin())
  )
);

create or replace function public.garage_available_slots_multi(
  p_provider_id uuid, p_service_ids uuid[], p_day date
)
returns table(slot_time text, starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_count integer;
  v_unique integer;
  v_duration integer;
begin
  if p_service_ids is null or cardinality(p_service_ids) not between 1 and 50 then return; end if;
  if p_day is null or p_day < (now() at time zone 'America/Toronto')::date
    or p_day > ((now() at time zone 'America/Toronto')::date + interval '6 months')::date then
    return;
  end if;
  if not exists (
    select 1 from public.service_providers sp
    where sp.id = p_provider_id and sp.provider_type::text = 'garage'
      and sp.status::text = 'approved' and sp.is_listing_active
      and not sp.booking_suspended and not sp.is_removed
  ) then return; end if;

  select count(*)::integer, count(distinct s.id)::integer, sum(s.duration_minutes)::integer
    into v_count, v_unique, v_duration
  from unnest(p_service_ids) as requested(id)
  join public.provider_services s on s.id = requested.id
    and s.provider_id = p_provider_id and s.is_active
    and s.pricing_type = 'fixed' and s.price_cents is not null
    and s.duration_minutes > 0;
  if v_count <> cardinality(p_service_ids) or v_unique <> v_count or v_duration is null then return; end if;

  return query
  with candidates as (
    select to_char(p_day::timestamp + make_interval(mins => x.i * 30), 'HH24:MI') as label,
      ((p_day::timestamp + make_interval(mins => x.i * 30)) at time zone 'America/Toronto') as t
    from generate_series(0, 47) as x(i)
  )
  select c.label, c.t, c.t + make_interval(mins => v_duration)
  from candidates c
  where c.t > now()
    and (c.t at time zone 'America/Toronto')::date = p_day
    and to_char(c.t at time zone 'America/Toronto', 'HH24:MI') = c.label
    and private.garage_interval_within_hours(p_provider_id,c.t,c.t + make_interval(mins => v_duration))
    and not exists (
      select 1 from public.garage_bookings b
      where b.provider_id = p_provider_id and b.status = 'confirmed'
        and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(c.t,c.t + make_interval(mins => v_duration),'[)')
    )
    and not exists (
      select 1 from public.garage_calendar_blocks bl
      where bl.provider_id = p_provider_id
        and tstzrange(bl.starts_at,bl.ends_at,'[)') && tstzrange(c.t,c.t + make_interval(mins => v_duration),'[)')
    )
  order by c.t;
end;
$$;
revoke all on function public.garage_available_slots_multi(uuid,uuid[],date) from public, anon, authenticated;
grant execute on function public.garage_available_slots_multi(uuid,uuid[],date) to anon, authenticated;

create or replace function public.book_garage_services(
  p_provider_id uuid,
  p_service_ids uuid[],
  p_day date,
  p_time text,
  p_note text default '',
  p_vehicle text default '',
  p_wants_towing boolean default false,
  p_pickup_address text default '',
  p_towing_note text default ''
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_booking_id uuid;
  v_count integer;
  v_unique integer;
  v_duration bigint;
  v_price bigint;
  v_names text;
  v_first_name text;
  v_valid boolean;
  v_provider public.service_providers%rowtype;
begin
  if auth.uid() is null then raise exception 'Please sign in as a client.'; end if;
  if p_service_ids is null or cardinality(p_service_ids) not between 1 and 50 then
    raise exception 'Choose between one and fifty services.';
  end if;
  if length(coalesce(p_note,'')) > 500 or length(coalesce(p_vehicle,'')) > 120 then
    raise exception 'The appointment note or vehicle description is too long.';
  end if;
  if p_time !~ '^([01][0-9]|2[0-3]):(00|30)$' then
    raise exception 'Choose a 30-minute start time.';
  end if;

  -- Lock the provider before checking combined availability, matching the existing booking RPC.
  select * into v_provider from public.service_providers
  where id = p_provider_id for update;
  if not found or v_provider.provider_type::text <> 'garage'
    or v_provider.status::text <> 'approved' or not v_provider.is_listing_active
    or v_provider.booking_suspended or v_provider.is_removed then
    raise exception 'This garage is not accepting bookings.';
  end if;

  select count(*)::integer, count(distinct s.id)::integer,
    sum(s.duration_minutes)::bigint, sum(s.price_cents)::bigint,
    string_agg(s.name, ', ' order by request.position),
    (array_agg(s.name order by request.position))[1]
  into v_count, v_unique, v_duration, v_price, v_names, v_first_name
  from unnest(p_service_ids) with ordinality as request(service_id,position)
  join public.provider_services s on s.id = request.service_id
    and s.provider_id = p_provider_id and s.is_active
    and s.pricing_type = 'fixed' and s.price_cents is not null
    and s.duration_minutes > 0;

  if v_count <> cardinality(p_service_ids) or v_unique <> v_count or v_count < 1
    or v_duration is null or v_duration > 2147483647
    or v_price is null or v_price > 2147483647 then
    raise exception 'One or more selected services are invalid, duplicated or unavailable.';
  end if;

  select exists(
    select 1 from public.garage_available_slots_multi(p_provider_id,p_service_ids,p_day)
    where slot_time = p_time
  ) into v_valid;
  if not v_valid then raise exception 'The combined services do not fit in this time slot. Select another time.'; end if;

  if p_wants_towing then
    v_booking_id := public.book_garage_service_with_towing(
      p_provider_id,p_service_ids[1],p_day,p_time,p_note,p_vehicle,
      true,p_pickup_address,p_towing_note
    );
  else
    v_booking_id := public.book_garage_service(
      p_provider_id,p_service_ids[1],p_day,p_time,p_note,p_vehicle
    );
  end if;

  update public.garage_bookings
  set service_name = v_names,
      duration_minutes = v_duration::integer,
      price_cents = v_price::integer,
      ends_at = starts_at + make_interval(mins => v_duration::integer)
  where id = v_booking_id and client_id = auth.uid();
  if not found then raise exception 'Unable to finalize the selected services.'; end if;

  insert into public.garage_booking_items(booking_id,service_id,name,price_cents,duration_minutes,position)
  select v_booking_id,s.id,s.name,s.price_cents,s.duration_minutes,request.position::integer
  from unnest(p_service_ids) with ordinality as request(service_id,position)
  join public.provider_services s on s.id = request.service_id
  order by request.position;

  -- Keep existing booking notification text aligned with the full service list.
  update public.booking_notifications
  set body = replace(body, v_first_name, v_names)
  where booking_id = v_booking_id and title in (
    'New confirmed booking','Booking confirmed','Client requested towing'
  ) and v_first_name <> v_names;

  return v_booking_id;
end;
$$;
revoke all on function public.book_garage_services(uuid,uuid[],date,text,text,text,boolean,text,text) from public,anon,authenticated;
grant execute on function public.book_garage_services(uuid,uuid[],date,text,text,text,boolean,text,text) to authenticated;
