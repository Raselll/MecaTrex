-- MECATREX provider applicant verification, post-approval service access and reversible removal.
-- Apply AFTER 20261107_booking_calendar_reviews.sql. No existing accounts are deleted.

alter table public.service_providers
  add column if not exists is_removed boolean not null default false;

create table if not exists public.provider_applications (
  provider_id uuid primary key references public.service_providers(id) on delete cascade,
  business_neq text,
  application_description text,
  application_services text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  constraint provider_applications_neq_format check (business_neq is null or business_neq ~ '^[0-9]{10}$')
);

-- Capture public contact fields from the signed-up user's submitted form.
-- Metadata is only input data, never an authorization source.
create or replace function private.populate_provider_contact()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare meta jsonb;
begin
  select raw_user_meta_data into meta from auth.users where id = new.owner_id;
  if meta is null then return new; end if;
  new.public_phone := coalesce(nullif(trim(meta->>'business_phone'),''),new.public_phone);
  new.website := coalesce(nullif(trim(meta->>'business_website'),''),new.website);
  new.business_description := coalesce(nullif(trim(meta->>'application_description'),''),new.business_description);
  return new;
end;
$$;
revoke all on function private.populate_provider_contact() from public;

drop trigger if exists populate_provider_contact on public.service_providers;
create trigger populate_provider_contact before insert on public.service_providers
for each row execute function private.populate_provider_contact();

-- Make every application durable in Postgres even if its email notification fails.
-- Also backfill applications made before the new migration was installed.
insert into public.provider_applications (provider_id,business_neq,application_description,application_services)
select sp.id,
  nullif(trim(u.raw_user_meta_data->>'business_neq'),''),
  nullif(trim(u.raw_user_meta_data->>'application_description'),''),
  case when jsonb_typeof(u.raw_user_meta_data->'application_services')='array'
    then array(select jsonb_array_elements_text(u.raw_user_meta_data->'application_services'))
    else '{}'::text[] end
from public.service_providers sp
join auth.users u on u.id=sp.owner_id
on conflict (provider_id) do nothing;

create or replace function private.capture_provider_application()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare meta jsonb;
begin
  select raw_user_meta_data into meta from auth.users where id=new.owner_id;
  insert into public.provider_applications (provider_id,business_neq,application_description,application_services)
  values (
    new.id,
    nullif(trim(meta->>'business_neq'),''),
    nullif(trim(meta->>'application_description'),''),
    case when jsonb_typeof(meta->'application_services')='array'
      then array(select jsonb_array_elements_text(meta->'application_services'))
      else '{}'::text[] end
  );
  return new;
end;
$$;
revoke all on function private.capture_provider_application() from public;

drop trigger if exists capture_provider_application on public.service_providers;
create trigger capture_provider_application after insert on public.service_providers
for each row execute function private.capture_provider_application();

alter table public.provider_applications enable row level security;
drop policy if exists "Admins review provider applications" on public.provider_applications;
create policy "Admins review provider applications" on public.provider_applications
  for select to authenticated using (private.is_admin());
drop policy if exists "Owners read own provider applications" on public.provider_applications;
create policy "Owners read own provider applications" on public.provider_applications
  for select to authenticated using (
    exists(select 1 from public.service_providers sp
      where sp.id=provider_id and sp.owner_id=(select auth.uid()))
  );
grant select on public.provider_applications to authenticated;
revoke insert,update,delete on public.provider_applications from authenticated,anon;

-- Pending and removed providers cannot edit or re-activate the business listing.
drop policy if exists "Providers update own listing" on public.service_providers;
create policy "Providers update own listing" on public.service_providers
  for update to authenticated
  using (owner_id = (select auth.uid()) and status='approved'::public.mecatrex_provider_status and not is_removed)
  with check (owner_id = (select auth.uid()) and status='approved'::public.mecatrex_provider_status and not is_removed);

-- Deny creating, editing or deleting services until approval (also enforced by the UI).
-- Even a direct API call is blocked for pending, rejected or removed providers.
drop policy if exists "Providers create own services" on public.provider_services;
create policy "Providers create own services" on public.provider_services
  for insert to authenticated with check (
    exists (select 1 from public.service_providers sp
      where sp.id=provider_id and sp.owner_id=(select auth.uid())
        and sp.status='approved'::public.mecatrex_provider_status and not sp.is_removed)
  );
drop policy if exists "Providers update own services" on public.provider_services;
create policy "Providers update own services" on public.provider_services
  for update to authenticated
  using (
    exists (select 1 from public.service_providers sp
      where sp.id=provider_id and sp.owner_id=(select auth.uid())
        and sp.status='approved'::public.mecatrex_provider_status and not sp.is_removed)
  )
  with check (
    exists (select 1 from public.service_providers sp
      where sp.id=provider_id and sp.owner_id=(select auth.uid())
        and sp.status='approved'::public.mecatrex_provider_status and not sp.is_removed)
  );
drop policy if exists "Providers delete own services" on public.provider_services;
create policy "Providers delete own services" on public.provider_services
  for delete to authenticated using (
    exists (select 1 from public.service_providers sp
      where sp.id=provider_id and sp.owner_id=(select auth.uid())
        and sp.status='approved'::public.mecatrex_provider_status and not sp.is_removed)
  );

-- Audit admin decisions; preserve history and bookings after removal.
create table if not exists public.provider_review_history (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.service_providers(id) on delete cascade,
  admin_id uuid not null references auth.users(id),
  decision text not null check (decision in ('approved','needs_information','rejected','removed')),
  message text,
  created_at timestamptz not null default now()
);
alter table public.provider_review_history enable row level security;
drop policy if exists "Admins read provider review history" on public.provider_review_history;
create policy "Admins read provider review history" on public.provider_review_history
  for select to authenticated using (private.is_admin());
grant select on public.provider_review_history to authenticated;
revoke insert,update,delete on public.provider_review_history from authenticated,anon;

-- Admin approval requires a complete application. The NEQ must still be
-- VERIFIED MANUALLY by an administrator in Quebec's enterprise registry.
create or replace function public.admin_set_provider_status(
  p_provider_id uuid,
  p_status public.mecatrex_provider_status,
  p_message text default null
) returns void language plpgsql security definer set search_path = ''
as $$
declare
  target public.service_providers%rowtype;
  application public.provider_applications%rowtype;
  comment text := nullif(trim(coalesce(p_message,'')),'');
begin
  if (select auth.uid()) is null or not private.is_admin() then
    raise exception 'Not authorized';
  end if;
  if p_status = 'pending'::public.mecatrex_provider_status then
    raise exception 'Invalid decision';
  end if;
  if p_status in ('rejected'::public.mecatrex_provider_status,'needs_information'::public.mecatrex_provider_status)
     and comment is null then
    raise exception 'Provide a reason for the applicant';
  end if;

  select * into target from public.service_providers where id=p_provider_id for update;
  if not found then raise exception 'Provider not found'; end if;
  if target.is_removed then raise exception 'This business was removed from MECATREX and cannot be approved again.'; end if;
  if p_status = 'approved'::public.mecatrex_provider_status then
    select * into application from public.provider_applications where provider_id=p_provider_id;
    if application.business_neq is null or application.business_neq !~ '^[0-9]{10}$'
       or length(trim(coalesce(application.application_description,''))) < 30
       or cardinality(application.application_services) = 0
       or nullif(trim(coalesce(target.public_phone,'')),'') is null then
      raise exception 'Application incomplete: NEQ, business phone, description and offered services are required.';
    end if;
  end if;

  update public.service_providers
  set status=p_status,
      is_listing_active=case when p_status='approved'::public.mecatrex_provider_status
        then exists(select 1 from public.provider_services ps
          where ps.provider_id=p_provider_id and ps.is_active=true
            and ps.pricing_type='fixed' and ps.price_cents is not null and ps.duration_minutes>0)
        else false end,
      updated_at=now()
  where id=p_provider_id;

  insert into public.provider_admin_notes(provider_id,message,updated_at)
  values (p_provider_id,comment,now())
  on conflict(provider_id) do update set message=excluded.message,updated_at=excluded.updated_at;
  insert into public.provider_review_history(provider_id,admin_id,decision,message)
  values (p_provider_id,auth.uid(),p_status::text,comment);
end;
$$;
revoke all on function public.admin_set_provider_status(uuid,public.mecatrex_provider_status,text) from public,anon,authenticated;
grant execute on function public.admin_set_provider_status(uuid,public.mecatrex_provider_status,text) to authenticated;

-- Soft-remove fraudulent or problematic providers: immediately unpublish,
-- prevent future bookings and price changes, retain past bookings/reviews.
create or replace function public.admin_remove_service_provider(
  p_provider_id uuid, p_reason text
) returns void language plpgsql security definer set search_path = ''
as $$
declare
  comment text := nullif(trim(coalesce(p_reason,'')),'');
begin
  if (select auth.uid()) is null or not private.is_admin() then raise exception 'Not authorized'; end if;
  if comment is null or length(comment)<10 then raise exception 'A removal reason of at least 10 characters is required'; end if;
  update public.service_providers
  set status='rejected'::public.mecatrex_provider_status,
      is_listing_active=false,is_removed=true,booking_suspended=true,updated_at=now()
  where id=p_provider_id and not is_removed;
  if not found then raise exception 'Provider missing or already removed'; end if;
  insert into public.provider_admin_notes(provider_id,message,updated_at)
  values (p_provider_id,comment,now())
  on conflict(provider_id) do update set message=excluded.message,updated_at=excluded.updated_at;
  insert into public.provider_review_history(provider_id,admin_id,decision,message)
  values (p_provider_id,auth.uid(),'removed',comment);
end;
$$;
revoke all on function public.admin_remove_service_provider(uuid,text) from public,anon,authenticated;
grant execute on function public.admin_remove_service_provider(uuid,text) to authenticated;
