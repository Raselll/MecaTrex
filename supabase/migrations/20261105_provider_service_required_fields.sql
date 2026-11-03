-- MECATREX launch validation: newly inserted/edited services must be fully priced
-- and have a positive estimated duration. Existing rows remain untouched.
-- NOT VALID protects legacy quote-only services from a failed deployment,
-- while still enforcing the constraint on every new insert and updated row.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mecatrex_service_complete_required'
      and conrelid = 'public.provider_services'::regclass
  ) then
    alter table public.provider_services
      add constraint mecatrex_service_complete_required
      check (
        price_cents is not null
        and price_cents >= 0
        and duration_minutes is not null
        and duration_minutes > 0
        and pricing_type in ('fixed', 'from', 'hourly')
      ) not valid;
  end if;
end;
$$;

-- For the initial Montreal-only launch, providers cannot move listings
-- to another city/province through a direct database request.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mecatrex_montreal_launch_region'
      and conrelid = 'public.service_providers'::regclass
  ) then
    alter table public.service_providers
      add constraint mecatrex_montreal_launch_region
      check (city = 'Montreal' and province = 'Quebec') not valid;
  end if;
end;
$$;
