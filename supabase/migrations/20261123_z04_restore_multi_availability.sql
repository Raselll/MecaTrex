-- MECATREX hotfix: restore proven garage availability for single services,
-- use existing garage slots as the foundation for combined service duration.
-- Apply AFTER z01, z02 and z03. Does not touch any booking records.

create or replace function public.garage_available_slots_multi(
  p_provider_id uuid, p_service_ids uuid[], p_day date
)
returns table(slot_time text, starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_expected integer;
  v_found integer;
  v_distinct integer;
  v_duration bigint;
begin
  v_expected := coalesce(cardinality(p_service_ids), 0);
  if v_expected not between 1 and 50 then return; end if;

  -- The existing function remains the source of truth for a single service.
  -- This preserves the exact availability logic in use before multi-service support.
  if v_expected = 1 then
    return query
      select original.slot_time, original.starts_at, original.ends_at
      from public.garage_available_slots(p_provider_id,p_service_ids[1],p_day) original;
    return;
  end if;

  -- Verify that every submitted service belongs to this garage and has a fixed price.
  -- The list can contain no duplicates.
  select count(*)::integer, count(distinct svc.id)::integer,
         sum(svc.duration_minutes)::bigint
  into v_found, v_distinct, v_duration
  from unnest(p_service_ids) as requested(service_id)
  join public.provider_services svc
    on svc.id = requested.service_id
    and svc.provider_id = p_provider_id
    and svc.is_active
    and svc.pricing_type = 'fixed'
    and svc.price_cents is not null
    and svc.duration_minutes > 0;

  if v_found <> v_expected or v_distinct <> v_expected
     or v_duration is null or v_duration > 2147483647 then
    return;
  end if;

  -- The original SQL already validates approval, published status, calendar
  -- day, business hours, DST, start-time in future and initial overlap.
  -- Only retain candidates whose EXTENDED interval also fits operating hours
  -- and does not conflict with a confirmed booking or a calendar block.
  return query
  select base.slot_time, base.starts_at,
         base.starts_at + make_interval(mins => v_duration::integer) as ends_at
  from public.garage_available_slots(p_provider_id,p_service_ids[1],p_day) base
  where private.garage_interval_within_hours(
    p_provider_id, base.starts_at,
    base.starts_at + make_interval(mins => v_duration::integer)
  )
  and not exists (
    select 1 from public.garage_bookings booked
    where booked.provider_id = p_provider_id
      and booked.status = 'confirmed'
      and tstzrange(booked.starts_at,booked.ends_at,'[)') &&
          tstzrange(base.starts_at,base.starts_at + make_interval(mins => v_duration::integer),'[)')
  )
  and not exists (
    select 1 from public.garage_calendar_blocks blocks
    where blocks.provider_id = p_provider_id
      and tstzrange(blocks.starts_at,blocks.ends_at,'[)') &&
          tstzrange(base.starts_at,base.starts_at + make_interval(mins => v_duration::integer),'[)')
  )
  order by base.starts_at;
end;
$$;

revoke all on function public.garage_available_slots_multi(uuid,uuid[],date)
  from public, anon, authenticated;
grant execute on function public.garage_available_slots_multi(uuid,uuid[],date)
  to anon, authenticated;
