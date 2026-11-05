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
3. The provider can prepare the business profile, image, coordinates, and service catalogue while pending.
4. An administrator reviews the application at `/admin`.
5. `Approve` runs the protected `admin_set_provider_status` database function.
6. If at least one active service is already listed, approval publishes the listing automatically.
7. If an already-approved provider later adds or activates its first service, the listing publishes automatically.
8. Removing/deactivating the last active service hides the listing. The provider can also manually unpublish at any time.
9. Only `approved + is_listing_active` providers are readable by the public homepage.
10. `Garages ready to help` reads the real Supabase listing and service catalogue; the old demo garage cards are no longer used.

Providers can hide their own listing, edit their public business information, upload a garage image, and manage services/prices. They cannot change their approval status.

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
