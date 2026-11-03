-- MECATREX provider listings, public services, legal consent, and garage media.
-- This migration is intentionally additive so it can be applied after
-- 20261101_auth_provider_admin.sql without recreating existing auth data.

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists legal_version text;

alter table public.service_providers
  add column if not exists business_description text,
  add column if not exists public_email text,
  add column if not exists public_phone text,
  add column if not exists website text,
  add column if not exists image_path text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists is_listing_active boolean not null default false;

-- Populate public contact defaults for existing providers from their account profile.
update public.service_providers sp
set
  public_email = coalesce(nullif(sp.public_email, ''), p.email),
  public_phone = coalesce(nullif(sp.public_phone, ''), p.primary_phone)
from public.profiles p
where p.id = sp.owner_id
  and (sp.public_email is null or sp.public_phone is null);

create table if not exists public.provider_services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.service_providers(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer,
  pricing_type text not null default 'fixed',
  duration_minutes integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_services_name_not_blank check (char_length(trim(name)) > 0),
  constraint provider_services_price_non_negative check (price_cents is null or price_cents >= 0),
  constraint provider_services_duration_positive check (duration_minutes is null or duration_minutes > 0),
  constraint provider_services_pricing_type check (pricing_type in ('fixed', 'from', 'hourly', 'quote'))
);

create index if not exists provider_services_provider_idx
  on public.provider_services(provider_id);

create index if not exists provider_services_public_idx
  on public.provider_services(provider_id, is_active);

create unique index if not exists provider_services_unique_name_idx
  on public.provider_services(provider_id, lower(name));

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.touch_updated_at() from public;

drop trigger if exists touch_service_providers_updated_at on public.service_providers;
create trigger touch_service_providers_updated_at
before update on public.service_providers
for each row execute function private.touch_updated_at();

drop trigger if exists touch_provider_services_updated_at on public.provider_services;
create trigger touch_provider_services_updated_at
before update on public.provider_services
for each row execute function private.touch_updated_at();

-- Replace the signup trigger so new accounts record legal consent and providers
-- start with usable public contact information + coordinates from Google Places.
create or replace function private.handle_new_mecatrex_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_account_type public.mecatrex_account_type;
  selected_provider_type public.mecatrex_provider_type;
begin
  if new.raw_user_meta_data ->> 'account_type' = 'provider' then
    selected_account_type := 'provider'::public.mecatrex_account_type;
  else
    selected_account_type := 'client'::public.mecatrex_account_type;
  end if;

  insert into public.profiles (
    id,
    account_type,
    first_name,
    last_name,
    email,
    primary_phone,
    secondary_phone,
    terms_accepted_at,
    privacy_accepted_at,
    legal_version
  ) values (
    new.id,
    selected_account_type,
    trim(coalesce(new.raw_user_meta_data ->> 'first_name', '')),
    trim(coalesce(new.raw_user_meta_data ->> 'last_name', '')),
    coalesce(new.email, ''),
    trim(coalesce(new.raw_user_meta_data ->> 'primary_phone', '')),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'secondary_phone', '')), ''),
    case when new.raw_user_meta_data ->> 'terms_accepted' = 'true' then now() else null end,
    case when new.raw_user_meta_data ->> 'privacy_accepted' = 'true' then now() else null end,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'legal_version', '')), '')
  );

  if selected_account_type = 'provider'::public.mecatrex_account_type then
    if new.raw_user_meta_data ->> 'provider_type' = 'garage' then
      selected_provider_type := 'garage'::public.mecatrex_provider_type;
    elsif new.raw_user_meta_data ->> 'provider_type' = 'towing' then
      selected_provider_type := 'towing'::public.mecatrex_provider_type;
    else
      raise exception 'Invalid provider type';
    end if;

    insert into public.service_providers (
      owner_id,
      provider_type,
      business_name,
      address_line1,
      city,
      province,
      postal_code,
      public_email,
      public_phone,
      latitude,
      longitude,
      status,
      is_listing_active
    ) values (
      new.id,
      selected_provider_type,
      trim(coalesce(new.raw_user_meta_data ->> 'business_name', '')),
      trim(coalesce(new.raw_user_meta_data ->> 'business_address', '')),
      trim(coalesce(new.raw_user_meta_data ->> 'business_city', '')),
      trim(coalesce(new.raw_user_meta_data ->> 'business_province', '')),
      trim(coalesce(new.raw_user_meta_data ->> 'business_postal_code', '')),
      coalesce(new.email, ''),
      trim(coalesce(new.raw_user_meta_data ->> 'primary_phone', '')),
      nullif(new.raw_user_meta_data ->> 'business_latitude', '')::double precision,
      nullif(new.raw_user_meta_data ->> 'business_longitude', '')::double precision,
      'pending'::public.mecatrex_provider_status,
      false
    );
  end if;

  return new;
end;
$$;

revoke all on function private.handle_new_mecatrex_user() from public;

alter table public.provider_services enable row level security;

-- Only approved + explicitly published provider rows are public.
drop policy if exists "Approved providers are public" on public.service_providers;
drop policy if exists "Published approved providers are public" on public.service_providers;
create policy "Published approved providers are public" on public.service_providers
for select to anon, authenticated
using (
  status = 'approved'::public.mecatrex_provider_status
  and is_listing_active = true
);

-- Providers can edit their own listing, but status/provider identity remain protected
-- through column-level privileges below.
drop policy if exists "Providers update own listing" on public.service_providers;
create policy "Providers update own listing" on public.service_providers
for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

revoke update on public.service_providers from authenticated;
grant update (
  business_name,
  address_line1,
  city,
  province,
  postal_code,
  business_description,
  public_email,
  public_phone,
  website,
  image_path,
  latitude,
  longitude,
  is_listing_active,
  updated_at
) on public.service_providers to authenticated;

-- Provider service catalogue policies.
drop policy if exists "Public reads active services" on public.provider_services;
create policy "Public reads active services" on public.provider_services
for select to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.service_providers sp
    where sp.id = provider_services.provider_id
      and sp.status = 'approved'::public.mecatrex_provider_status
      and sp.is_listing_active = true
  )
);

drop policy if exists "Providers read own services" on public.provider_services;
create policy "Providers read own services" on public.provider_services
for select to authenticated
using (
  exists (
    select 1
    from public.service_providers sp
    where sp.id = provider_services.provider_id
      and sp.owner_id = (select auth.uid())
  )
);

drop policy if exists "Providers create own services" on public.provider_services;
create policy "Providers create own services" on public.provider_services
for insert to authenticated
with check (
  exists (
    select 1
    from public.service_providers sp
    where sp.id = provider_services.provider_id
      and sp.owner_id = (select auth.uid())
  )
);

drop policy if exists "Providers update own services" on public.provider_services;
create policy "Providers update own services" on public.provider_services
for update to authenticated
using (
  exists (
    select 1
    from public.service_providers sp
    where sp.id = provider_services.provider_id
      and sp.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.service_providers sp
    where sp.id = provider_services.provider_id
      and sp.owner_id = (select auth.uid())
  )
);

drop policy if exists "Providers delete own services" on public.provider_services;
create policy "Providers delete own services" on public.provider_services
for delete to authenticated
using (
  exists (
    select 1
    from public.service_providers sp
    where sp.id = provider_services.provider_id
      and sp.owner_id = (select auth.uid())
  )
);

drop policy if exists "Admins read all provider services" on public.provider_services;
create policy "Admins read all provider services" on public.provider_services
for select to authenticated using (private.is_admin());

grant select on public.provider_services to anon, authenticated;
grant insert, update, delete on public.provider_services to authenticated;

-- Admin-only status workflow. This is the only supported path for approving,
-- requesting more information, or rejecting a provider. Approval automatically
-- publishes a provider that already prepared at least one active service.
create or replace function public.admin_set_provider_status(
  p_provider_id uuid,
  p_status public.mecatrex_provider_status,
  p_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_admin() then
    raise exception 'Not authorized';
  end if;

  update public.service_providers
  set
    status = p_status,
    is_listing_active = case
      when p_status = 'approved'::public.mecatrex_provider_status then exists (
        select 1
        from public.provider_services ps
        where ps.provider_id = p_provider_id
          and ps.is_active = true
      )
      else false
    end,
    updated_at = now()
  where id = p_provider_id;

  if not found then
    raise exception 'Provider not found';
  end if;

  insert into public.provider_admin_notes(provider_id, message, updated_at)
  values (p_provider_id, nullif(trim(coalesce(p_message, '')), ''), now())
  on conflict (provider_id)
  do update set
    message = excluded.message,
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.admin_set_provider_status(uuid, public.mecatrex_provider_status, text) from public;
revoke all on function public.admin_set_provider_status(uuid, public.mecatrex_provider_status, text) from anon;
grant execute on function public.admin_set_provider_status(uuid, public.mecatrex_provider_status, text) to authenticated;

-- Public garage image bucket. Reads are public because the images are listing media;
-- writes are restricted to the authenticated provider's own UUID folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'garage-images',
  'garage-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Garage images are publicly readable" on storage.objects;
create policy "Garage images are publicly readable" on storage.objects
for select to anon, authenticated
using (bucket_id = 'garage-images');

drop policy if exists "Providers upload own garage images" on storage.objects;
create policy "Providers upload own garage images" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'garage-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Providers update own garage images" on storage.objects;
create policy "Providers update own garage images" on storage.objects
for update to authenticated
using (
  bucket_id = 'garage-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'garage-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Providers delete own garage images" on storage.objects;
create policy "Providers delete own garage images" on storage.objects
for delete to authenticated
using (
  bucket_id = 'garage-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
