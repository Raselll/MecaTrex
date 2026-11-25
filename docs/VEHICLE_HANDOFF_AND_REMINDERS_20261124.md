# MECATREX — Vehicle drop-off, check-in, repair completion and pickup

## Deployment (required)

The code is pushed to the GitHub `main` branch. Pulling the code does NOT apply SQL or configure scheduled emails.

1. Open **Supabase SQL Editor** in the actual MECATREX project (check `NEXT_PUBLIC_SUPABASE_URL`).
2. Make a database backup before production schema changes.
3. Run the entire file `supabase/migrations/20261124_z06_visit_handoff_and_reminders.sql` **once**, after the existing garage booking and towing migrations.
4. The migration creates private, append-only photo storage, check-in records, server RPCs and a reminder queue; it does not delete or rewrite any existing booking.
5. Run `NOTIFY pgrst, 'reload schema';` if the functions are not immediately accessible.

Verify:

```sql
select
  to_regclass('public.booking_visits') as handoff_state,
  to_regclass('private.booking_handoff_codes') as handoff_codes,
  to_regclass('public.booking_reminder_jobs') as reminder_jobs,
  to_regprocedure('public.issue_garage_handoff_code(uuid)') as garage_code,
  to_regprocedure('public.confirm_vehicle_dropoff(uuid,text)') as client_dropoff,
  to_regprocedure('public.mark_vehicle_ready(uuid)') as garage_ready,
  to_regprocedure('public.claim_vehicle_ready_email(uuid)') as pickup_email,
  to_regprocedure('public.confirm_vehicle_pickup(uuid,boolean)') as client_pickup,
  to_regprocedure('public.claim_due_booking_reminders(integer)') as reminder_worker;
```

All values must be non-NULL.

## Full appointment workflow

**24-hour reminder** — 24 hours before the start, MECATREX queues a transactional email to the client. If the appointment was made less than 24 hours beforehand, it can be sent at the next scheduler run provided the appointment is still at least 30 minutes away. The email includes the garage address, service list, local Montréal time and an explanation of the handoff code. If towing is not yet accepted, the email says that clearly. Email dispatch is scheduled periodically rather than at exact-to-the-second delivery.

**Two hours before the appointment** — A handoff section unlocks on the client and garage dashboards. The garage's owner can reveal an 8-character unique code for that booking. The owner should share it with the client **only after the vehicle actually arrives**. Client selects *Yes, I dropped off the car*, types the code and submits. The database checks account ownership, booking status, the 2-hour gate, the code and the five-attempt limit. The code cannot be reused for a different booking.

**Optional evidence** — Once checked in, the client may upload up to six JPG/PNG/WebP photos under 5 MB each. A useful set: front, rear, left side, right side, dashboard/odometer and garage storefront. The photos are in a **private** Supabase Storage bucket, accessible to the booking client and garage. They are append-only (no public delete or overwrite). MECATREX does not verify photo capture location, GPS or authenticity. Photos do not constitute an insurance product or an admission of legal liability. A production privacy/retention policy remains necessary.

**Garage marks service complete** — After the code has been entered, the garage may click *Mark service completed*. The customer instantly receives an in-app notification that the car is ready. The garage then has two buttons: *Email client · car ready* (sends a Brevo transactional email once, retries after failure) and *Call client* (opens the phone dialer on supported devices using `tel:`).

**Client closes visit** — When the garage marks the vehicle ready, the client sees *Yes, I got the car* and *No, I haven't received it*. Yes closes the visit and notifies the garage. No retains the open status and notifies the garage, without registering a damage claim.

The original garage/towing reservation and payment logic remain intact. The check-in status is tracked separately in `booking_visits`, not by changing `garage_bookings.status`.

## Activate the automatic 24-hour email reminder

The repository already contains `.github/workflows/booking-reminders.yml`, scheduled every 15 minutes, and a protected server endpoint `/api/cron/booking-reminders`. This workflow CANNOT reach `localhost:3000` from GitHub Actions. A production deployment with an accessible **HTTPS** URL is required.

Configure these **GitHub Actions repository secrets** in Settings → Secrets and variables → Actions:

- `MECATREX_REMINDER_URL`: deployed public HTTPS **site origin**, without a trailing slash or endpoint path
- `MECATREX_CRON_SECRET`: a long, randomly generated shared secret

Configure the following **server-side deployment environment variables**, not `NEXT_PUBLIC_`:

- `MECATREX_CRON_SECRET`: exactly the **same** secret as in GitHub Actions
- `SUPABASE_SERVICE_ROLE_KEY`: MECATREX project's server-only service-role key (never expose this in client code)
- `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`: verified existing Brevo configuration

Ensure the deployment also has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` pointing at MECATREX. Do not paste secrets into commits or screenshots.

In GitHub → Actions → **MECATREX 24-hour booking reminders**, choose *Run workflow* to verify the worker. It should return `processed`, `sent`, and `failed`. The migration must be applied first; a missing secret now causes the job to fail visibly rather than silently skip.

Scheduled GitHub Actions are not guaranteed to fire on the exact minute. The database claim prevents routine duplicate emails, but any provider can experience operational delays. For strict delivery requirements, use a monitored production scheduler with retries, alerting and uptime checks.

Read-only email status:

```sql
select b.client_name,b.starts_at,b.status,
  r.state,r.attempts,r.sent_at,r.last_error
from public.garage_bookings b
left join public.booking_reminder_jobs r on r.booking_id=b.id
where b.status='confirmed'
order by b.starts_at asc limit 25;
```

## Smoke tests

1. With a test booking **more than 2 hours away**, neither client nor garage can check in early.
2. At **T−2 hours**, garage can reveal the code. A fake code fails (five wrong attempts maximum).
3. Share code from the garage to the client; the check-in succeeds and is visible to both.
4. Client uploads optional photos; check client+garage can see them, and a different account cannot.
5. Garage marks service completed; ready status and notification appear.
6. Garage sends pickup email and tests `Call client` link.
7. Client chooses *No, haven't received it*: garage sees an alert, visit stays open.
8. Client chooses *Yes, I got the car*: visit is closed and garage notified.
9. Schedule a safe test booking within 24 hours, run the reminder workflow, and confirm exactly one Brevo email and one reminder queue record. Re-run to check routine deduplication.
10. Cancel a separate test booking and ensure the reminder worker excludes it.

## Product constraints

A code shared by a garage is **not** proof of GPS location or guaranteed physical custody; the actual handoff still depends on both parties following the process. MECATREX does not arbitrate damage claims or issue insurance. A lawyer should review the garage/client terms, evidence retention policy and disclaimer before public release. A location-autocomplete API and payment/billing remain separate next phases.
