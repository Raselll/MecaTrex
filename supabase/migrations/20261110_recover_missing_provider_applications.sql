-- MECATREX 20261110: repair missing garage/towing records for existing authenticated providers.
-- Run AFTER migrations 20261108 and 20261109. No data deletion or status elevation.
-- Existing approved, rejected and removed providers are never overwritten.

insert into public.service_providers (
  owner_id, provider_type, business_name, address_line1, city, province,
  postal_code, public_email, public_phone, status, is_listing_active
)
select u.id,
  (u.raw_user_meta_data->>'provider_type')::public.mecatrex_provider_type,
  trim(u.raw_user_meta_data->>'business_name'),
  trim(u.raw_user_meta_data->>'business_address'),
  coalesce(nullif(trim(u.raw_user_meta_data->>'business_city'),''),'Montreal'),
  coalesce(nullif(trim(u.raw_user_meta_data->>'business_province'),''),'Quebec'),
  trim(u.raw_user_meta_data->>'business_postal_code'),
  u.email,
  coalesce(nullif(trim(u.raw_user_meta_data->>'business_phone'),''),
    nullif(trim(u.raw_user_meta_data->>'primary_phone'),'')),
  'pending'::public.mecatrex_provider_status, false
from auth.users u
join public.profiles p on p.id=u.id
where p.account_type='provider'::public.mecatrex_account_type
  and u.raw_user_meta_data->>'provider_type' in ('garage','towing')
  and length(trim(coalesce(u.raw_user_meta_data->>'business_name','')))>0
  and length(trim(coalesce(u.raw_user_meta_data->>'business_address','')))>0
  and length(trim(coalesce(u.raw_user_meta_data->>'business_postal_code','')))>0
on conflict (owner_id) do nothing;

-- Existing providers created before the verification migration may lack
-- application details. Recover them without changing status or decisions.
insert into public.provider_applications
  (provider_id,business_neq,application_description,application_services)
select sp.id,
  nullif(trim(u.raw_user_meta_data->>'business_neq'),''),
  nullif(trim(u.raw_user_meta_data->>'application_description'),''),
  case when jsonb_typeof(u.raw_user_meta_data->'application_services')='array'
    then array(select jsonb_array_elements_text(u.raw_user_meta_data->'application_services'))
    else '{}'::text[] end
from public.service_providers sp
join auth.users u on u.id=sp.owner_id
on conflict (provider_id) do nothing;

-- Only a verified provider whose role is already recorded in public.profiles
-- may recover their own *missing* pending row. Never permits status elevation.
create or replace function public.ensure_my_provider_record()
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_metadata jsonb;
  v_email text;
begin
  if v_user_id is null then return false; end if;
  if not exists (select 1 from public.profiles p where p.id=v_user_id
      and p.account_type='provider'::public.mecatrex_account_type) then
    return false;
  end if;
  if exists (select 1 from public.service_providers sp where sp.owner_id=v_user_id)
    then return true;
  end if;
  select raw_user_meta_data,email into v_metadata,v_email
    from auth.users where id=v_user_id and email_confirmed_at is not null;
  if v_metadata is null
    or v_metadata->>'provider_type' not in ('garage','towing')
    or length(trim(coalesce(v_metadata->>'business_name','')))=0
    or length(trim(coalesce(v_metadata->>'business_address','')))=0
    or length(trim(coalesce(v_metadata->>'business_postal_code','')))=0
  then return false; end if;
  insert into public.service_providers (
    owner_id,provider_type,business_name,address_line1,city,province,postal_code,
    public_email,public_phone,status,is_listing_active
  ) values (
    v_user_id,(v_metadata->>'provider_type')::public.mecatrex_provider_type,
    trim(v_metadata->>'business_name'),trim(v_metadata->>'business_address'),
    coalesce(nullif(trim(v_metadata->>'business_city'),''),'Montreal'),
    coalesce(nullif(trim(v_metadata->>'business_province'),''),'Quebec'),
    trim(v_metadata->>'business_postal_code'),v_email,
    coalesce(nullif(trim(v_metadata->>'business_phone'),''),
             nullif(trim(v_metadata->>'primary_phone'),'')),
    'pending'::public.mecatrex_provider_status,false
  ) on conflict (owner_id) do nothing;
  return exists (select 1 from public.service_providers sp where sp.owner_id=v_user_id);
end;
$$;
revoke all on function public.ensure_my_provider_record() from public,anon,authenticated;
grant execute on function public.ensure_my_provider_record() to authenticated;

-- Verification query for SQL Editor (read-only):
-- select u.email,p.account_type,sp.id as provider_id,sp.status,pa.business_neq
-- from auth.users u left join public.profiles p on p.id=u.id
-- left join public.service_providers sp on sp.owner_id=u.id
-- left join public.provider_applications pa on pa.provider_id=sp.id
-- where p.account_type='provider'::public.mecatrex_account_type;
