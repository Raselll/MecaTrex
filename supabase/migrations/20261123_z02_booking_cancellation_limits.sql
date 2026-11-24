-- MECATREX cancellation policy.
-- Client: first 24 hours after each booking are penalty-free; later cancellations
-- accumulate across bookings. Third charged cancellation suspends NEW bookings.
-- Garage: retain existing three-cancellation suspension rule.
-- Penalty counters are a protected table, never client-editable columns.

create table if not exists public.client_booking_penalties (
  client_id uuid primary key references public.profiles(id) on delete cascade,
  charged_cancellations integer not null default 0 check (charged_cancellations between 0 and 3),
  booking_banned boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint client_booking_penalty_consistent check (
    (charged_cancellations >= 3 and booking_banned) or
    (charged_cancellations < 3 and not booking_banned)
  )
);
alter table public.client_booking_penalties enable row level security;
revoke all on public.client_booking_penalties from public, anon, authenticated;
grant select on public.client_booking_penalties to authenticated;
drop policy if exists "Client reads own cancellation standing" on public.client_booking_penalties;
create policy "Client reads own cancellation standing"
on public.client_booking_penalties for select to authenticated
using (client_id = (select auth.uid()) or private.is_admin());

create or replace function private.prevent_banned_client_booking()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists(
    select 1 from public.client_booking_penalties p
    where p.client_id = new.client_id and p.booking_banned
  ) then
    raise exception 'Your MECATREX client bookings are suspended after three late cancellations. Contact support.';
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_banned_client_booking() from public,anon,authenticated;
drop trigger if exists prevent_banned_client_booking on public.garage_bookings;
create trigger prevent_banned_client_booking before insert on public.garage_bookings
for each row execute function private.prevent_banned_client_booking();

create or replace function public.cancel_garage_booking(p_booking_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_booking public.garage_bookings%rowtype;
  v_provider public.service_providers%rowtype;
  v_is_owner boolean;
  v_count integer;
  v_remaining integer;
  v_is_free boolean;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;
  select provider_id into v_booking.provider_id from public.garage_bookings where id = p_booking_id;
  if v_booking.provider_id is null then raise exception 'Booking not found.'; end if;

  -- Preserve the existing lock order to avoid double cancellations.
  select * into v_provider from public.service_providers where id = v_booking.provider_id for update;
  select * into v_booking from public.garage_bookings where id = p_booking_id for update;
  if v_booking.status <> 'confirmed' then raise exception 'This booking was already cancelled.'; end if;
  v_is_owner := v_provider.owner_id = auth.uid();
  if not v_is_owner and v_booking.client_id <> auth.uid() then
    raise exception 'You cannot cancel another person''s booking.';
  end if;
  if v_booking.starts_at <= now() then
    raise exception 'Started or past bookings cannot be cancelled online. Contact MECATREX support.';
  end if;

  if v_is_owner then
    if v_provider.booking_suspended or v_provider.provider_cancellation_count >= 3 then
      raise exception 'This garage has reached its cancellation limit. Contact MECATREX support.';
    end if;
    v_count := least(3, v_provider.provider_cancellation_count + 1);
    update public.garage_bookings set status = 'provider_cancelled', cancelled_at = now()
      where id = p_booking_id;
    update public.service_providers
    set provider_cancellation_count = v_count,
        booking_suspended = v_count >= 3,
        is_listing_active = case when v_count >= 3 then false else is_listing_active end
    where id = v_provider.id;
    v_remaining := greatest(0, 3 - v_count);
  else
    v_is_free := now() <= v_booking.created_at + interval '24 hours';
    update public.garage_bookings set status = 'client_cancelled', cancelled_at = now()
      where id = p_booking_id;

    if v_is_free then
      select charged_cancellations into v_count
      from public.client_booking_penalties
      where client_id = v_booking.client_id;
      v_count := coalesce(v_count,0);
    else
      insert into public.client_booking_penalties(client_id,charged_cancellations,booking_banned,updated_at)
      values (v_booking.client_id,1,false,now())
      on conflict (client_id) do update
      set charged_cancellations = least(3,public.client_booking_penalties.charged_cancellations + 1),
          booking_banned = public.client_booking_penalties.charged_cancellations + 1 >= 3,
          updated_at = now()
      returning charged_cancellations into v_count;
    end if;
    v_remaining := greatest(0,3-v_count);
  end if;

  insert into public.booking_notifications(recipient_id,booking_id,title,body)
  values
    (v_booking.client_id,p_booking_id,
      case when not v_is_owner and not v_is_free then 'Cancellation warning' else 'Appointment cancelled' end,
      case
        when v_is_owner then 'The garage cancelled your '||v_booking.service_name||' appointment. Your booking has been released.'
        when v_is_free then 'You cancelled within 24 hours of booking. No cancellation penalty was recorded.'
        when v_remaining = 0 then 'Cancellation warning 3/3. Your MECATREX account can no longer make new bookings. Contact support.'
        else 'Cancellation warning '||v_count||'/3. You have '||v_remaining||' cancellation(s) left before booking suspension.'
      end),
    (v_provider.owner_id,p_booking_id,
      case when v_is_owner then 'Garage cancellation warning' else 'Client cancelled appointment' end,
      case
        when v_is_owner and v_remaining = 0 then 'Your third cancellation suspended new garage bookings. Contact MECATREX support.'
        when v_is_owner then 'Garage cancellation warning '||v_count||'/3. You have '||v_remaining||' cancellation(s) remaining.'
        else v_booking.client_name||' cancelled '||v_booking.service_name||'. The reserved time has been released.'
      end);
  return v_remaining;
end;
$$;
revoke all on function public.cancel_garage_booking(uuid) from public,anon,authenticated;
grant execute on function public.cancel_garage_booking(uuid) to authenticated;
