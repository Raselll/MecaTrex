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

For the current development project, the simplest method is Supabase Dashboard -> SQL Editor -> New query, paste each migration in order, then Run.

The backfill migration is intentional. It creates MECATREX `profiles` / provider records for Supabase Auth users that existed before the database triggers were installed.

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
6. If at least one active service is already listed, approval publishes the listing automatically. Otherwise the approved provider can publish it from `/account` after adding a service.
7. Only `approved + is_listing_active` providers are readable by the public homepage.
8. `Garages ready to help` reads the real Supabase listing and service catalogue; the old demo garage cards are no longer used.

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
