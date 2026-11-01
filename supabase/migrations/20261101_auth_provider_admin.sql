create schema if not exists private;

do $$
begin
  create type public.mecatrex_account_type as enum ('client', 'provider', 'admin');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.mecatrex_provider_type as enum ('garage', 'towing');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.mecatrex_provider_status as enum ('pending', 'approved', 'needs_information', 'rejected');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  account_type public.mecatrex_account_type not null default 'client',
  first_name text not null,
  last_name text not null,
  email text not null,
  primary_phone text not null,
  secondary_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_first_name_not_blank check (char_length(trim(first_name)) > 0),
  constraint profiles_last_name_not_blank check (char_length(trim(last_name)) > 0),
  constraint profiles_phone_not_blank check (char_length(trim(primary_phone)) > 0)
);

create table if not exists public.service_providers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  provider_type public.mecatrex_provider_type not null,
  business_name text not null,
  address_line1 text not null,
  city text not null,
  province text not null,
  postal_code text not null,
  status public.mecatrex_provider_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_business_name_not_blank check (char_length(trim(business_name)) > 0),
  constraint provider_address_not_blank check (char_length(trim(address_line1)) > 0)
);

create index if not exists service_providers_status_idx on public.service_providers(status);
create index if not exists service_providers_type_idx on public.service_providers(provider_type);

create table if not exists public.provider_admin_notes (
  provider_id uuid primary key references public.service_providers(id) on delete cascade,
  message text,
  updated_at timestamptz not null default now()
);

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and account_type = 'admin'::public.mecatrex_account_type
  );
$$;

revoke all on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

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
    id, account_type, first_name, last_name, email, primary_phone, secondary_phone
  ) values (
    new.id,
    selected_account_type,
    trim(coalesce(new.raw_user_meta_data ->> 'first_name', '')),
    trim(coalesce(new.raw_user_meta_data ->> 'last_name', '')),
    coalesce(new.email, ''),
    trim(coalesce(new.raw_user_meta_data ->> 'primary_phone', '')),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'secondary_phone', '')), '')
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
      owner_id, provider_type, business_name, address_line1, city, province, postal_code, status
    ) values (
      new.id,
      selected_provider_type,
      trim(coalesce(new.raw_user_meta_data ->> 'business_name', '')),
      trim(coalesce(new.raw_user_meta_data ->> 'business_address', '')),
      trim(coalesce(new.raw_user_meta_data ->> 'business_city', '')),
      trim(coalesce(new.raw_user_meta_data ->> 'business_province', '')),
      trim(coalesce(new.raw_user_meta_data ->> 'business_postal_code', '')),
      'pending'::public.mecatrex_provider_status
    );
  end if;

  return new;
end;
$$;

revoke all on function private.handle_new_mecatrex_user() from public;

drop trigger if exists on_auth_user_created_mecatrex on auth.users;
create trigger on_auth_user_created_mecatrex
after insert on auth.users
for each row execute function private.handle_new_mecatrex_user();

alter table public.profiles enable row level security;
alter table public.service_providers enable row level security;
alter table public.provider_admin_notes enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles
for select to authenticated using (id = (select auth.uid()));

drop policy if exists "Admins read profiles" on public.profiles;
create policy "Admins read profiles" on public.profiles
for select to authenticated using (private.is_admin());

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

grant select on public.profiles to authenticated;
grant update (first_name, last_name, primary_phone, secondary_phone, updated_at) on public.profiles to authenticated;

drop policy if exists "Approved providers are public" on public.service_providers;
create policy "Approved providers are public" on public.service_providers
for select to anon, authenticated
using (status = 'approved'::public.mecatrex_provider_status);

drop policy if exists "Providers read own application" on public.service_providers;
create policy "Providers read own application" on public.service_providers
for select to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "Admins read all providers" on public.service_providers;
create policy "Admins read all providers" on public.service_providers
for select to authenticated using (private.is_admin());

drop policy if exists "Admins update providers" on public.service_providers;
create policy "Admins update providers" on public.service_providers
for update to authenticated using (private.is_admin()) with check (private.is_admin());

grant select on public.service_providers to anon, authenticated;
grant update on public.service_providers to authenticated;

drop policy if exists "Providers read own admin message" on public.provider_admin_notes;
create policy "Providers read own admin message" on public.provider_admin_notes
for select to authenticated using (
  exists (
    select 1 from public.service_providers
    where service_providers.id = provider_admin_notes.provider_id
      and service_providers.owner_id = (select auth.uid())
  )
);

drop policy if exists "Admins read provider messages" on public.provider_admin_notes;
create policy "Admins read provider messages" on public.provider_admin_notes
for select to authenticated using (private.is_admin());

drop policy if exists "Admins create provider messages" on public.provider_admin_notes;
create policy "Admins create provider messages" on public.provider_admin_notes
for insert to authenticated with check (private.is_admin());

drop policy if exists "Admins update provider messages" on public.provider_admin_notes;
create policy "Admins update provider messages" on public.provider_admin_notes
for update to authenticated using (private.is_admin()) with check (private.is_admin());

grant select, insert, update on public.provider_admin_notes to authenticated;
