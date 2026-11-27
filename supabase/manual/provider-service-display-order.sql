-- Run in Supabase SQL Editor before using this version.
begin;
alter table public.service_providers add column if not exists service_display_order uuid[] not null default '{}';
grant update (service_display_order) on public.service_providers to authenticated;
grant select (service_display_order) on public.service_providers to anon, authenticated;
commit;
notify pgrst, 'reload schema';
