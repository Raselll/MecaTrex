# MECATREX — Multi-service booking, cancellation policy, towing dispatch

## Database deployment (required before using the updated website)
The web code now calls new PostgreSQL functions. **A Git pull alone does not install SQL migrations.**
Apply these scripts to the MECATREX Supabase project in SQL Editor, in order:

1. Ensure the existing garage booking migration has been applied: `supabase/migrations/20261107_booking_calendar_reviews.sql`
2. Ensure the original towing dispatch migration has been applied: `supabase/migrations/20261123_towing_requests_and_dispatch.sql`
3. Apply `supabase/migrations/20261123_z01_multi_service_bookings.sql`
4. Apply `supabase/migrations/20261123_z02_booking_cancellation_limits.sql`
5. Apply `supabase/migrations/20261123_z03_towing_dispatch_confirmation.sql`
6. Apply `supabase/migrations/20261123_z04_restore_multi_availability.sql` (hotfix for empty slots)

Only run step 1 or 2 if the environment does not already have them. Review deployment changes in a development environment before production. Keep existing bookings intact; do not reset the Supabase database.

## Sanity checks after applying scripts

Run in Supabase SQL Editor:

```sql
select
  to_regprocedure('public.book_garage_services(uuid,uuid[],date,text,text,text,boolean,text,text)') is not null as multiservice_booking_installed,
  to_regprocedure('public.garage_available_slots_multi(uuid,uuid[],date)') is not null as combined_availability_installed,
  to_regprocedure('public.list_my_towing_opportunities()') is not null as towing_dispatch_installed,
  to_regprocedure('public.accept_towing_request(uuid)') is not null as towing_acceptance_installed,
  to_regprocedure('public.decline_towing_opportunity(uuid)') is not null as towing_declines_installed,
  to_regprocedure('public.cancel_accepted_towing_request(uuid)') is not null as towing_cancellation_installed;
```

For a **specific client booking**, confirm towing request creation and province matching:

```sql
select
  b.id as booking_id, b.client_name, b.service_name, b.starts_at,
  b.status as garage_slot_status,
  t.id as towing_request_id, t.status as towing_status,
  g.province as garage_province, public.normalize_province(g.province) as normalized_garage_province,
  (select count(*) from public.service_providers tow
   where tow.provider_type::text='towing'
     and tow.status::text='approved'
     and tow.is_listing_active and not tow.is_removed and not tow.booking_suspended
     and public.normalize_province(tow.province)=public.normalize_province(g.province)
  ) as eligible_towing_companies
from public.garage_bookings b
left join public.towing_requests t on t.booking_id=b.id
join public.service_providers g on g.id=b.provider_id
order by b.created_at desc limit 10;
```

If towing_request_id is NULL, that booking does not have a towing request. The original pending towing RLS also had a `status` name collision with the provider's approval status; z03 explicitly fixes the request-status reference. A past booking with no request is **not** backfilled automatically. Create a new test booking with Yes, request towing.

## Status interpretation
- No towing: the garage reservation is fully confirmed instantly.
- Towing requested: garage time is reserved (the underlying garage row remains `confirmed` to block the time), but the **complete trip** is pending towing acceptance.
- Towing accepted: complete garage + towing booking is confirmed; all three parties receive in-app notices and emails.
- A towing company declines an open opportunity: no penalty; it disappears from that provider's list.
- A towing company cancels an **accepted** job: warning is counted, towing request reopens for other eligible companies, and the garage time remains reserved.
- A client cancels within 24 hours of the **time the reservation was created**: no strike. Otherwise the third chargeable cancellation disables new bookings.
- Garage owner cancellation: third cancellation suspends their listing (existing rule).
- Towing company cancellation: two accepted-job cancellations are allowed; on the third, the towing listing is suspended.

## Email
Booking, towing dispatch and cancellation warnings use the existing Brevo API integration. Ensure `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `NEXT_PUBLIC_SITE_URL` and the **server-only** `SUPABASE_SERVICE_ROLE_KEY` are configured. The service-role key is required exclusively for retrieving the list of towing-company email recipients; it must never be named `NEXT_PUBLIC_` or exposed to browser code. If missing, garage confirmations and in-app towing alerts still work, but towing broadcast emails cannot be sent. Outbound email failures are logged and do not roll back a booking or towing acceptance. In-app notifications are written transactionally to `booking_notifications`.

## Test sequence
1. Select two or more garage services, verify the displayed total price and duration, and reserve an available combined slot.
2. Confirm one booking without towing: instant full confirmation.
3. Confirm one booking with towing: pending status visible to client and garage; eligible towing accounts receive an opportunity and email.
4. Decline on one towing account (no strike), accept on another, verify each of the three email notices and the full-confirmation status.
5. Cancel the accepted towing trip and verify warning, reopened opportunity and retained garage slot.
6. Test client cancellation within 24 hours and a chargeable late cancellation using test accounts; verify strike counter and emails.
7. Test garage cancellation counter and suspension using test accounts only.

Existing bookings are not retroactively grouped into booking-items rows; their original single-service snapshots remain valid.

## November 23 availability hotfix

If the provider calendar says a day is open but `No free slots` appears after the first multi-service release, the newer SQL function is not necessarily returning the same slots as the original. The web application now uses `garage_available_slots` for **one** service (both preview and submission), restoring the old working path. For two or more services, apply the z04 hotfix above. It builds extended-duration slots from the original database function, then validates the full booked interval.

To inspect an existing service on November 24, 2026, replace the provider and service UUIDs with those visible in your booking URL, and run:

```sql
select 'original_single' as source, count(*) as free_slots
from public.garage_available_slots(
  'f7224272-af80-4a6a-9ccf-d7b9a217375a'::uuid,
  'ca5b6d84-410d-4997-8ae2-78df5be83cea'::uuid,
  '2026-11-24'::date
)
union all
select 'multi_single' as source, count(*) as free_slots
from public.garage_available_slots_multi(
  'f7224272-af80-4a6a-9ccf-d7b9a217375a'::uuid,
  array['ca5b6d84-410d-4997-8ae2-78df5be83cea'::uuid],
  '2026-11-24'::date
);
```

After z04 the original and multi-single functions should yield identical slot counts. Opening hours on the garage calendar are not by themselves proof that a specific service-duration interval is bookable; the business-hour range and other blocks still apply.

## Diagnose the two-service November 24 example

Use this if **Tire service (60 min)** produces slots but **Tire service + Wheel alignment (120 min)** does not.

First run the signature check separately:

```sql
select to_regprocedure('public.garage_available_slots_multi(uuid,uuid[],date)') as installed;
```

If this returns NULL, the multi-service SQL is not installed: apply `z01` then `z04` (after the other prerequisite migrations).

If installed, run this read-only query to compare the original single-service schedule with two-service results:

```sql
with chosen as (
  select
    array_agg(id order by case when name = 'Tire service' then 0 else 1 end) as ids,
    count(*) as service_count,
    sum(duration_minutes) as total_minutes
  from public.provider_services
  where provider_id = 'f7224272-af80-4a6a-9ccf-d7b9a217375a'::uuid
    and name in ('Tire service', 'Wheel alignment')
    and is_active and pricing_type = 'fixed'
)
select chosen.service_count,chosen.total_minutes,
  (select count(*) from public.garage_available_slots(
    'f7224272-af80-4a6a-9ccf-d7b9a217375a'::uuid,
    chosen.ids[1], '2026-11-24'::date
  )) as first_service_free_starts,
  (select count(*) from public.garage_available_slots_multi(
    'f7224272-af80-4a6a-9ccf-d7b9a217375a'::uuid,
    chosen.ids, '2026-11-24'::date
  )) as combined_free_starts
from chosen;
```

Expected: `service_count=2`, `total_minutes=120` and, when operating hours and other bookings allow two continuous hours, `combined_free_starts > 0`. An SQL error or a count of zero is **not** automatically evidence that the garage is full. The date-and-time UI now shows the underlying PostgREST/SQL error and checks contiguous baseline slots to distinguish a database mismatch from a genuine lack of available time.

This Supabase project was not accessible through the connected account, so live SQL results have not been verified.

## Booking save verification and success popup

After completing step 4, the client now stays on that step when PostgreSQL rejects the write. A red **Booking not confirmed** message shows the server-returned reason and offers links to change the time or inspect appointments. The previous version incorrectly reset to step 2 and hid the error message. **No success popup is shown on failure**.

On successful server-action response with a UUID, MECATREX displays a confirmation dialog with the booking reference, selected services, fixed total price, duration, date and start time. **No towing** means confirmed immediately. **With towing** means the garage time is reserved but full confirmation is pending an accepted towing provider. The dialog directs the client to My appointments.

If the client or garage does not see a recently submitted booking, run this read-only query on the **same Supabase project** as `NEXT_PUBLIC_SUPABASE_URL`:

```sql
select id, client_name, garage_name, service_name, status,
       starts_at at time zone 'America/Toronto' as montreal_start,
       ends_at at time zone 'America/Toronto' as montreal_end,
       price_cents, created_at
from public.garage_bookings
where provider_id = 'f7224272-af80-4a6a-9ccf-d7b9a217375a'::uuid
order by created_at desc
limit 15;
```

If the row is absent, the reservation did not commit. The detailed error is now visible at step 4, and the server terminal logs the SQLSTATE, error message and request metadata. If the row exists but neither dashboard displays it, inspect RLS and dashboard data-loading errors instead. Do not keep resubmitting a booking while its result is uncertain; check My appointments first.

Outbound Brevo notifications now run via Next.js `after()` after the response, so an email delay cannot prevent the client from seeing a committed booking. Transactional in-app notifications remain part of the database write.

**Note:** The connected Supabase accounts available to the assistant do not include the MECATREX project shown in the user's screenshots, so this cannot be certified against live records here.
