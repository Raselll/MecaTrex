-- Run once in Supabase SQL Editor before using this version.
begin;
alter table public.service_providers add column if not exists payment_methods text[] not null default '{}';
alter table public.service_providers add column if not exists spoken_languages text[] not null default '{}';
-- Existing ownership RLS remains in effect. Grant only these new editable columns.
grant update (payment_methods, spoken_languages) on public.service_providers to authenticated;
grant select (payment_methods, spoken_languages) on public.service_providers to anon, authenticated;
commit;
notify pgrst, 'reload schema';
