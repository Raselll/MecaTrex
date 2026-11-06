-- MECATREX phase 1: garage scheduling, booking, cancellations, reviews and notifications.
-- Apply after 20261106_fixed_price_services_only.sql, once only.
-- Timezone: America/Toronto. No payments. No towing reservations yet.

alter table public.profiles add column if not exists accent_color text not null default 'blue';
alter table public.profiles drop constraint if exists profiles_accent_color_valid;
alter table public.profiles add constraint profiles_accent_color_valid
  check (accent_color in ('blue','teal','violet','slate'));
grant update (accent_color) on public.profiles to authenticated;

alter table public.service_providers
  add column if not exists provider_cancellation_count integer not null default 0,
  add column if not exists booking_suspended boolean not null default false;
alter table public.service_providers drop constraint if exists provider_cancel_count_valid;
alter table public.service_providers add constraint provider_cancel_count_valid
  check (provider_cancellation_count between 0 and 3);

create table if not exists public.garage_business_hours (
  provider_id uuid not null references public.service_providers(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  is_open boolean not null default false,
  open_time time not null default '09:00',
  close_time time not null default '17:00',
  primary key (provider_id, weekday),
  constraint business_hours_no_equal_times check (not is_open or open_time <> close_time)
);

-- No garage is shown as open until the owner has confirmed actual hours.
insert into public.garage_business_hours (provider_id, weekday, is_open)
select sp.id, d.day, false
from public.service_providers sp cross join generate_series(0,6) as d(day)
where sp.provider_type = 'garage'::public.mecatrex_provider_type
on conflict (provider_id,weekday) do nothing;

create or replace function private.initialize_garage_business_hours()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.provider_type = 'garage'::public.mecatrex_provider_type then
    insert into public.garage_business_hours(provider_id,weekday,is_open)
    select new.id,d.day,false from generate_series(0,6) as d(day)
    on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.initialize_garage_business_hours() from public;
drop trigger if exists initialize_garage_business_hours on public.service_providers;
create trigger initialize_garage_business_hours after insert on public.service_providers
for each row execute function private.initialize_garage_business_hours();

create table if not exists public.garage_calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.service_providers(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  kind text not null check (kind in ('unavailable','walk_in')),
  label text not null default '',
  created_at timestamptz not null default now(),
  constraint garage_block_time_valid check (ends_at > starts_at)
);
create index if not exists garage_blocks_range_idx on public.garage_calendar_blocks
  (provider_id, starts_at, ends_at);

create table if not exists public.garage_bookings (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.service_providers(id) on delete restrict,
  service_id uuid not null references public.provider_services(id) on delete restrict,
  client_id uuid not null references public.profiles(id) on delete restrict,
  service_name text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  price_cents integer not null check (price_cents >= 0),
  garage_name text not null,
  garage_address text not null,
  garage_phone text,
  garage_email text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed'
    check (status in ('confirmed','client_cancelled','provider_cancelled')),
  note text not null default '',
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint garage_booking_time_valid check (ends_at > starts_at)
);
create index if not exists garage_bookings_provider_time_idx
  on public.garage_bookings(provider_id,starts_at);
create index if not exists garage_bookings_client_time_idx
  on public.garage_bookings(client_id,starts_at);

-- Explicit GiST exclusion prevents overlapping CONFIRMED bookings,
-- even if an alternative SQL client attempts concurrent inserts.
create extension if not exists btree_gist;
do $$
begin
  if not exists (select 1 from pg_constraint
    where conname = 'garage_confirmed_bookings_no_overlap'
      and conrelid = 'public.garage_bookings'::regclass) then
    alter table public.garage_bookings
      add constraint garage_confirmed_bookings_no_overlap
      exclude using gist (provider_id with =, tstzrange(starts_at,ends_at,'[)') with &&)
      where (status = 'confirmed');
  end if;
end;
$$;

create table if not exists public.booking_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.garage_bookings(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists booking_notifications_recipient_idx
  on public.booking_notifications(recipient_id, created_at desc);

create table if not exists public.garage_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.garage_bookings(id) on delete cascade,
  provider_id uuid not null references public.service_providers(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  stars integer not null check (stars between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists garage_reviews_provider_idx on public.garage_reviews(provider_id,created_at desc);

-- Existing provider edit permissions must not override booking suspension.
create or replace function private.guard_booking_suspension()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.booking_suspended and new.is_listing_active then
    raise exception 'Garage booking suspended after three provider cancellations.';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_booking_suspension() from public;
drop trigger if exists guard_booking_suspension on public.service_providers;
create trigger guard_booking_suspension before update on public.service_providers
for each row execute function private.guard_booking_suspension();

alter table public.garage_business_hours enable row level security;
alter table public.garage_calendar_blocks enable row level security;
alter table public.garage_bookings enable row level security;
alter table public.booking_notifications enable row level security;
alter table public.garage_reviews enable row level security;

revoke all on public.garage_business_hours, public.garage_calendar_blocks,
  public.garage_bookings, public.booking_notifications, public.garage_reviews
from anon, authenticated;

-- Public business hours for approved published garages.
create policy "Public or owner reads garage hours" on public.garage_business_hours
for select to anon, authenticated using (
  exists (
    select 1 from public.service_providers sp
    where sp.id = provider_id and (
      (sp.status = 'approved'::public.mecatrex_provider_status and sp.is_listing_active = true)
      or sp.owner_id = (select auth.uid())
    )
  )
);
create policy "Admin reads all garage hours" on public.garage_business_hours
for select to authenticated using (private.is_admin());
grant select on public.garage_business_hours to anon, authenticated;

create policy "Owner reads garage blocks" on public.garage_calendar_blocks
for select to authenticated using (
  exists(select 1 from public.service_providers sp
         where sp.id=provider_id and (sp.owner_id=(select auth.uid()) or private.is_admin()))
);
grant select on public.garage_calendar_blocks to authenticated;

create policy "Client and owner read bookings" on public.garage_bookings
for select to authenticated using (
  client_id = (select auth.uid()) or
  exists(select 1 from public.service_providers sp where sp.id=provider_id
    and (sp.owner_id=(select auth.uid()) or private.is_admin()))
);
grant select on public.garage_bookings to authenticated;

create policy "Recipient reads own booking notifications" on public.booking_notifications
for select to authenticated using (recipient_id = (select auth.uid()));
create policy "Recipient marks own notifications read" on public.booking_notifications
for update to authenticated
using (recipient_id=(select auth.uid()))
with check (recipient_id=(select auth.uid()));
grant select on public.booking_notifications to authenticated;
grant update (read_at) on public.booking_notifications to authenticated;

create policy "Public reads garage reviews" on public.garage_reviews
for select to anon, authenticated using (
  exists(select 1 from public.service_providers sp where sp.id=provider_id
    and sp.status='approved'::public.mecatrex_provider_status and sp.is_listing_active)
  or client_id=(select auth.uid())
  or exists(select 1 from public.service_providers sp where sp.id=provider_id
    and sp.owner_id=(select auth.uid()))
);
create policy "Admin reads garage reviews" on public.garage_reviews
for select to authenticated using (private.is_admin());
grant select on public.garage_reviews to anon, authenticated;

-- Return true if entire interval fits opening hours, including overnight shifts.
-- Store opening hours as Montreal LOCAL wall time; bookings are stored as timestamptz.
create or replace function private.garage_interval_within_hours(
  p_provider uuid, p_start timestamptz, p_end timestamptz
) returns boolean language sql stable set search_path = '' as $$
  with dates as (
    select (p_start at time zone 'America/Toronto') as local_start,
           (p_end at time zone 'America/Toronto') as local_end
  ),
  windows as (
    select h.weekday,h.is_open,
      ((d.local_start::date + shifts.offset_days) + h.open_time) as opens,
      ((d.local_start::date + shifts.offset_days) + h.close_time +
        case when h.close_time <= h.open_time then interval '1 day' else interval '0 day' end) as closes,
      extract(dow from (d.local_start::date + shifts.offset_days))::integer as this_weekday,
      d.local_start, d.local_end
    from public.garage_business_hours h cross join dates d
    cross join (values (0),(-1)) as shifts(offset_days)
    where h.provider_id = p_provider
  )
  select exists(select 1 from windows w
    where w.is_open and w.weekday = w.this_weekday
      and w.local_start >= w.opens and w.local_end <= w.closes
  );
$$;

-- Query 48 half-hour starts for an approved, published garage; returns no personal data.
create or replace function public.garage_available_slots(
  p_provider_id uuid, p_service_id uuid, p_day date
) returns table(slot_time text, starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_duration integer;
begin
  if p_day is null or p_day < (now() at time zone 'America/Toronto')::date
    or p_day > ((now() at time zone 'America/Toronto')::date + interval '6 months')::date then
    return;
  end if;
  if not exists (
    select 1 from public.service_providers sp
    where sp.id=p_provider_id and sp.provider_type='garage'::public.mecatrex_provider_type
      and sp.status='approved'::public.mecatrex_provider_status
      and sp.is_listing_active and not sp.booking_suspended
  ) then return; end if;
  select duration_minutes into v_duration
  from public.provider_services
  where id=p_service_id and provider_id=p_provider_id and is_active
    and pricing_type='fixed' and price_cents is not null and duration_minutes > 0;
  if v_duration is null then return; end if;

  return query
  with candidates as (
    select to_char(p_day::timestamp + make_interval(mins=>s.i*30),'HH24:MI') as slot_label,
      ((p_day::timestamp + make_interval(mins=>s.i*30)) at time zone 'America/Toronto') as slot_start
    from generate_series(0,47) as s(i)
  )
  select c.slot_label,c.slot_start,c.slot_start + make_interval(mins=>v_duration)
  from candidates c
  where c.slot_start > now()
    -- Skip non-existent wall times on daylight-saving spring forward.
    and (c.slot_start at time zone 'America/Toronto')::date = p_day
    and to_char(c.slot_start at time zone 'America/Toronto','HH24:MI')=c.slot_label
    and private.garage_interval_within_hours(
      p_provider_id,c.slot_start,c.slot_start + make_interval(mins=>v_duration))
    and not exists (
      select 1 from public.garage_bookings b where b.provider_id=p_provider_id
        and b.status='confirmed'
        and tstzrange(b.starts_at,b.ends_at,'[)') &&
            tstzrange(c.slot_start,c.slot_start + make_interval(mins=>v_duration),'[)')
    )
    and not exists (
      select 1 from public.garage_calendar_blocks bl where bl.provider_id=p_provider_id
        and tstzrange(bl.starts_at,bl.ends_at,'[)') &&
            tstzrange(c.slot_start,c.slot_start + make_interval(mins=>v_duration),'[)')
    )
  order by c.slot_start;
end;
$$;
revoke all on function public.garage_available_slots(uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.garage_available_slots(uuid,uuid,date) to anon,authenticated;

-- Booking creation runs atomically under a provider row lock.
create or replace function public.book_garage_service(
  p_provider_id uuid,p_service_id uuid,p_day date,p_time text,p_note text default ''
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_provider public.service_providers%rowtype;
  v_service public.provider_services%rowtype;
  v_slot record;
  v_booking_id uuid;
  v_name text;
begin
  if v_user is null or not exists(
    select 1 from public.profiles where id=v_user and account_type='client'::public.mecatrex_account_type
  ) then raise exception 'Please log in with a client account to book.'; end if;
  if p_note is not null and length(p_note)>500 then raise exception 'Note is too long.'; end if;

  select * into v_provider from public.service_providers
  where id=p_provider_id for update;
  if not found or v_provider.provider_type<>'garage'::public.mecatrex_provider_type
    or v_provider.status<>'approved'::public.mecatrex_provider_status
    or not v_provider.is_listing_active or v_provider.booking_suspended
    then raise exception 'This garage is not accepting online bookings.'; end if;

  select * into v_service from public.provider_services where id=p_service_id
    and provider_id=p_provider_id and is_active and pricing_type='fixed'
    and price_cents is not null and duration_minutes > 0;
  if not found then raise exception 'Selected service is not available.'; end if;

  if p_time !~ '^([01][0-9]|2[0-3]):(00|30)$' then
    raise exception 'Please choose a valid 30-minute time slot.';
  end if;

  select * into v_slot from public.garage_available_slots(p_provider_id,p_service_id,p_day)
  where slot_time=p_time limit 1;
  if not found then raise exception 'This time is no longer available. Please choose another.'; end if;

  select trim(first_name || ' ' || last_name) into v_name from public.profiles where id=v_user;
  insert into public.garage_bookings(
    provider_id,service_id,client_id,service_name,duration_minutes,price_cents,
    garage_name,garage_address,garage_phone,garage_email,starts_at,ends_at,note
  ) values (
    p_provider_id,p_service_id,v_user,v_service.name,v_service.duration_minutes,v_service.price_cents,
    v_provider.business_name,
    concat_ws(', ',v_provider.address_line1,v_provider.city,v_provider.province,v_provider.postal_code),
    v_provider.public_phone,v_provider.public_email,v_slot.starts_at,v_slot.ends_at,
    coalesce(p_note,'')
  ) returning id into v_booking_id;

  insert into public.booking_notifications(recipient_id,booking_id,title,body)
  values
    (v_provider.owner_id,v_booking_id,'New confirmed booking',
      v_name || ' booked ' || v_service.name || ' at ' ||
      to_char(v_slot.starts_at at time zone 'America/Toronto','Mon DD, YYYY HH12:MI AM') ||
      ' ('||v_service.duration_minutes||' minutes).'),
    (v_user,v_booking_id,'Booking confirmed',
      'Your '||v_service.name||' appointment at '||v_provider.business_name||
      ' is confirmed for '||
      to_char(v_slot.starts_at at time zone 'America/Toronto','Mon DD, YYYY HH12:MI AM')||'.');
  return v_booking_id;
end;
$$;
revoke all on function public.book_garage_service(uuid,uuid,date,text,text) from public,anon,authenticated;
grant execute on function public.book_garage_service(uuid,uuid,date,text,text) to authenticated;

create or replace function public.save_garage_business_hours(p_provider_id uuid,p_hours jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_provider public.service_providers%rowtype;
  item jsonb;
  v_day integer;
  v_open time;
  v_close time;
  v_enabled boolean;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;
  select * into v_provider from public.service_providers where id=p_provider_id for update;
  if not found or v_provider.owner_id<>auth.uid() or v_provider.provider_type<>'garage'::public.mecatrex_provider_type then
    raise exception 'Not allowed to change these opening hours.'; end if;
  if jsonb_typeof(p_hours)<>'array' or jsonb_array_length(p_hours)<>7 then
    raise exception 'Provide seven days of opening hours.'; end if;
  if (select count(distinct (entry->>'weekday')::integer)
      from jsonb_array_elements(p_hours) as entry) <> 7 then
    raise exception 'Please provide every weekday exactly once.'; end if;

  for item in select value from jsonb_array_elements(p_hours) loop
    v_day := (item->>'weekday')::integer;
    v_open := (item->>'open_time')::time;
    v_close := (item->>'close_time')::time;
    v_enabled := (item->>'is_open')::boolean;
    if v_day not between 0 and 6 or v_open is null or v_close is null or v_enabled is null
      or (v_enabled and v_open=v_close) then raise exception 'Invalid opening hours.'; end if;

    insert into public.garage_business_hours(provider_id,weekday,is_open,open_time,close_time)
    values(p_provider_id,v_day,v_enabled,v_open,v_close)
    on conflict(provider_id,weekday) do update
      set is_open=excluded.is_open,open_time=excluded.open_time,close_time=excluded.close_time;
  end loop;

  -- Existing confirmed bookings must still fit: owner must reschedule by
  -- contacting the client instead of silently moving a customer's appointment.
  if exists (
    select 1 from public.garage_bookings b
    where b.provider_id=p_provider_id and b.status='confirmed' and b.ends_at>now()
      and not private.garage_interval_within_hours(p_provider_id,b.starts_at,b.ends_at)
  ) then raise exception 'New hours conflict with a confirmed booking. Keep those hours or contact the customer before changing them.'; end if;
end;
$$;
revoke all on function public.save_garage_business_hours(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_garage_business_hours(uuid,jsonb) to authenticated;

create or replace function public.add_garage_calendar_block(
 p_provider_id uuid,p_day date,p_start_time time,p_end_time time,p_kind text,p_label text default ''
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_provider public.service_providers%rowtype;
  v_start timestamptz;
  v_end timestamptz;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;
  if p_kind not in ('unavailable','walk_in') or length(coalesce(p_label,''))>100
    then raise exception 'Invalid calendar block.'; end if;
  if p_day < (now() at time zone 'America/Toronto')::date
    or p_day > ((now() at time zone 'America/Toronto')::date+interval '6 months')::date
    or p_end_time <= p_start_time then
    raise exception 'Choose a valid same-day future interval within six months.'; end if;
  v_start := (p_day::timestamp+p_start_time) at time zone 'America/Toronto';
  v_end := (p_day::timestamp+p_end_time) at time zone 'America/Toronto';
  if v_start<=now() then raise exception 'Choose a future time.'; end if;
  select * into v_provider from public.service_providers
    where id=p_provider_id for update;
  if not found or v_provider.owner_id<>auth.uid() or v_provider.provider_type<>'garage'::public.mecatrex_provider_type
    then raise exception 'Only this garage owner can change its calendar.'; end if;
  if exists(select 1 from public.garage_bookings b where b.provider_id=p_provider_id
       and b.status='confirmed' and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(v_start,v_end,'[)'))
    then raise exception 'This interval overlaps a confirmed customer appointment.'; end if;
  if exists(select 1 from public.garage_calendar_blocks bl where bl.provider_id=p_provider_id
      and tstzrange(bl.starts_at,bl.ends_at,'[)')&&tstzrange(v_start,v_end,'[)'))
    then raise exception 'This interval is already blocked.'; end if;
  insert into public.garage_calendar_blocks(provider_id,starts_at,ends_at,kind,label)
  values(p_provider_id,v_start,v_end,p_kind,trim(coalesce(p_label,''))) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.add_garage_calendar_block(uuid,date,time,time,text,text) from public,anon,authenticated;
grant execute on function public.add_garage_calendar_block(uuid,date,time,time,text,text) to authenticated;

create or replace function public.remove_garage_calendar_block(p_block_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_provider_id uuid;
begin
  select provider_id into v_provider_id from public.garage_calendar_blocks where id=p_block_id;
  if v_provider_id is null then raise exception 'Calendar block not found.'; end if;
  perform 1 from public.service_providers where id=v_provider_id and owner_id=auth.uid() for update;
  if not found then raise exception 'Not allowed.'; end if;
  delete from public.garage_calendar_blocks where id=p_block_id;
end;
$$;
revoke all on function public.remove_garage_calendar_block(uuid) from public,anon,authenticated;
grant execute on function public.remove_garage_calendar_block(uuid) to authenticated;

create or replace function public.cancel_garage_booking(p_booking_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_booking public.garage_bookings%rowtype;
  v_provider public.service_providers%rowtype;
  v_is_owner boolean;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;
  select provider_id into v_booking.provider_id from public.garage_bookings where id=p_booking_id;
  if v_booking.provider_id is null then raise exception 'Booking not found.'; end if;

  -- Lock provider first: same lock order as booking and blocks.
  select * into v_provider from public.service_providers where id=v_booking.provider_id for update;
  select * into v_booking from public.garage_bookings where id=p_booking_id for update;
  if v_booking.status<>'confirmed' then raise exception 'Booking is already cancelled.'; end if;
  v_is_owner := v_provider.owner_id=auth.uid();
  if not v_is_owner and v_booking.client_id<>auth.uid() then raise exception 'Not your booking.'; end if;
  if v_booking.starts_at<=now() then raise exception 'Past and in-progress bookings cannot be cancelled online. Contact support.'; end if;

  if v_is_owner then
    if v_provider.booking_suspended or v_provider.provider_cancellation_count>=3
      then raise exception 'Provider cancellation limit reached. Contact MECATREX administration.'; end if;
    update public.garage_bookings set status='provider_cancelled',cancelled_at=now() where id=p_booking_id;
    update public.service_providers
    set provider_cancellation_count=least(provider_cancellation_count+1,3),
        booking_suspended=(provider_cancellation_count+1>=3),
        is_listing_active=case when provider_cancellation_count+1>=3 then false else is_listing_active end
    where id=v_provider.id returning provider_cancellation_count into v_count;
  else
    update public.garage_bookings set status='client_cancelled',cancelled_at=now() where id=p_booking_id;
    v_count := 3-v_provider.provider_cancellation_count;
  end if;

  insert into public.booking_notifications(recipient_id,booking_id,title,body)
  values
    (v_booking.client_id,p_booking_id,'Appointment cancelled',
      case when v_is_owner then 'The garage cancelled your appointment for '||v_booking.service_name||'. You can find another garage on MECATREX.'
        else 'You cancelled your '||v_booking.service_name||' appointment.' end),
    (v_provider.owner_id,p_booking_id,'Appointment cancelled',
      case when v_is_owner then 'You cancelled a confirmed appointment. '||(3-v_count)||' cancellation(s) remaining before suspension.'
        else 'A client cancelled their '||v_booking.service_name||' appointment.' end);
  return case when v_is_owner then 3-v_count else 3-v_provider.provider_cancellation_count end;
end;
$$;
revoke all on function public.cancel_garage_booking(uuid) from public,anon,authenticated;
grant execute on function public.cancel_garage_booking(uuid) to authenticated;

create or replace function public.submit_garage_review(
 p_booking_id uuid,p_stars integer,p_comment text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_booking public.garage_bookings%rowtype;v_id uuid;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;
  if p_stars not between 1 and 5 or length(trim(coalesce(p_comment,'')))>1000
    then raise exception 'Rating must be 1–5 stars and comments shorter than 1000 characters.'; end if;
  select * into v_booking from public.garage_bookings where id=p_booking_id;
  if not found or v_booking.client_id<>auth.uid() or v_booking.status<>'confirmed'
    or v_booking.ends_at>now() then
    raise exception 'You can review a garage only after your completed appointment.'; end if;
  insert into public.garage_reviews(booking_id,provider_id,client_id,stars,comment)
    values(p_booking_id,v_booking.provider_id,auth.uid(),p_stars,trim(coalesce(p_comment,'')))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_garage_review(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.submit_garage_review(uuid,integer,text) to authenticated;

-- Allow sending booking emails to real participants without exposing contacts
-- to arbitrary users. The returned emails are never directly shown in the UI.
create or replace function public.booking_email_recipients(p_booking_id uuid)
returns table(client_email text,client_name text,provider_email text,provider_name text,
  service_name text,starts_at timestamptz,ends_at timestamptz,status text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  return query
  select cp.email,cp.first_name,
    coalesce(nullif(pp.email,''),sp.public_email),sp.business_name,
    b.service_name,b.starts_at,b.ends_at,b.status
  from public.garage_bookings b
  join public.profiles cp on cp.id=b.client_id
  join public.service_providers sp on sp.id=b.provider_id
  join public.profiles pp on pp.id=sp.owner_id
  where b.id=p_booking_id and (b.client_id=auth.uid() or sp.owner_id=auth.uid() or private.is_admin());
end;
$$;
revoke all on function public.booking_email_recipients(uuid) from public,anon,authenticated;
grant execute on function public.booking_email_recipients(uuid) to authenticated;

-- Public has no write access to booking/review tables. RPCs enforce ownership,
-- opening hours, slot availability, and cancellations on the database side.
notify pgrst, 'reload schema';
