-- MIRILUXE Studios — booking system schema
-- Run once via the Supabase SQL Editor (or the GitHub-connected migration
-- pipeline, if configured to auto-apply files under supabase/migrations/).

-- ── services ─────────────────────────────────────────────
create table services (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  name              text not null,
  category          text not null,
  description       text not null,
  note              text,
  hair_included     boolean not null default false,
  price_from_pence  integer not null,
  duration_mins     integer not null,   -- PLACEHOLDER estimate, confirm with Miracle
  deposit_pence     integer not null,   -- PLACEHOLDER ~25% of price_from, confirm with Miracle
  active            boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now()
);

-- ── bundles ──────────────────────────────────────────────
create table bundles (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  price_pence  integer not null,
  active       boolean not null default true
);

-- ── studio_hours ─────────────────────────────────────────
create table studio_hours (
  day_of_week smallint primary key check (day_of_week between 0 and 6), -- 0=Sun..6=Sat
  open_time   time,
  close_time  time,
  is_closed   boolean not null default false
);

-- ── blocked_dates ────────────────────────────────────────
create table blocked_dates (
  id           uuid primary key default gen_random_uuid(),
  blocked_date date not null,
  start_time   time,   -- null = whole day blocked
  end_time     time,
  reason       text,
  created_at   timestamptz not null default now(),
  unique (blocked_date, start_time, end_time)
);

-- ── admins (single studio owner today, extensible later) ──
create table admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- ── bookings ─────────────────────────────────────────────
create table bookings (
  id                        uuid primary key default gen_random_uuid(),
  booking_ref               text unique not null
    default ('MX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  service_id                uuid not null references services(id),
  bundle_id                 uuid references bundles(id),
  customer_name              text not null,
  customer_email             text not null,
  customer_phone             text not null,
  notes                      text,
  appointment_start          timestamptz not null,
  appointment_end            timestamptz not null,
  appointment_range          tstzrange generated always as
                                (tstzrange(appointment_start, appointment_end, '[)')) stored,
  status                     text not null default 'pending_payment'
                                check (status in ('pending_payment', 'confirmed', 'cancelled', 'completed')),
  stripe_payment_intent_id   text,
  service_price_pence        integer not null,  -- snapshot at booking time
  bundle_price_pence         integer not null default 0,
  deposit_due_pence          integer not null,
  deposit_paid_pence         integer not null default 0,
  total_price_pence          integer not null,
  expires_at                 timestamptz not null default (now() + interval '15 minutes'),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint end_after_start check (appointment_end > appointment_start)
);

-- Race-condition-safe double-booking prevention: a native tstzrange GiST
-- exclusion constraint enforced at the DB level across concurrent requests.
-- No extension required.
alter table bookings add constraint no_overlapping_bookings
  exclude using gist (appointment_range with &&)
  where (status in ('pending_payment', 'confirmed'));

create index bookings_status_start_idx on bookings (status, appointment_start);
create index bookings_email_idx on bookings (customer_email);

-- ── is_studio_admin() helper (security definer, bypasses RLS on admins) ──
create or replace function is_studio_admin(uid uuid)
returns boolean language sql security definer stable as $$
  select exists (select 1 from admins where user_id = uid);
$$;

-- ── updated_at trigger ───────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger bookings_set_updated_at
  before update on bookings
  for each row execute function set_updated_at();

-- ── RLS ──────────────────────────────────────────────────
alter table services       enable row level security;
alter table bundles        enable row level security;
alter table studio_hours   enable row level security;
alter table blocked_dates  enable row level security;
alter table bookings       enable row level security;
alter table admins         enable row level security; -- no policies: only service-role/security-definer fn can touch it

create policy public_read_active_services on services
  for select to anon, authenticated using (active = true);
create policy public_read_active_bundles on bundles
  for select to anon, authenticated using (active = true);
create policy public_read_hours on studio_hours
  for select to anon, authenticated using (true);
create policy public_read_blocked_dates on blocked_dates
  for select to anon, authenticated using (true);

-- Public booking form: INSERT-only, never SELECT. Defense-in-depth backstop —
-- the app's real write path is a service-role Route Handler, which bypasses
-- RLS entirely, so this policy is what protects against a stray client-side
-- Supabase call ever reading someone else's booking.
create policy public_insert_pending_booking on bookings
  for insert to anon, authenticated
  with check (status = 'pending_payment');

create policy admin_select_bookings on bookings
  for select to authenticated using (is_studio_admin(auth.uid()));
create policy admin_update_bookings on bookings
  for update to authenticated using (is_studio_admin(auth.uid()));

-- ── Seed data ────────────────────────────────────────────
insert into studio_hours (day_of_week, open_time, close_time, is_closed) values
  (0, null, null, true),          -- Sunday closed
  (1, '09:00', '18:00', false),
  (2, '09:00', '18:00', false),
  (3, '09:00', '18:00', false),
  (4, '09:00', '18:00', false),
  (5, '09:00', '18:00', false),
  (6, '09:00', '18:00', false);

insert into bundles (name, description, price_pence) values
  ('Hair Bundle Add-On', 'Premium braiding hair delivered ready for your appointment.', 2800);

insert into services
  (slug, name, category, description, note, hair_included, price_from_pence, duration_mins, deposit_pence, sort_order)
values
  ('goddess-knotless-braids', 'Goddess Knotless Braids', 'Signature',
    'Soft, weightless knotless braids finished with curled goddess pieces for an effortless, romantic silhouette.',
    null, true, 12000, 300, 3000, 0),
  ('feed-in-cornrows', 'Feed-In Cornrows', 'Scalp',
    'Sleek, gradually built cornrows laid flat to the scalp — clean partings and a razor-sharp finish.',
    null, false, 4500, 90, 1500, 1),
  ('knotless-braids', 'Knotless Braids', 'Classic',
    'Tension-free knotless braids in your chosen length and size, plaited for comfort that lasts for weeks.',
    null, false, 9000, 240, 2500, 2),
  ('hair-included-styles', 'Hair Included Styles', 'All-Inclusive',
    'Turn up, sit back, leave transformed. Premium braiding hair is included — no shopping, no stress.',
    'Limited premium slots', true, 11000, 300, 3000, 3),
  ('sew-in-install', 'Sew-In Install', 'Install',
    'A seamless, natural-looking sew-in install with a flawless leave-out or closure of your choice.',
    null, true, 13000, 180, 3500, 4),
  ('boho-twists', 'Boho Twists', 'Textured',
    'Bohemian twists blended with curly human-hair pieces for that undone, free-spirited finish.',
    null, false, 10000, 240, 2500, 5),
  ('touch-up-refresh', 'Touch-Up & Refresh', 'Maintenance',
    'Refresh your edges, re-lay your parting and revive your style between full appointments.',
    null, false, 3000, 60, 1000, 6),
  ('trending-deal', 'Trending Deal', 'Featured',
    'This month''s most-requested look at a curated rate — reserve early, slots move fast.',
    'Deal of the month', false, 8500, 240, 2000, 7);

-- ── Manual follow-up (not part of this script) ──────────────
-- 1. Create Miracle's Supabase Auth user via the dashboard
--    (Authentication → Add user), NOT public self-signup.
-- 2. insert into admins (user_id) values ('<her-auth-user-uuid>');
