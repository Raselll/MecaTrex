-- MECATREX: client-to-garage vehicle handoff, return and 24-hour reminder jobs.
-- Requires the existing garage_bookings, service_providers, profiles,
-- booking_notifications and Supabase storage schema. Does not rewrite bookings.

create table if not exists public.booking_visits (
  booking_id uuid primary key references public.garage_bookings(id) on delete cascade,
  garage_received_at timestamptz,
  vehicle_ready_at timestamptz,
  ready_email_sent_at timestamptz,
  client_picked_up_at timestamptz,
  pickup_not_received_at timestamptz,
  created_at timestamptz not null default now(),
  constraint vehicle_visit_stages_valid check (
    (vehicle_ready_at is null or garage_received_at is not null)
    and (client_picked_up_at is null or vehicle_ready_at is not null)
  )
);
alter table public.booking_visits enable row level security;
revoke all on public.booking_visits from public, anon, authenticated;
grant select on public.booking_visits to authenticated;
drop policy if exists "Booking parties view handoff" on public.booking_visits;
create policy "Booking parties view handoff" on public.booking_visits
for select to authenticated using (
  exists (
    select 1 from public.garage_bookings b
    join public.service_providers g on g.id=b.provider_id
    where b.id=booking_id and
      (b.client_id=(select auth.uid()) or g.owner_id=(select auth.uid()) or private.is_admin())
  )
);

-- Secret handoff codes are never exposed in the public API schema.
create table if not exists private.booking_handoff_codes (
  booking_id uuid primary key references public.garage_bookings(id) on delete cascade,
  code text not null,
  failed_attempts integer not null default 0,
  issued_at timestamptz not null default now()
);
revoke all on private.booking_handoff_codes from public,anon,authenticated;

-- Code available ONLY to the garage account from two hours prior.
-- Sharing it upon physical vehicle receipt replaces a second garage checkbox.
create or replace function public.issue_garage_handoff_code(p_booking_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_booking public.garage_bookings%rowtype; v_code text;
begin
  if auth.uid() is null then raise exception 'Sign in as the garage.'; end if;
  select * into v_booking from public.garage_bookings where id=p_booking_id;
  if not found or v_booking.status <> 'confirmed'
    or not exists (select 1 from public.service_providers g
       where g.id=v_booking.provider_id and g.owner_id=auth.uid() and g.provider_type::text='garage')
  then raise exception 'This appointment is not assigned to your garage.'; end if;
  if now() < v_booking.starts_at - interval '2 hours' then
    raise exception 'The handoff code becomes available two hours before the appointment.'; end if;
  if now() > v_booking.ends_at + interval '24 hours' then
    raise exception 'The handoff window is closed. Contact MECATREX support.'; end if;
  insert into private.booking_handoff_codes(booking_id,code)
    values (p_booking_id,upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)))
    on conflict (booking_id) do nothing;
  select code into v_code from private.booking_handoff_codes where booking_id=p_booking_id;
  return v_code;
end; $$;
revoke all on function public.issue_garage_handoff_code(uuid) from public,anon,authenticated;
grant execute on function public.issue_garage_handoff_code(uuid) to authenticated;

-- Wrong codes RETURN FALSE rather than raise: failed attempts must commit.
-- 8 hex digits + 5 attempts prevent feasible remote guessing.
create or replace function public.confirm_vehicle_dropoff(p_booking_id uuid,p_code text)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  v_booking public.garage_bookings%rowtype;
  v_secret private.booking_handoff_codes%rowtype;
  v_received timestamptz;
  v_owner uuid;
begin
  if auth.uid() is null then raise exception 'Sign in as the client.'; end if;
  select * into v_booking from public.garage_bookings where id=p_booking_id for update;
  if not found or v_booking.client_id<>auth.uid() or v_booking.status<>'confirmed'
    then raise exception 'You cannot check in for this appointment.'; end if;
  if now() < v_booking.starts_at - interval '2 hours' then
    raise exception 'Vehicle handoff opens two hours before the appointment.'; end if;
  if now() > v_booking.ends_at + interval '24 hours' then
    raise exception 'The handoff window has closed. Contact the garage.'; end if;
  select garage_received_at into v_received from public.booking_visits where booking_id=p_booking_id;
  if v_received is not null then return true; end if;

  select * into v_secret from private.booking_handoff_codes where booking_id=p_booking_id for update;
  if not found or v_secret.failed_attempts>=5 then return false; end if;
  if upper(trim(coalesce(p_code,'')))<>v_secret.code then
    update private.booking_handoff_codes set failed_attempts=failed_attempts+1
      where booking_id=p_booking_id;
    return false;
  end if;
  insert into public.booking_visits(booking_id,garage_received_at)
    values (p_booking_id,now())
    on conflict (booking_id) do update set garage_received_at=coalesce(
      public.booking_visits.garage_received_at,excluded.garage_received_at);
  select owner_id into v_owner from public.service_providers where id=v_booking.provider_id;
  insert into public.booking_notifications(recipient_id,booking_id,title,body)
    values
      (v_owner,p_booking_id,'Vehicle received at garage',
       v_booking.client_name||' confirmed vehicle drop-off using your garage handoff code. You can now begin the service.'),
      (v_booking.client_id,p_booking_id,'Vehicle drop-off confirmed',
       'Your vehicle handoff at '||v_booking.garage_name||' has been recorded. The garage will notify you when it is ready.');
  return true;
end; $$;
revoke all on function public.confirm_vehicle_dropoff(uuid,text) from public,anon,authenticated;
grant execute on function public.confirm_vehicle_dropoff(uuid,text) to authenticated;

-- Marking ready is a deliberate garage action; no ready status without check-in.
create or replace function public.mark_vehicle_ready(p_booking_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_booking public.garage_bookings%rowtype; v_ready timestamptz; v_rowcount integer;
begin
  if auth.uid() is null then raise exception 'Garage login required.'; end if;
  select * into v_booking from public.garage_bookings b where b.id=p_booking_id for update;
  if not found or v_booking.status<>'confirmed' or not exists (
    select 1 from public.service_providers g
    where g.id=v_booking.provider_id and g.owner_id=auth.uid() and g.provider_type::text='garage')
  then raise exception 'You cannot complete this garage appointment.'; end if;
  update public.booking_visits set vehicle_ready_at=now()
    where booking_id=p_booking_id and garage_received_at is not null
      and vehicle_ready_at is null;
  get diagnostics v_rowcount=row_count;
  if v_rowcount=0 then
    select vehicle_ready_at into v_ready from public.booking_visits where booking_id=p_booking_id;
    if v_ready is null then raise exception 'Vehicle drop-off must be verified with the handoff code first.'; end if;
    return false;
  end if;
  insert into public.booking_notifications(recipient_id,booking_id,title,body)
    values (v_booking.client_id,p_booking_id,'Your vehicle is ready for pickup',
     'The garage has marked your '||v_booking.service_name||' service complete. You can pick up your vehicle at '||v_booking.garage_name||'.');
  return true;
end; $$;
revoke all on function public.mark_vehicle_ready(uuid) from public,anon,authenticated;
grant execute on function public.mark_vehicle_ready(uuid) to authenticated;

-- Client alone closes the visit. A "not yet" response keeps the job open.
create or replace function public.confirm_vehicle_pickup(p_booking_id uuid,p_received boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_booking public.garage_bookings%rowtype; v_rowcount integer; v_owner uuid;
begin
  if auth.uid() is null then raise exception 'Client login required.'; end if;
  select * into v_booking from public.garage_bookings where id=p_booking_id for update;
  if not found or v_booking.client_id<>auth.uid() or v_booking.status<>'confirmed'
    then raise exception 'This is not your active appointment.'; end if;
  select owner_id into v_owner from public.service_providers where id=v_booking.provider_id;
  if p_received then
    update public.booking_visits set client_picked_up_at=now()
      where booking_id=p_booking_id and vehicle_ready_at is not null
        and client_picked_up_at is null;
  else
    update public.booking_visits set pickup_not_received_at=now()
      where booking_id=p_booking_id and vehicle_ready_at is not null
        and client_picked_up_at is null and pickup_not_received_at is null;
  end if;
  get diagnostics v_rowcount=row_count;
  if v_rowcount=0 then return false; end if;
  insert into public.booking_notifications(recipient_id,booking_id,title,body)
  values (v_owner,p_booking_id,
    case when p_received then 'Client confirmed vehicle pickup' else 'Client has not received the vehicle' end,
    case when p_received
      then v_booking.client_name||' confirmed that their vehicle has been collected. The visit is closed.'
      else v_booking.client_name||' says they have not received the vehicle yet. Please coordinate directly.' end);
  return true;
end; $$;
revoke all on function public.confirm_vehicle_pickup(uuid,boolean) from public,anon,authenticated;
grant execute on function public.confirm_vehicle_pickup(uuid,boolean) to authenticated;

-- Photos are optional, private and append-only. Garage and client may view them.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('mecatrex-handoff-photos','mecatrex-handoff-photos',false,5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "Handoff participant reads photos" on storage.objects;
create policy "Handoff participant reads photos" on storage.objects
for select to authenticated using (
 bucket_id='mecatrex-handoff-photos' and
 exists (
   select 1 from public.garage_bookings b
   join public.service_providers g on g.id=b.provider_id
   where (storage.foldername(name))[1]=b.id::text
     and (storage.foldername(name))[2]=b.client_id::text
     and (b.client_id=auth.uid() or g.owner_id=auth.uid())
 )
);
drop policy if exists "Checked in client uploads photos" on storage.objects;
create policy "Checked in client uploads photos" on storage.objects
for insert to authenticated with check (
 bucket_id='mecatrex-handoff-photos' and
 exists (
   select 1 from public.garage_bookings b
   join public.booking_visits v on v.booking_id=b.id
   where (storage.foldername(name))[1]=b.id::text
     and (storage.foldername(name))[2]=b.client_id::text
     and b.client_id=auth.uid() and b.status='confirmed'
     and v.garage_received_at is not null and v.client_picked_up_at is null
 )
);

-- Reminder email outbox. The scheduler uses service_role; browser has no access.
create table if not exists public.booking_reminder_jobs (
  booking_id uuid primary key references public.garage_bookings(id) on delete cascade,
  state text not null default 'sending'
    check (state in ('sending','failed','sent')),
  attempts integer not null default 1,
  locked_until timestamptz,
  sent_at timestamptz,
  last_error text
);
alter table public.booking_reminder_jobs enable row level security;
revoke all on public.booking_reminder_jobs from public,anon,authenticated;

create or replace function public.claim_due_booking_reminders(p_limit integer default 20)
returns table(booking_id uuid,client_email text,client_name text,
  garage_name text,garage_address text,service_name text,
  starts_at timestamptz,towing_pending boolean)
language plpgsql security definer set search_path='' as $$
declare r record; v_count integer;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Reminder scheduler only.'; end if;
  for r in
    select b.id,b.client_email,b.client_name,b.garage_name,b.garage_address,
      b.service_name,b.starts_at,
      exists(select 1 from public.towing_requests tr
        where tr.booking_id=b.id and tr.status='pending') as towing_pending
    from public.garage_bookings b
    where b.status='confirmed'
      and b.starts_at > now()+interval '30 minutes'
      and b.starts_at <= now()+interval '24 hours'
      and b.client_email is not null and b.client_email <> ''
    order by b.starts_at
    limit greatest(1,least(coalesce(p_limit,20),100))
  loop
    insert into public.booking_reminder_jobs(booking_id,state,attempts,locked_until)
      values (r.id,'sending',1,now()+interval '4 minutes')
    on conflict (booking_id) do update
      set state='sending',
          attempts=public.booking_reminder_jobs.attempts+1,
          locked_until=now()+interval '4 minutes',
          last_error=null
      where public.booking_reminder_jobs.state <> 'sent'
        and public.booking_reminder_jobs.attempts<6
        and (public.booking_reminder_jobs.state='failed'
          or public.booking_reminder_jobs.locked_until<now())
    returning 1 into v_count;
    if v_count=1 then
      booking_id:=r.id;client_email:=r.client_email;client_name:=r.client_name;
      garage_name:=r.garage_name;garage_address:=r.garage_address;
      service_name:=r.service_name;starts_at:=r.starts_at;
      towing_pending:=r.towing_pending;
      return next;
    end if;
    v_count:=null;
  end loop;
end; $$;
revoke all on function public.claim_due_booking_reminders(integer) from public,anon,authenticated;
grant execute on function public.claim_due_booking_reminders(integer) to service_role;

create or replace function public.complete_booking_reminder(
  p_booking_id uuid,p_success boolean,p_error text default ''
)
returns void language plpgsql security definer set search_path='' as $$
declare v_changed integer; v_client uuid;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Reminder scheduler only.'; end if;
  update public.booking_reminder_jobs set
    state=case when p_success then 'sent' else 'failed' end,
    sent_at=case when p_success then now() else null end,
    locked_until=null,
    last_error=case when p_success then null else left(coalesce(p_error,''),300) end
  where booking_id=p_booking_id and state='sending';
  get diagnostics v_changed=row_count;
  if v_changed=1 and p_success then
    select client_id into v_client from public.garage_bookings where id=p_booking_id;
    if v_client is not null then
      insert into public.booking_notifications(recipient_id,booking_id,title,body)
      values (v_client,p_booking_id,'Your appointment reminder',
        'Reminder sent: your garage appointment is scheduled for the next 24 hours. See your booking for date, time and address.');
    end if;
  end if;
end; $$;
revoke all on function public.complete_booking_reminder(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.complete_booking_reminder(uuid,boolean,text) to service_role;

notify pgrst,'reload schema';
