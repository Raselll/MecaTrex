begin;
create table if not exists public.customer_offer_preferences(client_id uuid primary key references public.profiles(id) on delete cascade, enabled boolean not null default false, unsubscribe_token uuid not null unique default gen_random_uuid(), updated_at timestamptz not null default now());
create table if not exists public.customer_offer_sends(id uuid primary key default gen_random_uuid(),provider_id uuid not null references public.service_providers(id) on delete cascade,client_id uuid not null references public.profiles(id) on delete cascade,day date not null,unique(provider_id,client_id,day));
alter table public.customer_offer_preferences enable row level security;
alter table public.customer_offer_sends enable row level security;
revoke all on public.customer_offer_preferences,public.customer_offer_sends from anon,authenticated;
grant select,insert,update,delete on public.customer_offer_preferences,public.customer_offer_sends to service_role;
notify pgrst,'reload schema';
commit;
