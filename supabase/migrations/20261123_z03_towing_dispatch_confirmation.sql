-- MECATREX: complete towing dispatch lifecycle, province matching, reminders
-- Depends on initial towing dispatch migration and z01/z02.
-- A garage slot stays reserved while towing is pending; full confirmation occurs on acceptance.

alter table public.service_providers
  add column if not exists towing_cancellation_count integer not null default 0;
alter table public.service_providers
  drop constraint if exists towing_cancellation_count_valid;
alter table public.service_providers
  add constraint towing_cancellation_count_valid check (towing_cancellation_count between 0 and 3);

create or replace function public.normalize_province(p_name text)
returns text language sql immutable set search_path = '' as $$
  select case
    when regexp_replace(translate(lower(trim(coalesce(p_name,''))),
      'éèêëàâîïôûùüç','eeeeaaiiouuuc'),'[^a-z]','','g') in ('qc','quebec','quebecqc','qcquebec')
      then 'QC'
    when regexp_replace(lower(trim(coalesce(p_name,''))),'[^a-z]','','g') in ('on','ontario') then 'ON'
    when regexp_replace(lower(trim(coalesce(p_name,''))),'[^a-z]','','g') in ('nb','newbrunswick') then 'NB'
    when regexp_replace(lower(trim(coalesce(p_name,''))),'[^a-z]','','g') in ('ns','novascotia') then 'NS'
    else upper(trim(coalesce(p_name,'')))
  end;
$$;
revoke all on function public.normalize_province(text) from public, anon, authenticated;
grant execute on function public.normalize_province(text) to authenticated;

create table if not exists public.towing_opportunity_declines (
  request_id uuid not null references public.towing_requests(id) on delete cascade,
  towing_provider_id uuid not null references public.service_providers(id) on delete cascade,
  declined_at timestamptz not null default now(),
  primary key (request_id,towing_provider_id)
);
alter table public.towing_opportunity_declines enable row level security;
revoke all on public.towing_opportunity_declines from public,anon,authenticated;

-- Keep this row-level policy aligned with the corrected geographic eligibility.
drop policy if exists "Towing requests visible to involved users" on public.towing_requests;
create policy "Towing requests visible to involved users"
on public.towing_requests for select to authenticated
using (
  client_id = (select auth.uid())
  or exists (
    select 1 from public.service_providers garage
    where garage.id = garage_provider_id
      and garage.owner_id = (select auth.uid())
  )
  or exists (
    select 1 from public.service_providers tow
    where tow.owner_id = (select auth.uid())
      and tow.provider_type::text = 'towing'
      and tow.status::text = 'approved'
       and not tow.booking_suspended
      and not tow.is_removed
      and (
        tow.id = towing_provider_id
        or (
          public.towing_requests.status = 'pending'
          and tow.is_listing_active
          and exists (
            select 1 from public.service_providers garage2
            where garage2.id = garage_provider_id
              and public.normalize_province(garage2.province) = public.normalize_province(tow.province)
          )
        )
      )
  )
);



-- Retain atomic garage+towing insert, but update copy and province matching.
create or replace function public.book_garage_service_with_towing(
  p_provider_id uuid,
  p_service_id uuid,
  p_day date,
  p_time text,
  p_note text default '',
  p_vehicle text default '',
  p_wants_towing boolean default false,
  p_pickup_address text default '',
  p_towing_note text default ''
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_booking_id uuid;
  v_request_id uuid;
  v_client_name text;
  v_service_name text;
  v_garage_province text;
  v_booking_time timestamptz;
begin
  if v_user is null then
    raise exception 'Please sign in before making a booking.';
  end if;

  if p_wants_towing then
    if char_length(trim(coalesce(p_pickup_address, ''))) not between 8 and 240 then
      raise exception 'Provide a complete pickup address (8 to 240 characters).';
    end if;
    if char_length(coalesce(p_towing_note, '')) > 500 then
      raise exception 'Towing note must be 500 characters or less.';
    end if;
  end if;

  -- The existing RPC authenticates a client and checks available slots.
  v_booking_id := public.book_garage_service(
    p_provider_id, p_service_id, p_day, p_time, p_note, p_vehicle
  );

  if not p_wants_towing then
    return v_booking_id;
  end if;

  select b.client_name, b.service_name, g.province, b.starts_at
  into v_client_name, v_service_name, v_garage_province, v_booking_time
  from public.garage_bookings b
  join public.service_providers g on g.id = b.provider_id
  where b.id = v_booking_id and b.client_id = v_user;

  if not found then
    raise exception 'Could not verify the confirmed garage booking.';
  end if;

  insert into public.towing_requests (
    booking_id, client_id, garage_provider_id, pickup_address, towing_note
  ) values (
    v_booking_id, v_user, p_provider_id,
    trim(p_pickup_address), trim(coalesce(p_towing_note, ''))
  ) returning id into v_request_id;

  insert into public.booking_notifications(recipient_id, booking_id, title, body)
  select v_user, v_booking_id, 'Towing request pending',
    'Your garage time is reserved, but your complete booking is waiting for a towing company to accept.';

  insert into public.booking_notifications(recipient_id, booking_id, title, body)
  select g.owner_id, v_booking_id, 'Client requested towing',
    v_client_name || ' requested towing for ' || v_service_name || '. Garage time reserved; towing acceptance still pending.'
  from public.service_providers g where g.id = p_provider_id;

  -- Notify approved, published towing companies serving the garage's province.
  insert into public.booking_notifications(recipient_id, booking_id, title, body)
  select distinct tow.owner_id, v_booking_id, 'New towing opportunity',
    'A towing opportunity at ' || v_garage_province || ' is available for ' ||
    to_char(v_booking_time at time zone 'America/Toronto', 'Mon DD, YYYY HH12:MI AM') ||
    '. Open your MECATREX Towing jobs tab.'
  from public.service_providers tow
  where tow.provider_type::text = 'towing'
    and tow.status::text = 'approved'
    and tow.is_listing_active
    and not tow.is_removed
    and not tow.booking_suspended
    and public.normalize_province(tow.province) = public.normalize_province(v_garage_province);

  return v_booking_id;
end;
$$;


-- Restricted RPCs remain callable only by authenticated users.
revoke all on function public.book_garage_service_with_towing(uuid,uuid,date,text,text,text,boolean,text,text) from public,anon,authenticated;
grant execute on function public.book_garage_service_with_towing(uuid,uuid,date,text,text,text,boolean,text,text) to authenticated;

create or replace function public.list_my_towing_opportunities()
returns table (
  request_id uuid,
  booking_id uuid,
  appointment_at timestamptz,
  garage_name text,
  garage_address text,
  service_name text,
  pickup_address text,
  client_name text,
  client_phone text,
  towing_note text,
  request_status text,
  accepted_by_me boolean
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_provider_id uuid;
  v_province text;
begin
  select sp.id, sp.province
    into v_provider_id, v_province
  from public.service_providers sp
  where sp.owner_id = auth.uid()
    and sp.provider_type::text = 'towing'
    and sp.status::text = 'approved'
    and sp.is_listing_active
    and not sp.is_removed
    and not sp.booking_suspended
  limit 1;

  if v_provider_id is null then
    raise exception 'Only approved, published towing providers can view towing jobs.';
  end if;

  return query
  select
    r.id,
    b.id,
    b.starts_at,
    b.garage_name,
    b.garage_address,
    b.service_name,
    r.pickup_address,
    case when r.towing_provider_id = v_provider_id then b.client_name else 'Shared after acceptance' end,
    case when r.towing_provider_id = v_provider_id then b.client_phone else '' end,
    r.towing_note,
    r.status,
    (r.towing_provider_id = v_provider_id)
  from public.towing_requests r
  join public.garage_bookings b on b.id = r.booking_id
  join public.service_providers garage on garage.id = r.garage_provider_id
  where b.status = 'confirmed'
    and b.starts_at > now()
    and (
      (r.status = 'pending'
        and public.normalize_province(garage.province) = public.normalize_province(v_province))
      or (r.status = 'accepted' and r.towing_provider_id = v_provider_id)
    )
    and not exists (
      select 1 from public.towing_opportunity_declines declined
      where declined.request_id = r.id and declined.towing_provider_id = v_provider_id
    )
  order by b.starts_at asc;
end;
$$;


revoke all on function public.list_my_towing_opportunities() from public,anon,authenticated;
grant execute on function public.list_my_towing_opportunities() to authenticated;

create or replace function public.accept_towing_request(p_request_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_provider_id uuid;
  v_owner uuid := auth.uid();
  v_province text;
  v_request public.towing_requests%rowtype;
  v_booking public.garage_bookings%rowtype;
  v_garage_owner uuid;
  v_garage_province text;
  v_company_name text;
begin
  if v_owner is null then raise exception 'Please sign in.'; end if;

  select sp.id, sp.province, sp.business_name
    into v_provider_id, v_province, v_company_name
  from public.service_providers sp
  where sp.owner_id = v_owner
    and sp.provider_type::text = 'towing'
    and sp.status::text = 'approved'
    and sp.is_listing_active
    and not sp.is_removed
    and not sp.booking_suspended
  for update;

  if v_provider_id is null then
    raise exception 'Only approved towing businesses can accept a request.';
  end if;

  select * into v_request
  from public.towing_requests
  where id = p_request_id for update;

  if not found then raise exception 'Towing request was not found.'; end if;

  select b.* into v_booking
  from public.garage_bookings b where b.id = v_request.booking_id;

  if v_booking.status <> 'confirmed' or v_booking.starts_at <= now() then
    raise exception 'This appointment is no longer available for towing.';
  end if;

  select g.owner_id, g.province into v_garage_owner, v_garage_province
  from public.service_providers g where g.id = v_request.garage_provider_id;

  if public.normalize_province(v_province) <> public.normalize_province(v_garage_province) then
    raise exception 'This request is outside your current province.';
  end if;

  if v_request.status = 'accepted' and v_request.towing_provider_id = v_provider_id then
    return true;
  end if;

  if exists(
    select 1 from public.towing_opportunity_declines d
    where d.request_id = p_request_id and d.towing_provider_id = v_provider_id
  ) then raise exception 'You declined this request or cancelled it after acceptance.'; end if;

  if v_request.status <> 'pending' then
    raise exception 'This towing opportunity has already been taken or cancelled.';
  end if;

  update public.towing_requests
  set status = 'accepted', towing_provider_id = v_provider_id, accepted_at = now()
  where id = p_request_id;

  insert into public.booking_notifications(recipient_id, booking_id, title, body)
  values
    (v_request.client_id, v_booking.id, 'Towing request accepted',
      v_company_name || ' accepted your towing request for ' || v_booking.service_name || ' at ' || v_booking.garage_name || '. Your full garage-and-towing booking is now confirmed.'),
    (v_garage_owner, v_booking.id, 'Towing confirmed for appointment',
      v_company_name || ' accepted the towing request for ' || v_booking.client_name || ' (' || v_booking.service_name || '). The complete booking is confirmed.'),
    (v_owner, v_booking.id, 'Towing job accepted',
      'Your towing job for ' || v_booking.garage_name || ' has been added to your assigned jobs.');

  return true;
end;
$$;


revoke all on function public.accept_towing_request(uuid) from public,anon,authenticated;
grant execute on function public.accept_towing_request(uuid) to authenticated;

-- Declining a pending opportunity is not a cancellation and has no strike.
create or replace function public.decline_towing_opportunity(p_request_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_provider public.service_providers%rowtype;
  v_request public.towing_requests%rowtype;
begin
  select * into v_provider from public.service_providers
    where owner_id = auth.uid() and provider_type::text = 'towing'
      and status::text = 'approved' and is_listing_active
      and not booking_suspended and not is_removed for update;
  if not found then raise exception 'Only active towing companies may decline jobs.'; end if;
  select * into v_request from public.towing_requests where id = p_request_id for update;
  if not found or v_request.status <> 'pending' then
    raise exception 'This towing opportunity is no longer open.';
  end if;
  if not exists (
    select 1 from public.service_providers garage
    where garage.id = v_request.garage_provider_id
      and public.normalize_province(garage.province) = public.normalize_province(v_provider.province)
  ) then raise exception 'This request is outside your operating province.'; end if;
  insert into public.towing_opportunity_declines(request_id,towing_provider_id)
    values (p_request_id,v_provider.id)
    on conflict do nothing;
  return true;
end;
$$;
revoke all on function public.decline_towing_opportunity(uuid) from public,anon,authenticated;
grant execute on function public.decline_towing_opportunity(uuid) to authenticated;

-- Towing cancellations AFTER acceptance count against the towing provider.
-- Two strikes are tolerated; on the third, their listing and future assignments are suspended.
-- The garage booking is never cancelled; the towing request is reopened to others.
create or replace function public.cancel_accepted_towing_request(p_request_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_provider public.service_providers%rowtype;
  v_request public.towing_requests%rowtype;
  v_booking public.garage_bookings%rowtype;
  v_garage_owner uuid;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;
  select * into v_provider from public.service_providers
    where owner_id = auth.uid() and provider_type::text = 'towing' for update;
  if not found then raise exception 'Only a towing provider can cancel an accepted towing job.'; end if;
  select * into v_request from public.towing_requests where id = p_request_id for update;
  if not found or v_request.status <> 'accepted' or v_request.towing_provider_id <> v_provider.id then
    raise exception 'This towing job is not assigned to you.';
  end if;
  select * into v_booking from public.garage_bookings where id = v_request.booking_id;
  if v_booking.status <> 'confirmed' or v_booking.starts_at <= now() then
    raise exception 'Past or cancelled towing jobs cannot be released online. Contact support.';
  end if;

  v_count := least(3,v_provider.towing_cancellation_count+1);
  update public.towing_requests
    set status='pending', towing_provider_id=null, accepted_at=null
    where id=p_request_id;
  insert into public.towing_opportunity_declines(request_id,towing_provider_id)
    values (p_request_id,v_provider.id) on conflict do nothing;
  update public.service_providers
  set towing_cancellation_count=v_count,
      booking_suspended=case when v_count>=3 then true else booking_suspended end,
      is_listing_active=case when v_count>=3 then false else is_listing_active end
  where id=v_provider.id;

  select owner_id into v_garage_owner
    from public.service_providers where id=v_request.garage_provider_id;

  insert into public.booking_notifications(recipient_id,booking_id,title,body)
  values
    (v_request.client_id,v_booking.id,'Towing provider cancelled',
      v_provider.business_name||' cancelled the accepted towing trip. Your garage time remains reserved; we are looking for another towing company.'),
    (v_garage_owner,v_booking.id,'Towing acceptance withdrawn',
      v_provider.business_name||' withdrew their towing assignment. The garage slot is still reserved.'),
    (v_provider.owner_id,v_booking.id,'Towing cancellation warning',
      case when v_count>=3 then 'Towing cancellation 3/3. Your company is suspended from accepting new towing jobs.'
      else 'Towing cancellation '||v_count||'/3. You have '||(3-v_count)||' cancellations remaining before suspension.' end);

  insert into public.booking_notifications(recipient_id,booking_id,title,body)
  select other.owner_id,v_booking.id,'Reopened towing opportunity',
    'A towing request for '||v_booking.garage_name||' on '||
    to_char(v_booking.starts_at at time zone 'America/Toronto','Mon DD, YYYY HH12:MI AM')||' is available.'
  from public.service_providers other
  where other.provider_type::text='towing' and other.status::text='approved'
    and other.is_listing_active and not other.is_removed and not other.booking_suspended
    and other.id<>v_provider.id
    and public.normalize_province(other.province) =
      (select public.normalize_province(garage.province)
         from public.service_providers garage where garage.id=v_request.garage_provider_id)
    and not exists(select 1 from public.towing_opportunity_declines d
      where d.request_id=v_request.id and d.towing_provider_id=other.id);
  return greatest(0,3-v_count);
end;
$$;
revoke all on function public.cancel_accepted_towing_request(uuid) from public,anon,authenticated;
grant execute on function public.cancel_accepted_towing_request(uuid) to authenticated;

-- Secure outbound email recipient lookup, scoped to the booking owner or
-- original tow company that declined a reopened job. Never expose raw data publicly.
create or replace function public.towing_dispatch_email_recipients(p_booking_id uuid)
returns table(email text, company_name text, garage_name text, service_name text, appointment_at timestamptz, pickup_address text)
language plpgsql stable security definer set search_path = '' as $$
declare v_request public.towing_requests%rowtype;
begin
  -- Dispatch bulk emails are internal server work. Do not expose every
  -- towing provider's email address to clients or other providers.
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Only the MECATREX email dispatcher may access recipient addresses.';
  end if;
  select * into v_request from public.towing_requests where booking_id=p_booking_id;
  if not found then return; end if;

  return query
    select coalesce(nullif(p.email,''),tow.public_email),tow.business_name,
      b.garage_name,b.service_name,b.starts_at,v_request.pickup_address
    from public.service_providers tow
    join public.profiles p on p.id=tow.owner_id
    join public.garage_bookings b on b.id=v_request.booking_id
    where tow.provider_type::text='towing' and tow.status::text='approved'
      and tow.is_listing_active and not tow.is_removed and not tow.booking_suspended
      and v_request.status='pending' and b.status='confirmed' and b.starts_at>now()
      and public.normalize_province(tow.province)=
        (select public.normalize_province(garage.province)
         from public.service_providers garage where garage.id=v_request.garage_provider_id)
      and not exists(select 1 from public.towing_opportunity_declines d
        where d.request_id=v_request.id and d.towing_provider_id=tow.id);
end;
$$;
revoke all on function public.towing_dispatch_email_recipients(uuid) from public,anon,authenticated;
grant execute on function public.towing_dispatch_email_recipients(uuid) to service_role;

-- Email addresses are available only to one of the three booking parties;
-- the server action uses this after an accepted towing claim.
create or replace function public.towing_party_email_details(p_request_id uuid)
returns table(
  client_email text,client_name text,
  garage_email text,garage_name text,
  towing_email text,towing_name text,
  service_name text,appointment_at timestamptz,
  pickup_address text,garage_address text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  return query
  select cp.email,b.client_name,
    coalesce(nullif(gp.email,''),garage.public_email),garage.business_name,
    coalesce(nullif(tp.email,''),tow.public_email),tow.business_name,
    b.service_name,b.starts_at,r.pickup_address,b.garage_address
  from public.towing_requests r
  join public.garage_bookings b on b.id=r.booking_id
  join public.profiles cp on cp.id=b.client_id
  join public.service_providers garage on garage.id=r.garage_provider_id
  join public.profiles gp on gp.id=garage.owner_id
  join public.service_providers tow on tow.id=r.towing_provider_id
  join public.profiles tp on tp.id=tow.owner_id
  where r.id=p_request_id and r.status='accepted'
    and (b.client_id=auth.uid() or garage.owner_id=auth.uid()
      or tow.owner_id=auth.uid() or private.is_admin());
end;
$$;
revoke all on function public.towing_party_email_details(uuid) from public,anon,authenticated;
grant execute on function public.towing_party_email_details(uuid) to authenticated;
