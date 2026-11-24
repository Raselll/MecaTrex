# MECATREX — Multi-service booking, cancellation policy, towing dispatch

## Database deployment (required before using the updated website)
The web code now calls new PostgreSQL functions. **A Git pull alone does not install SQL migrations.**
Apply these scripts to the MECATREX Supabase project in SQL Editor, in order:

1. Ensure the existing garage booking migration has been applied: `supabase/migrations/20261107_booking_calendar_reviews.sql`
2. Ensure the original towing dispatch migration has been applied: `supabase/migrations/20261123_towing_requests_and_dispatch.sql`
3. Apply `supabase/migrations/20261123_z01_multi_service_bookings.sql`
4. Apply `supabase/migrations/20261123_z02_booking_cancellation_limits.sql`
5. Apply `supabase/migrations/20261123_z03_towing_dispatch_confirmation.sql`

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
