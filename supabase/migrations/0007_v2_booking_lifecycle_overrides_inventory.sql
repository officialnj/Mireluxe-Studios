-- MIRILUXE Studios v2 — booking lifecycle split, admin slot overrides,
-- unified shop inventory on bundle_variants, intake + reminder tracking.
-- Idempotent: safe to re-run against a database that already has some or
-- all of these changes applied.

-- ── bookings: intake + reminder tracking columns ────────────
alter table bookings add column if not exists hair_prep_agreed boolean not null default false;
alter table bookings add column if not exists reminder_48h_sent_at timestamptz;
alter table bookings add column if not exists reminder_24h_sent_at timestamptz;

comment on column bookings.hair_prep_agreed is
  'Customer confirmed the hair-prep agreement at booking time. Enforced as z.literal(true) by the public POST /api/bookings route; not a DB-level hard constraint, so an admin-created manual booking may leave this false.';
comment on column bookings.reminder_48h_sent_at is
  'Set once the 48-hour reminder email has been sent. Read/written by lib/booking/reminders.ts to avoid duplicate sends.';
comment on column bookings.reminder_24h_sent_at is
  'Set once the 24-hour reminder email has been sent. Read/written by lib/booking/reminders.ts to avoid duplicate sends.';

-- ── bookings: split 'expired' out of 'cancelled', add 'no_show' ──
-- A lapsed 15-minute pending_payment hold is now its own terminal status
-- ('expired'), distinct from an explicit customer/admin cancellation
-- ('cancelled'). 'no_show' is a new admin-set terminal status. Neither
-- participates in the no_overlapping_bookings exclusion constraint, same as
-- 'cancelled' already didn't — no change needed there.
alter table bookings drop constraint if exists bookings_status_check;
alter table bookings add constraint bookings_status_check
  check (status in ('pending_payment', 'confirmed', 'cancelled', 'completed', 'expired', 'no_show'));

-- ── slot_overrides: admin-managed exceptions to the default hourly grid ──
-- Default bookable start times are now a fixed 08:00..16:00 hourly grid
-- (see lib/booking/constants.ts DEFAULT_SLOT_START_HOUR/END_HOUR), decoupled
-- from studio_hours.open_time/close_time. This table lets Mirakle add an
-- extra bookable start time at any time of day on a specific date
-- (action='open'), or remove one specific default start time on a specific
-- date (action='blocked'). Merged into lib/booking/availability.ts
-- candidate generation; still subject to the no_overlapping_bookings
-- exclusion constraint on insert, same as every other booking.
create table if not exists slot_overrides (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  start_time  time not null,
  action      text not null check (action in ('open', 'blocked')),
  created_at  timestamptz not null default now(),
  unique (date, start_time)
);

comment on table slot_overrides is
  'Per-date exceptions to the default 08:00-16:00 hourly slot grid. action=open adds an extra bookable start time; action=blocked removes one specific default start time. See lib/booking/availability.ts.';

create index if not exists slot_overrides_date_idx on slot_overrides (date);

alter table slot_overrides enable row level security;

drop policy if exists public_read_slot_overrides on slot_overrides;
create policy public_read_slot_overrides on slot_overrides
  for select to anon, authenticated using (true);

-- Defense-in-depth, same pattern as studio_hours/bundle_variants — the real
-- write path for admin-managed overrides is a service-role Route Handler
-- (not yet built; see follow-up note 2 below), which bypasses RLS entirely.
drop policy if exists admin_write_slot_overrides on slot_overrides;
create policy admin_write_slot_overrides on slot_overrides
  for all to authenticated
  using (is_studio_admin(auth.uid()))
  with check (is_studio_admin(auth.uid()));

-- ── bundle_variants: extend for unified booking-add-on + retail shop use ──
alter table bundle_variants add column if not exists image_url text;
alter table bundle_variants add column if not exists description text;
alter table bundle_variants add column if not exists stock_quantity integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bundle_variants_stock_quantity_check') then
    alter table bundle_variants
      add constraint bundle_variants_stock_quantity_check check (stock_quantity >= 0);
  end if;
end $$;

comment on column bundle_variants.stock_quantity is
  'Real inventory count. Effective purchasability everywhere this table is used (booking add-ons today, retail /shop orders once unified) is in_stock = true AND stock_quantity > 0 — in_stock remains a manual admin override (e.g. pull a listing without zeroing real stock).';
comment on column bundle_variants.image_url is
  'Retail product photo for the unified /shop storefront. Null is valid pre-launch.';
comment on column bundle_variants.description is
  'Retail product copy for the unified /shop storefront. Null is valid pre-launch.';

-- Backfill: existing rows predate real inventory tracking and default to
-- stock_quantity = 0 via the column default above, which would silently
-- make the entire pre-seeded catalogue unbookable/unsellable. Give
-- currently-in_stock rows a placeholder quantity instead. Guarded so this is
-- a no-op once real quantities have been entered (i.e. safe to re-run).
update bundle_variants set stock_quantity = 100 where in_stock = true and stock_quantity = 0;

-- ── Manual follow-up (not part of this script) ──────────────
-- 1. Real per-variant stock_quantity figures from Mirakle should replace the
--    100-unit placeholder backfilled above — same caveat pattern as 0002's
--    flat £50 bundle pricing and 0003/0004's other placeholder data.
-- 2. slot_overrides has no admin UI/API yet on this branch (Agent B owns
--    only supabase/migrations/*, lib/booking/*, app/api/bookings/*,
--    app/api/webhooks/stripe/*, types/*) — whoever owns app/api/admin/*
--    needs a route to insert/delete rows here for Mirakle to manage
--    overrides from the dashboard.
-- 3. booking_settings.advance_booking_days is no longer read by
--    lib/booking/availability.ts (superseded by the 20th-of-month release
--    rule in getReleasedWindow) — flagged as a deletion candidate, not
--    dropped here per the deletion lock.
-- 4. services.deposit_pence is no longer read by lib/booking/pricing.ts
--    computeTotals (superseded by the flat-£20/50%-of-total rule) —
--    flagged as a deletion candidate, not dropped here. The admin Services
--    table can still edit it without error; it's just cosmetically inert.
