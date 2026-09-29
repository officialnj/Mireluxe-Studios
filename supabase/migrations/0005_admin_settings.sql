-- MIRILUXE Studios — admin-configurable scheduling settings
-- Adds the first-ever write path for studio_hours (previously read-only,
-- editable only via the Supabase SQL editor), plus a new booking_settings
-- singleton for buffer time between appointments and the rolling
-- advance-booking window (replacing the previous hardcoded
-- SLOT_RELEASE_DAY "release on the 20th" mechanic).

create policy admin_update_hours on studio_hours
  for update to authenticated using (is_studio_admin(auth.uid()));

create table booking_settings (
  id                    boolean primary key default true check (id),
  buffer_minutes        integer not null default 0,
  advance_booking_days  integer not null default 60,
  updated_at            timestamptz not null default now()
);

insert into booking_settings (id) values (true);

alter table booking_settings enable row level security;

create policy public_read_booking_settings on booking_settings
  for select to anon, authenticated using (true);
create policy admin_update_booking_settings on booking_settings
  for update to authenticated using (is_studio_admin(auth.uid()));
