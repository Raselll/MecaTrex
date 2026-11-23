# MECATREX — activate 24-hour booking reminders

The reminder code is included in the repository, but production dispatch
requires a deployed HTTPS site and a scheduled trigger. A GitHub push alone
does not run the scheduler for a site hosted only at localhost:3000.

## 1. Database

Run `supabase/migrations/20261122_booking_24h_reminders.sql` once
in the **MECATREX** project's Supabase SQL Editor.
It creates a private, RLS-protected reminder-delivery table and a
unique index to avoid duplicate client notifications.

## 2. Production server environment (never use NEXT_PUBLIC_ for secrets)

- `NEXT_PUBLIC_SUPABASE_URL` — current MECATREX project URL
- `SUPABASE_SECRET_KEY` **or** `SUPABASE_SERVICE_ROLE_KEY` — a server-only Supabase secret
- `BREVO_API_KEY` — server-only API key (must have transactional email access)
- `BREVO_SENDER_EMAIL` — verified sender address
- `MECATREX_CRON_SECRET` — a strong, random secret
- `NEXT_PUBLIC_SITE_URL` — publicly accessible HTTPS production URL (for email links)

Do not commit any of these secrets to Git or expose service/secret keys to the client.

## 3. GitHub Actions repository secrets

In GitHub → Repository settings → Secrets and variables → Actions,
add the following **repository secrets**:

- `MECATREX_REMINDER_URL`: the HTTPS origin of the deployed site (no path)
- `MECATREX_CRON_SECRET`: exactly the same value as in the deployed server environment

The workflow `.github/workflows/booking-reminders.yml` invokes
`GET /api/cron/booking-reminders` every 15 minutes. Without these two
GitHub secrets the workflow skips dispatch. GitHub scheduled workflows can
run late during high load, so reminders are approximately 24 hours before
a booking, not guaranteed to the second.

## 4. What customers see

The server sends a Brevo reminder and adds an unread row in
`booking_notifications`. The existing notification bell picks it up, and
the customer sees a one-time dialog in the account for each unread reminder.
Closing the dialog marks the notice as read.

Only confirmed reservations with a start time between 1 and 24 hours
in the future are eligible. A cancelled booking is rechecked before dispatch.
Delivery attempts are recorded independently so a failed email can retry.

## 5. Test

In GitHub Actions → MECATREX 24-hour booking reminders →
Run workflow, run a manual test after you have:

1. Applied the SQL migration.
2. Deployed the site with the environment variables above.
3. Created a test confirmed booking with a start within the next 24 hours.

Then check the client email, account notification and delivery records.
The native iOS sound/push-notification system is a separate future feature.
