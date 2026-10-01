-- 0020_booking_reminders.sql
-- MIRILUXE booking reminders: confirmation + 48h + 24h emails.
--
-- The hourly trigger is Vercel Cron (see vercel.json -> /api/cron/booking-reminders),
-- which injects the Authorization: Bearer $CRON_SECRET header automatically on Pro.
-- No pg_cron / pg_net / vault secret is needed.

-- 1) Tracking columns so each email is sent exactly once.
--    reminder_48h_sent_at and reminder_24h_sent_at already exist (0001);
--    "if not exists" makes those two a no-op and adds only confirmation_sent_at.
alter table public.bookings
  add column if not exists confirmation_sent_at timestamptz,
  add column if not exists reminder_48h_sent_at timestamptz,
  add column if not exists reminder_24h_sent_at timestamptz;

create index if not exists bookings_reminder_due_idx
  on public.bookings (appointment_start)
  where reminder_24h_sent_at is null or reminder_48h_sent_at is null;

-- 2) View mapping the MIRILUXE schema onto what lib/reminders/send.ts expects.
--    bookings: id uuid, service_id uuid, customer_name, customer_email,
--              appointment_start/appointment_end timestamptz, created_at,
--              status (pending_payment|confirmed|cancelled|completed|expired|no_show)
--    services: id uuid, name
--    There is no profiles/users table — customer details live on bookings.
create or replace view public.booking_reminder_view as
select
  b.id::text                        as id,
  b.customer_name                   as customer_name,
  b.customer_email                  as customer_email,
  s.name                            as service_name,
  b.appointment_start               as starts_at,
  greatest(
    1,
    round(extract(epoch from (b.appointment_end - b.appointment_start)) / 60)::int
  )                                 as duration_minutes,
  b.created_at,
  b.confirmation_sent_at,
  b.reminder_48h_sent_at,
  b.reminder_24h_sent_at
from public.bookings b
join public.services s on s.id = b.service_id
where b.status = 'confirmed';

-- Service-role only (the cron route uses the service key).
revoke all on public.booking_reminder_view from anon, authenticated;
