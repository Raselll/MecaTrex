begin;
alter table public.towing_requests add column if not exists towing_fee_cents integer check (towing_fee_cents between 0 and 10000000);
create or replace function public.accept_towing_request(p_request_id uuid, p_fee_cents integer)
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
  if p_fee_cents is null or p_fee_cents < 0 or p_fee_cents > 10000000 then raise exception 'Invalid towing fee.'; end if;

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
    if v_request.towing_fee_cents is null then
      update public.towing_requests set towing_fee_cents=p_fee_cents where id=p_request_id;
    elsif v_request.towing_fee_cents <> p_fee_cents then raise exception 'The agreed fee is already recorded.'; end if;
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
  set status = 'accepted', towing_provider_id = v_provider_id, accepted_at = now(), towing_fee_cents=p_fee_cents
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


revoke all on function public.accept_towing_request(uuid,integer) from public,anon,authenticated;
grant execute on function public.accept_towing_request(uuid,integer) to authenticated;
revoke all on function public.accept_towing_request(uuid) from public,anon,authenticated;
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
    'A customer needs towing near ' || v_garage_province || ' for ' ||
    to_char(v_booking_time at time zone 'America/Toronto', 'Mon DD, YYYY HH12:MI AM') ||
    '. Sign in to BandWhip to view the pickup location and claim the opportunity.'
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
create or replace function private.clear_released_towing_fee() returns trigger language plpgsql set search_path='' as $$
begin if new.status='pending' then new.towing_fee_cents=null; end if; return new; end; $$;
drop trigger if exists clear_released_towing_fee on public.towing_requests;
create trigger clear_released_towing_fee before update of status on public.towing_requests for each row execute function private.clear_released_towing_fee();
create or replace function public.my_towing_finances(p_from timestamptz,p_to timestamptz)
returns table(id uuid,client_id uuid,client_name text,garage_name text,garage_address text,service_name text,vehicle_description text,starts_at timestamptz,ends_at timestamptz,price_cents integer,status text)
language sql stable security definer set search_path='' as $$
 select r.id,b.client_id,b.client_name,b.garage_name,b.garage_address,'Towing'::text,b.vehicle_description,b.starts_at,b.ends_at,r.towing_fee_cents,b.status::text
 from public.towing_requests r join public.garage_bookings b on b.id=r.booking_id join public.service_providers sp on sp.id=r.towing_provider_id
 where auth.uid() is not null and sp.owner_id=auth.uid() and sp.provider_type::text='towing' and r.status='accepted' and b.starts_at>=p_from and b.starts_at<p_to
 order by b.starts_at desc;
$$;
revoke all on function public.my_towing_finances(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.my_towing_finances(timestamptz,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;