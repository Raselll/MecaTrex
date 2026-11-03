-- Backfill MECATREX database records for Supabase Auth users that were created
-- before the MECATREX profile/provider triggers were installed.

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
)
select
  u.id,
  case
    when u.raw_user_meta_data ->> 'account_type' = 'provider'
      then 'provider'::public.mecatrex_account_type
    else 'client'::public.mecatrex_account_type
  end,
  trim(coalesce(u.raw_user_meta_data ->> 'first_name', '')),
  trim(coalesce(u.raw_user_meta_data ->> 'last_name', '')),
  coalesce(u.email, ''),
  trim(coalesce(u.raw_user_meta_data ->> 'primary_phone', '')),
  nullif(trim(coalesce(u.raw_user_meta_data ->> 'secondary_phone', '')), ''),
  case when u.raw_user_meta_data ->> 'terms_accepted' = 'true' then u.created_at else null end,
  case when u.raw_user_meta_data ->> 'privacy_accepted' = 'true' then u.created_at else null end,
  nullif(trim(coalesce(u.raw_user_meta_data ->> 'legal_version', '')), '')
from auth.users u
on conflict (id) do nothing;

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
)
select
  u.id,
  case
    when u.raw_user_meta_data ->> 'provider_type' = 'garage'
      then 'garage'::public.mecatrex_provider_type
    else 'towing'::public.mecatrex_provider_type
  end,
  trim(coalesce(u.raw_user_meta_data ->> 'business_name', '')),
  trim(coalesce(u.raw_user_meta_data ->> 'business_address', '')),
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'business_city'), ''), 'Montreal'),
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'business_province'), ''), 'Quebec'),
  trim(coalesce(u.raw_user_meta_data ->> 'business_postal_code', '')),
  coalesce(u.email, ''),
  trim(coalesce(u.raw_user_meta_data ->> 'primary_phone', '')),
  nullif(u.raw_user_meta_data ->> 'business_latitude', '')::double precision,
  nullif(u.raw_user_meta_data ->> 'business_longitude', '')::double precision,
  'pending'::public.mecatrex_provider_status,
  false
from auth.users u
where u.raw_user_meta_data ->> 'account_type' = 'provider'
  and u.raw_user_meta_data ->> 'provider_type' in ('garage', 'towing')
  and not exists (
    select 1
    from public.service_providers sp
    where sp.owner_id = u.id
  );
