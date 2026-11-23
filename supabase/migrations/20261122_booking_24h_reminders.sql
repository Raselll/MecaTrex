-- MECATREX — reliable 24-hour appointment reminders.
-- Apply once in the MECATREX Supabase SQL editor before enabling the scheduled job.
-- All records are private to the server. Client-visible notices use the
-- existing booking_notifications table and its existing recipient-only RLS.

create table if not exists public.booking_reminder_deliveries (
  booking_id uuid primary key references public.garage_bookings(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  email_sent_at timestamptz,
  notification_sent_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

alter table public.booking_reminder_deliveries enable row level security;

revoke all on table public.booking_reminder_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.booking_reminder_deliveries to service_role;

-- A retry must never create the same client notification twice.
create unique index if not exists booking_reminder_once_per_client_idx
  on public.booking_notifications(booking_id, recipient_id)
  where title = 'Appointment reminder: tomorrow';

notify pgrst, 'reload schema';
