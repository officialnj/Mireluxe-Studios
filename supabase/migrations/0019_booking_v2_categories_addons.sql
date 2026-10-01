-- MIRILUXE Studios — booking engine v2: category restructure + add-ons system.
-- Client-confirmed via chat (2026-10-01), sourced from a full sweep of the
-- live Acuity booking page (Miriluxe Booking System.pdf).
--
-- Does NOT touch blocked_dates or bookings in any way — only
-- service_categories, services (category_id reassignment only, no row
-- deletions), and two new tables.

-- ───────────────────────────────────────────────────────────────────────
-- 1. New merged categories: Braids (Knotless + Fulani Braids), Twists
--    (Knotless + Fulani Twists). FeedIns absorbs Lemonade Braids in place
--    (renamed, same id, so its existing services need no reassignment).
-- ───────────────────────────────────────────────────────────────────────
insert into service_categories (name, slug, sort_order, active) values
  ('Braids', 'braids', 1, true),
  ('Twists', 'twists', 7, true);

update service_categories set name = 'FeedIns', sort_order = 2 where slug = 'feed-ins';
update service_categories set sort_order = 0 where slug = 'trending-deals';
update service_categories set sort_order = 3 where slug = 'miracle-knots';
update service_categories set sort_order = 4 where slug = 'ponytails';
update service_categories set sort_order = 5 where slug = 'sew-ins';
update service_categories set sort_order = 6 where slug = 'touch-ups';

-- Reassign services into the new/merged categories.
update services set category_id = (select id from service_categories where slug = 'braids')
 where category_id in (
   select id from service_categories where slug in ('knotless-braids', 'fulani-braids')
 );

update services set category_id = (select id from service_categories where slug = 'twists')
 where category_id in (
   select id from service_categories where slug in ('knotless-twists', 'fulani-twists')
 );

update services set category_id = (select id from service_categories where slug = 'feed-ins')
 where category_id = (select id from service_categories where slug = 'lemonade-braids');

-- Archive the now-redundant categories — not deleted, per the deletion lock.
update service_categories
   set active = false
 where slug in ('knotless-braids', 'fulani-braids', 'knotless-twists', 'fulani-twists', 'lemonade-braids');

-- ───────────────────────────────────────────────────────────────────────
-- 2. Add-ons system — entirely new, did not exist before this migration.
-- ───────────────────────────────────────────────────────────────────────
create table service_addons (
  id uuid primary key default gen_random_uuid(),
  -- NULL = the virtual "Hair Included Styles" bucket: these addons apply
  -- whenever a customer has hairIncluded=true, regardless of which real
  -- base category the style belongs to — matching the PDF's single shared
  -- Hair-Included addon list, distinct from each base category's own
  -- (larger) list used when hair is NOT included.
  category_id uuid references service_categories(id),
  name text not null,
  price_delta_pence integer not null default 0,
  duration_delta_mins integer not null default 0,
  -- True only for the "Premium Slots" addon: selecting it unlocks three
  -- extra candidate start times (06:00, 20:00, 21:00) in the availability
  -- engine, on top of the normal 08:00–16:00 grid. See lib/booking/availability.ts.
  unlocks_premium_slots boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0
);

alter table service_addons enable row level security;

create policy public_read_active_addons on service_addons
  for select to anon, authenticated using (active = true);

create policy admin_write_addons on service_addons
  for all to authenticated
  using (is_studio_admin(auth.uid()))
  with check (is_studio_admin(auth.uid()));

create table booking_addons (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  service_addon_id uuid references service_addons(id),
  name_at_booking text not null,
  price_delta_pence_at_booking integer not null,
  duration_delta_mins_at_booking integer not null,
  created_at timestamptz not null default now()
);

alter table booking_addons enable row level security;

create policy admin_select_booking_addons on booking_addons
  for select to authenticated using (is_studio_admin(auth.uid()));
-- No public policy: rows are only ever written by the service-role Route
-- Handler alongside their parent booking, same as booking_bundles.

-- ───────────────────────────────────────────────────────────────────────
-- 3. Seed add-on data — transcribed exactly from the PDF, per category.
-- ───────────────────────────────────────────────────────────────────────

-- Braids
insert into service_addons (category_id, name, price_delta_pence, duration_delta_mins, unlocks_premium_slots, sort_order)
select id, v.name, v.price, v.duration, v.premium, v.ord
  from service_categories, (values
    ('Braids', 0, 30, false, 1),
    ('Burn Length', 1500, 60, false, 2),
    ('Curls (bohemian style)', 1000, 30, false, 3),
    ('Long Bob (Between shoulders and Bra)', -1000, -60, false, 4),
    ('Premium Slot (Xmas)', 2000, 0, false, 5),
    ('Short Bob (Shoulders and above)', -2000, -120, false, 6),
    ('Wrapped Ends', 0, 0, false, 7),
    ('Braiding Hair Included', 2500, 0, false, 8),
    ('Colour Mix', 0, 30, false, 9),
    ('Extra Curls (3+ bundles)', 2000, 60, false, 10),
    ('Luxe Freestyle', 2000, 60, false, 11),
    ('Premium Slots (9/10am) (8/9pm)', 2000, 0, true, 12),
    ('Squeeze-In', 2000, 0, false, 13)
  ) as v(name, price, duration, premium, ord)
 where service_categories.slug = 'braids';

-- FeedIns
insert into service_addons (category_id, name, price_delta_pence, duration_delta_mins, unlocks_premium_slots, sort_order)
select id, v.name, v.price, v.duration, v.premium, v.ord
  from service_categories, (values
    ('Beads', 0, 30, false, 1),
    ('Burn Length', 1500, 60, false, 2),
    ('Curls (bohemian style)', 1000, 30, false, 3),
    ('Knee Length', 2500, 240, false, 4),
    ('Luxe Freestyle', 2000, 60, false, 5),
    ('Premium Slots (9/10am) (8/9pm)', 2000, 0, true, 6),
    ('Squeeze-In', 2000, 0, false, 7),
    ('Braiding Hair Included', 2500, 0, false, 8),
    ('Colour Mix', 0, 30, false, 9),
    ('Extra Curls (3+ bundles)', 2000, 60, false, 10),
    ('Long Bob (Between shoulders and Bra)', -1000, -60, false, 11),
    ('Premium Slot (Xmas)', 2000, 0, false, 12),
    ('Short Bob (Shoulders and above)', -2000, -120, false, 13),
    ('Wrapped Ends', 0, 0, false, 14)
  ) as v(name, price, duration, premium, ord)
 where service_categories.slug = 'feed-ins';

-- Hair Included Styles (virtual bucket — category_id NULL)
insert into service_addons (category_id, name, price_delta_pence, duration_delta_mins, unlocks_premium_slots, sort_order)
values
  (null, 'Bum Length', 1500, 60, false, 1),
  (null, 'Curls (bohemian style)', 1000, 30, false, 2),
  (null, 'Luxe Freestyle', 2000, 60, false, 3),
  (null, 'Premium Slots (9/10am) (8/9pm)', 2000, 0, true, 4),
  (null, 'Colour Mix', 0, 30, false, 5),
  (null, 'Long Bob (Between shoulders and Bra)', -1000, -60, false, 6),
  (null, 'Premium Slot (Xmas)', 2000, 0, false, 7),
  (null, 'Squeeze-In', 2000, 0, false, 8);

-- Miracle Knots
insert into service_addons (category_id, name, price_delta_pence, duration_delta_mins, unlocks_premium_slots, sort_order)
select id, 'Colour Mix', 0, 30, false, 1
  from service_categories where slug = 'miracle-knots';

-- Ponytails
insert into service_addons (category_id, name, price_delta_pence, duration_delta_mins, unlocks_premium_slots, sort_order)
select id, 'Colour Mix', 0, 30, false, 1
  from service_categories where slug = 'ponytails';

-- Sew-Ins
insert into service_addons (category_id, name, price_delta_pence, duration_delta_mins, unlocks_premium_slots, sort_order)
select id, v.name, v.price, v.duration, v.premium, v.ord
  from service_categories, (values
    ('ANY Styling (Curls, Crimp, Straightening, Bangs, Blunt Cut etc)', 1000, 60, false, 1),
    ('Braided Crown', 0, 10, false, 2),
    ('Bum Length', 1500, 60, false, 3),
    ('Curls (bohemian style)', 1000, 30, false, 4),
    ('Long Bob (Between shoulders and Bra)', -1000, -60, false, 5),
    ('Premium Slot (Xmas)', 2000, 0, false, 6),
    ('Short Bob (Shoulders and above)', -2000, -120, false, 7),
    ('Wrapped Ends', 0, 0, false, 8),
    ('Beads', 0, 30, false, 9),
    ('Braiding Hair Included', 2500, 0, false, 10),
    ('Colour Mix', 0, 30, false, 11),
    ('Extra Curls (3+ bundles)', 2000, 60, false, 12),
    ('Luxe Freestyle', 2000, 60, false, 13),
    ('Premium Slots (9/10am) (8/9pm)', 2000, 0, true, 14),
    ('Squeeze-In', 2000, 0, false, 15)
  ) as v(name, price, duration, premium, ord)
 where service_categories.slug = 'sew-ins';

-- Touch-Ups
insert into service_addons (category_id, name, price_delta_pence, duration_delta_mins, unlocks_premium_slots, sort_order)
select id, v.name, v.price, v.duration, v.premium, v.ord
  from service_categories, (values
    ('Beads', 0, 30, false, 1),
    ('Bum Length', 1500, 60, false, 2),
    ('Curls (bohemian style)', 1000, 30, false, 3),
    ('Long Bob (Between shoulders and Bra)', -1000, -60, false, 4),
    ('Premium Slot (Xmas)', 2000, 0, false, 5),
    ('Short Bob (Shoulders and above)', -2000, -120, false, 6),
    ('Wrapped Ends', 0, 0, false, 7),
    ('Braiding Hair Included', 2500, 0, false, 8),
    ('Colour Mix', 0, 30, false, 9),
    ('Extra Curls (3+ bundles)', 2000, 60, false, 10),
    ('Luxe Freestyle', 2000, 60, false, 11),
    ('Premium Slots (9/10am) (8/9pm)', 2000, 0, true, 12),
    ('Squeeze-In', 2000, 0, false, 13)
  ) as v(name, price, duration, premium, ord)
 where service_categories.slug = 'touch-ups';

-- Twists (same list as Braids, but "Beads" instead of "Braids" as the first item)
insert into service_addons (category_id, name, price_delta_pence, duration_delta_mins, unlocks_premium_slots, sort_order)
select id, v.name, v.price, v.duration, v.premium, v.ord
  from service_categories, (values
    ('Beads', 0, 30, false, 1),
    ('Burn Length', 1500, 60, false, 2),
    ('Curls (bohemian style)', 1000, 30, false, 3),
    ('Long Bob (Between shoulders and Bra)', -1000, -60, false, 4),
    ('Premium Slot (Xmas)', 2000, 0, false, 5),
    ('Short Bob (Shoulders and above)', -2000, -120, false, 6),
    ('Wrapped Ends', 0, 0, false, 7),
    ('Braiding Hair Included', 2500, 0, false, 8),
    ('Colour Mix', 0, 30, false, 9),
    ('Extra Curls (3+ bundles)', 2000, 60, false, 10),
    ('Luxe Freestyle', 2000, 60, false, 11),
    ('Premium Slots (9/10am) (8/9pm)', 2000, 0, true, 12),
    ('Squeeze-In', 2000, 0, false, 13)
  ) as v(name, price, duration, premium, ord)
 where service_categories.slug = 'twists';
