-- MECATREX: all newly created or edited garage services must have a fixed price.
--
-- Existing "From", "Hourly", or "Quote" rows are preserved intentionally:
-- their advertised amounts may NOT represent a final fixed price.
-- A provider must verify the amount in the dashboard and explicitly convert
-- each legacy service before it can be saved again or appear publicly.
--
-- NOT VALID skips checking existing rows at migration time while PostgreSQL
-- still enforces the constraint for all subsequent inserts/updates.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mecatrex_services_fixed_price_only'
      and conrelid = 'public.provider_services'::regclass
  ) then
    alter table public.provider_services
      add constraint mecatrex_services_fixed_price_only
      check (pricing_type = 'fixed') not valid;
  end if;
end;
$$;
