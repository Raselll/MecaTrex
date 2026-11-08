# MECATREX Supabase setup

This branch uses Supabase for authentication, PostgreSQL data, row-level security, and provider image storage. Brevo remains the SMTP provider used by Supabase Auth for confirmation and password-reset emails.

## 1. Environment variables

Keep these values in `.env.local` locally and in the deployment environment later. Never commit secrets.

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Existing vehicle rendering
NEXT_PUBLIC_CAR_IMAGES_API_KEY=...

# Google Places server-side address search
GOOGLE_MAPS_API_KEY=...

# MECATREX business/admin transactional emails (server only)
BREVO_API_KEY=...
BREVO_SENDER_EMAIL=...
MECATREX_ADMIN_EMAIL=...
```

The Brevo SMTP password configured inside the Supabase dashboard is separate from `BREVO_API_KEY`. The SMTP credentials are used by Supabase Auth. `BREVO_API_KEY` is used only by MECATREX server code for provider/admin notifications.

## 2. Apply database migrations

The migrations must be applied in filename order:

1. `supabase/migrations/20261101_auth_provider_admin.sql`
2. `supabase/migrations/20261102_provider_listings_and_legal.sql`
3. `supabase/migrations/20261103_backfill_existing_auth_users.sql`
4. `supabase/migrations/20261104_sync_provider_publication.sql`
5. `supabase/migrations/20261105_provider_service_required_fields.sql`
6. `supabase/migrations/20261106_fixed_price_services_only.sql`
7. `supabase/migrations/20261107_booking_calendar_reviews.sql`
8. `supabase/migrations/20261108_provider_verification_and_removal.sql`
9. `supabase/migrations/20261109_remove_provider_description_requirement.sql`
10. `supabase/migrations/20261110_recover_missing_provider_applications.sql`

For the current development project, the simplest method is Supabase Dashboard -> SQL Editor -> New query, paste each migration in order, then Run.

The backfill migration is intentional. It creates MECATREX `profiles` / provider records for Supabase Auth users that existed before the database triggers were installed.

The publication-sync migration makes the provider flow automatic: an approved provider is published when an active service is added or activated, and the listing is hidden if its last active service is removed or deactivated. A provider can still manually unpublish a listing.

## 3. Create the MECATREX administrator

Public signup can never assign the admin role. First create and confirm a normal MECATREX account. After the migrations are installed, promote only the intended administrator from the Supabase SQL Editor:

```sql
update public.profiles
set account_type = 'admin'::public.mecatrex_account_type
where email = 'YOUR_ADMIN_EMAIL';
```

Verify the result:

```sql
select id, email, account_type
from public.profiles
where account_type = 'admin'::public.mecatrex_account_type;
```

Do not put an admin role in browser metadata and do not expose a service-role/secret Supabase key in the app.

## 4. Provider publication flow

1. A garage/towing company signs up as `provider`.
2. Supabase creates the provider with `pending` status.
3. The provider submits a business NEQ, a separate business phone, an optional website, planned services and service selections. These are captured by a secure trigger in a separate provider_applications record.
4. Pending providers can sign in only to view application status; creating/editing services and prices is locked in the UI and RLS.
5. The administrator reviews the complete application at `/admin` and checks the NEQ manually in the Quebec enterprise registry.
6. `Approve` runs the protected `admin_set_provider_status` database function. The database rejects missing NEQ, service categories, or business phone.
7. After approval, a provider can configure the business profile, service catalogue and exact fixed prices. No listing is automatically public without an active service.
8. Adding an active complete fixed-price service allows approved providers to publish their listing.
9. Removing or deactivating the last active service hides the listing. The provider can also manually unpublish at any time.
10. Only `approved + is_listing_active` providers are displayed publicly.
11. The admin can remove an approved provider. Removal immediately unpublishes and blocks booking, preserving historical reviews, bookings and decision notes.
12. `Garages ready to help` reads the real Supabase listing and service catalogue; the old demo garage cards are no longer used.

Only approved providers can edit their listing, upload images and manage services/prices. Pending, rejected or removed providers see an application-status page. They cannot change their approval status.

## 5. Provider images

Migration `20261102_provider_listings_and_legal.sql` creates the public `garage-images` Storage bucket.

- Public users can read listing images.
- Authenticated providers can upload/update/delete only inside their own user-ID folder.
- Maximum file size: 5 MB.
- Allowed formats: JPEG, PNG, WebP.

## 6. Legal consent

New signups must explicitly accept the MECATREX Terms of Service and Privacy Policy. The accepted legal document version is recorded in the profile database.

- `/terms`
- `/privacy`

The current documents are product/legal drafts for development. Before public launch, have Quebec counsel review the Terms and Privacy Policy and publish the designated privacy officer/business contact information required for the production organization.

## 7. Scheduling status

The homepage now supports an ASAP choice or a future date/time calendar. That selection is currently a search preference stored locally in the browser.

Garage-specific working hours, blocked time, appointment duration, booking confirmation, refusal rules, and conflict prevention belong to the next scheduling/booking phase and should be backed by database availability tables rather than hard-coded calendar slots.

## 8. Provider catalogue polish

- City and province are fixed to Montreal / Quebec during the initial launch; lat/long are retained internally for future distance-based search, not edited by providers.
- Preferred cover photo: 1600 x 900 pixels (16:9 landscape), minimum 1200 x 675, under 5 MB. The public card uses cover cropping.
- Service names can be chosen from the homepage categories or entered under "Other service".
- Service name, pricing method, CAD price, and estimated duration are all mandatory when adding or updating. Legacy quote-only services are preserved but must be completed before being edited.
- Migration 20261105 enforces the new data requirements on all new/updated rows without altering existing records.
- Website URLs accept a full http(s) link or a bare domain (normalized to HTTPS), then display as outbound links on public garage cards.

## 9. Forgot-password flow (Supabase Auth + Brevo SMTP)

No additional email provider or SQL migration is needed for this feature.

1. The user opens `/login` -> **Forgot password?** -> `/forgot-password`.
2. MECATREX calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL + "/auth/confirm?next=/reset-password" })`.
3. Supabase Auth generates a secure email link and Brevo (already configured as Supabase Custom SMTP) delivers it.
4. `/auth/confirm` exchanges the one-time code for a session, then redirects to `/reset-password`.
5. The user enters a new password, checks the live requirements, and the server calls `supabase.auth.updateUser({ password })`.
6. After a successful password update, the current session signs out and the user returns to `/login`.

**Supabase configuration**: Authentication -> URL Configuration -> Redirect URLs must allow your local confirmation URL. For local development, use `http://localhost:3000/**` (or the specific `http://localhost:3000/auth/confirm?next=/reset-password`) alongside your existing verification callback URL. Set `NEXT_PUBLIC_SITE_URL=http://localhost:3000` locally. Add matching production URLs before deployment.

For SSR/PKCE confirmation, request the reset email and open its link in the same browser profile so the code verifier is available. For alternative devices/email clients, use a token_hash-based recovery email template.

## 10. UX / booking status

The homepage timing picker opens in a viewport-safe modal, not inside the hero's clipped overflow container. Homepage Find garages and popular service cards navigate to `#garage-results`.

Every approved garage has a prominent **Book a service** CTA. It currently opens a clearly marked pre-booking message and contact links. It **does not create a reservation**. Real scheduling and booking transactions will be implemented in a subsequent phase.

Provider dashboards expose a **Save all updates** control to save the business profile and edits to existing services, in addition to existing per-row Save and Add service actions. This is not an atomic multi-table SQL transaction; failures are surfaced to the provider. The 24-hour application review copy is an operational target, not an automated SLA.

## 11. Fixed-price launch model and rolling six-month search calendar

- All **new** provider services use only `pricing_type = 'fixed'` (no hourly or starting-from price selection). The pricing control is read-only in the dashboard.
- The new migration `20261106_fixed_price_services_only.sql` adds a **NOT VALID** PostgreSQL check. It blocks inserting/updating non-fixed service pricing, but keeps existing legacy rows without silently changing their meaning.
- Providers must review any existing "From", "Hourly", or "Quote" price, then explicitly click "Confirm this as a fixed price" in the service editor and save. Legacy prices are hidden from public garage cards until confirmed. This prevents a "From $56" from being advertised as an exact $56.
- The public garage cards display only providers with at least one **active service with a valid fixed price and positive duration**.
- The service names/icons/descriptions shown in the homepage and provider selection all come from `lib/service-listing.ts`.
- The When date picker allows today through the **same calendar day six months later** (inclusive, with end-of-month clamping). For example, November 3, 2026 through May 3, 2027. The limit updates automatically as the user's local date changes.
- There are 48 half-hour choices per day, starting at **12:00 AM** and ending at **11:30 PM**. Past times on the current day are disabled.
- These are **requested** times, not promised garage opening hours or live availability. The booking calendar will enforce provider availability in the later scheduling phase.

## 12. Provider application and decision notifications (Brevo Transactional API)

**Important:** Supabase Custom SMTP / the Brevo **SMTP key** only delivers Supabase Auth emails (signup confirmation and password reset). It does **not** automatically deliver MECATREX business notifications. MECATREX calls the Brevo **transactional API** on the server for these emails.

1. Open [Brevo — SMTP & API](https://app.brevo.com/settings/keys/api). Create a Brevo **API key** (not the SMTP password). Keep it secret.
2. In `.env.local` (local development), add:
   ```env
   BREVO_API_KEY=your_brevo_api_key
   BREVO_SENDER_EMAIL=the_verified_sender_email_in_brevo
   MECATREX_ADMIN_EMAIL=the_address_that_receives_new_applications
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```
3. Restart `npm run dev` after modifying environment variables. For production, configure these three server-only variables in the hosting environment too.
4. **New provider signup:** once Supabase Auth successfully registers a new provider account, MECATREX sends an admin email with business name, Garage/Towing type, owner details, primary/secondary phone, postal address, and a direct link to `/admin?view=review`. The provider still has to click the Supabase confirmation email.
5. **Admin review:** changing the provider's status to Approved, Needs information, or Rejected sends the owner a Brevo email with the outcome, personal note and link back to `/account`. A reason is required for rejection or a request for information.
6. **Visibility:** if the Brevo API settings are missing, the admin dashboard shows a warning. If the provider-status database update succeeded but sending failed, the admin sees an explicit warning, and can click **Resend decision email** on the provider card after fixing Brevo.
7. A successful Brevo API call means **Brevo accepted the email request**, not that inbox delivery has been confirmed. Use **Brevo → Transactional → Logs** to inspect sent/delivered/bounced events. In local development, verify with a genuine test provider email address.

Never commit `.env.local`, never add `BREVO_API_KEY` to any `NEXT_PUBLIC_...` variable, and never paste the key into chat.

## 13. User account types and database verification

**Supabase Dashboard → Authentication → Users → Provider type** describes the authentication identity (such as Email or Google), **not** whether a MECATREX user is a client or garage.

MECATREX already stores the authoritative role securely in `public.profiles.account_type` (`client`, `provider`, `admin`). Providers have a corresponding row in `public.service_providers` with `provider_type` (`garage` / `towing`) and an approval `status` (`pending`, `approved`, `needs_information`, `rejected`).

To inspect the database, open **Supabase → SQL Editor**:

```sql
select
  p.email,
  p.first_name,
  p.last_name,
  p.account_type,
  sp.provider_type,
  sp.business_name,
  sp.status as application_status,
  sp.is_listing_active
from public.profiles as p
left join public.service_providers as sp on sp.owner_id = p.id
order by p.created_at desc;
```

The same distinction is available to admins in **MECATREX `/admin?view=accounts`**. This view uses the existing RLS-protected tables and does not expose personal account details publicly. No SQL migration is required for these dashboard and email changes.

## 14. Garage booking and synchronized calendar (20261107)

Run **20261107_booking_calendar_reviews.sql** in MECATREX Supabase SQL Editor **after migration 20261106**. The booking pages and provider account query require it. This migration is not automatically applied by `git pull`.

### Booking design and security

- **Only approved, published GARAGES** are bookable for now. Towing remains profile-only until its own dispatch workflow is designed.
- **Regular hours:** All 7 weekdays start **closed** on purpose. When creating a new provider account, both Garage and Towing owners may declare their actual opening hours in the signup form; the auth trigger initializes the 7 database rows from that saved choice. Existing providers and new accounts can change hours under `/account#garage-calendar`. Towing calendar/dispatch bookings are not enabled yet, but the towing portal can edit business hours. Times are always in **America/Toronto**. An overnight opening such as 22:00–03:00 is supported.
- **Date/time picker:** From today through exactly six calendar months ahead; available starts every 30 minutes, 00:00–23:30 if the garage is open. A service with duration 75 minutes reserves a real **75-minute interval** (e.g. 09:00–10:15).
- **Availability RPC:** `garage_available_slots(provider_id,service_id,day)` excludes closed hours, confirmed bookings, walk-ins and manually blocked intervals. Only slot times, not customers' identities, are exposed to public visitors.
- **Atomic booking:** `book_garage_service` rechecks availability under a provider-row lock and inserts both booking and in-app notifications. A GiST exclusion constraint also prevents overlapping confirmed bookings at DB level. The booking snapshots the fixed price, duration, garage, customer contact details and optional vehicle selected on the homepage.
- **No payment:** MECATREX currently shows the fixed service price and **Pay at garage**. Stripe/transaction fees will be a separate project stage.
- **Guest discovery:** Unauthenticated visitors can search garages, see prices and available slots. They sign in or sign up as **client** before final confirmation. The chosen garage/service is preserved in the return link.
- **Basic owner availability (included):** Owners edit weekly hours and select one or several dates on a simple Turo-inspired week view, then mark a whole future day or a precise time range unavailable; blocks can be removed. Existing walk-in blocks from the previous interface remain visible and removable. Creating an unavailable interval that overlaps a confirmed booking is rejected server-side; saving shorter hours that conflict with future confirmed appointments is also rejected. A *separate advanced operations calendar* (staff scheduling, multiple bays, walk-in management, etc.) is a potential future paid feature; the proposed CAD $100/month price is not yet enabled, advertised in-product, or charged.
- **Synchronization:** Both portals read the same PostgreSQL data. Dashboard bookings and notifications refresh about every 20 seconds and can be refreshed on demand. Database operations commit immediately. This is **near-real-time polling**, not a promise of instant push notifications.
- **Cancellation:** A client may cancel any future booking without penalty (no payment yet). A garage may cancel a future appointment at most **3 times total**. Each provider cancellation increases `service_providers.provider_cancellation_count`. After the third the database sets `booking_suspended=true` and `is_listing_active=false`, blocking further online bookings and hiding that garage until admin review. The provider can still access their account and must honor any remaining bookings. Future reinstatement/appeal workflow is not included.
- **Reviews:** One review per confirmed booking, submitted by the authenticated client **after the scheduled service end**. This does not yet verify physical attendance or whether service was completed. Approved public garages display ratings and comments; cancelled bookings cannot be reviewed.
- **Notifications:** Each booking/cancellation inserts an in-app notification for BOTH client and garage. Server actions also attempt confirmation/cancellation emails to both participants through Brevo API. In-app records are still created if Brevo is unconfigured or email delivery fails.
- **Personalization:** `profiles.accent_color` stores a small blue/teal/violet/slate palette per user. Only subtle decorative accents change. The main text contrast stays stable. Editing the color requires an authenticated owner and column-level update grant.

### What to test after installing the migration

1. Log in as an approved garage; navigate to `/account#garage-calendar`. All days begin **closed**. Set Monday to Friday 09:00–17:00 (or your chosen hours), then **Save business hours**.
2. Open the homepage in an incognito window, search **Oil change**, choose a garage and click **Book this garage**. Verify the correct fixed price and service duration.
3. Choose a day and confirm a client booking. Verify it appears in the client `My bookings` list and in the garage's calendar and both notifications. Check the email or Brevo Transactional Logs.
4. Try the same slot from another client account. It must NOT be possible to double-book overlapping time, even when the service takes 75 minutes. Two simultaneous confirm attempts must yield at most one success.
5. Add a 10:00–13:00 **Unavailable** block for an empty future day. Verify those start times disappear in the client view. Try adding a block on an already booked interval; the DB must reject it.
6. Book a walk-in in the garage portal and verify its time is unavailable online.
7. Change weekly business hours to exclude a future confirmed booking. The save must fail with a conflict warning rather than cancelling the client silently.
8. Cancel a future booking as provider; the provider dashboard must show **2 of 3 cancellations left**. After 3 total provider cancellations, the garage is suspended and becomes unbookable.
9. Cancel a future booking as client; the time becomes bookable again and the garage sees a cancellation notification.
10. After an appointment's scheduled end, leave a 1–5 star review in client account; it must appear in the garage's public booking profile. A review before service end or after cancellation must fail.

**Do not load real customer payments or real garage operations until these end-to-end tests pass.** Email acceptance via Brevo API does not guarantee inbox delivery. For reliable production delivery add retryable background notification jobs and sender-domain authentication.

### Verification SQL (Supabase SQL Editor)

```sql
select p.email, p.account_type, p.accent_color,
       sp.business_name, sp.provider_type, sp.booking_suspended,
       sp.provider_cancellation_count
from public.profiles p
left join public.service_providers sp on sp.owner_id = p.id
order by p.created_at desc;

select b.id, b.garage_name, b.client_name, b.service_name, b.duration_minutes,
       b.starts_at at time zone 'America/Toronto' as start_montreal,
       b.ends_at at time zone 'America/Toronto' as end_montreal,
       b.status, b.price_cents
from public.garage_bookings b
order by b.created_at desc limit 20;
```

### Operational limitations to address later

- No Stripe payments, deposits, cancellation fees, refund logic or dispute handling.
- No towing bookings or dispatch.
- No verified completed-service/vehicle identity check yet.
- No SMS or mobile push (only in-app and best-effort transactional email).
- No automated admin appeals/reinstatement after 3 garage cancellations.
- The client selects a service listed at a fixed price; vehicle compatibility is not yet enforced.

## 15. Provider application verification and removal (20261108)

Run `supabase/migrations/20261108_provider_verification_and_removal.sql` **in Supabase SQL Editor after migration 20261107** before trying the updated signup or admin pages. Git push/pull does not apply a database migration. The migration creates `provider_applications` and `provider_review_history`, captures signup verification metadata, enforces service editing after approval via RLS, and provides admin-only approval and soft-removal RPCs.

Admin email requires `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `MECATREX_ADMIN_EMAIL` server-only in `.env.local` (restart dev server after editing). The administrator can resend the detailed application email from the admin card if Brevo delivery fails. Supabase Auth confirmations use separate SMTP settings. Check Brevo transactional logs for actual delivery events. A provider application is saved even if email delivery fails. Existing provider applications without complete verification data remain unapproved until reviewed; do not invent NEQ values.

An admin removal is a soft removal: the account and bookings/reviews remain available in secure history, its listing becomes invisible, and the provider cannot publish or edit services. Review any outstanding future appointments and contact affected customers.


## 16. Provider application form simplification (20261109)

After the 20261108 migration, apply `supabase/migrations/20261109_remove_provider_description_requirement.sql`. A free-text application description is no longer required at signup or approval. The selected service categories remain required; an optional custom service can be supplied through **Other**. NEQ and business phone remain mandatory. The existing `application_description` column stays nullable for historical applications. Git pull does not execute this migration in the hosted Supabase project.


## 17. Verified signup and missing-provider recovery (20261110)

After pulling, apply `supabase/migrations/20261110_recover_missing_provider_applications.sql` in the MECATREX Supabase SQL Editor **after 20261108 and 20261109**. The migration backfills provider records that were missing for already-created Supabase Auth users, preserving all existing statuses and data. The new `ensure_my_provider_record` RPC permits a confirmed provider to repair a missing pending record only for themselves, never granting approval.

New providers receive a confirmation link; confirmation sends them to `/account?verified=1` with an application-under-review confirmation. Their account stays locked until an admin uses `/admin?view=review` to approve. New application notifications are sent by Brevo on signup and retried on email confirmation when the first attempt failed in the same browser. To receive alerts, set `MECATREX_ADMIN_EMAIL`, `BREVO_API_KEY` and `BREVO_SENDER_EMAIL` server-side. Brevo API acceptance is not delivery; check Brevo transactional logs and the admin resend control. Some cross-device confirmation links can trigger a duplicate admin alert; moderation remains idempotent in the database.

## 18. One-page admin dashboard and six themes (20261111)

After pulling the dashboard redesign, run `supabase/migrations/20261111_six_portal_themes.sql` once in Supabase SQL Editor. It expands the existing `profiles.accent_color` check constraint from four choices to six: blue, teal, violet, slate, rose and amber, without deleting or resetting any existing preference. Without it, the new rose/amber options cannot be saved.

When an admin signs in at `/account`, the app redirects directly to `/admin`. The admin page now contains all sections together: pending application shortcuts, complete provider review/moderation forms and the registered account roster. Dashboard cards are in-page anchor links rather than separate views; legacy `?view=review` and `?view=accounts` URLs still open the same one-page dashboard.

The account/admin theme updates immediately after successful Supabase save, and is restored on subsequent visits. CSS variables keep status colors and text contrast distinguishable, while customizing background, panel surfaces, links, section headers and main accents. On light backgrounds the existing MECATREX brand PNG is blended using CSS so its white rectangle no longer appears. The original full-resolution logo can optionally be replaced by a true transparent PNG in `public/mecatrex-logo-web.png` if a compatible brand asset is available.
