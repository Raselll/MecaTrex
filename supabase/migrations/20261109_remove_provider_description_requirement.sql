-- MECATREX 20261109: applicant free-text descriptions are no longer mandatory.
-- Apply AFTER 20261108_provider_verification_and_removal.sql.
-- Preserves all existing users, businesses, service applications and review history.
-- Keeping the historical nullable application_description column is intentional.

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
       or cardinality(application.application_services) = 0
       or nullif(trim(coalesce(target.public_phone,'')),'') is null then
      raise exception 'Application incomplete: NEQ, business phone and offered services are required.';
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

-- Preserve admin-only access to moderation through the authenticated, role-checked RPC.
revoke all on function public.admin_set_provider_status(uuid, public.mecatrex_provider_status, text) from public, anon, authenticated;
grant execute on function public.admin_set_provider_status(uuid, public.mecatrex_provider_status, text) to authenticated;
