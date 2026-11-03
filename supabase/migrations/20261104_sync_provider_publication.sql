-- Keep provider publication intuitive as providers manage their service catalogue.
-- Approved providers automatically publish when they add/activate a service.
-- If the last active service is removed/deactivated, the listing is hidden.
-- Manual unpublish remains respected when services are only edited without
-- changing their active state.

create or replace function private.sync_provider_publication_from_services()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_provider_id uuid;
  provider_is_approved boolean;
begin
  if tg_op = 'DELETE' then
    target_provider_id := old.provider_id;
  else
    target_provider_id := new.provider_id;
  end if;

  select (status = 'approved'::public.mecatrex_provider_status)
  into provider_is_approved
  from public.service_providers
  where id = target_provider_id;

  if not coalesce(provider_is_approved, false) then
    update public.service_providers
    set is_listing_active = false
    where id = target_provider_id
      and is_listing_active = true;

    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' and new.is_active then
    update public.service_providers
    set is_listing_active = true
    where id = target_provider_id;
  elsif tg_op = 'UPDATE' and old.is_active is distinct from new.is_active then
    if new.is_active then
      update public.service_providers
      set is_listing_active = true
      where id = target_provider_id;
    elsif not exists (
      select 1
      from public.provider_services ps
      where ps.provider_id = target_provider_id
        and ps.is_active = true
        and ps.id <> new.id
    ) then
      update public.service_providers
      set is_listing_active = false
      where id = target_provider_id;
    end if;
  elsif tg_op = 'DELETE' and old.is_active and not exists (
    select 1
    from public.provider_services ps
    where ps.provider_id = target_provider_id
      and ps.is_active = true
  ) then
    update public.service_providers
    set is_listing_active = false
    where id = target_provider_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_provider_publication_from_services() from public;

drop trigger if exists sync_provider_publication_from_services on public.provider_services;
create trigger sync_provider_publication_from_services
after insert or update or delete on public.provider_services
for each row execute function private.sync_provider_publication_from_services();
