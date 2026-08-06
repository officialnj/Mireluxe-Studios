-- MIRILUXE Studios — real service catalogue, dual pricing, bundle variants
-- Supersedes the 8-service placeholder catalogue from 0001. No real bookings
-- exist yet (pre-launch), so services/bookings data is cleared and reseeded
-- rather than migrated row-by-row.

-- ── service_categories ───────────────────────────────────
create table service_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique not null,
  sort_order integer not null default 0,
  active     boolean not null default true
);

alter table service_categories enable row level security;
create policy public_read_active_categories on service_categories
  for select to anon, authenticated using (active = true);

insert into service_categories (name, slug, sort_order) values
  ('Knotless Braids', 'knotless-braids', 0),
  ('Fulani Braids', 'fulani-braids', 1),
  ('Knotless Twists', 'knotless-twists', 2),
  ('Fulani Twists', 'fulani-twists', 3),
  ('Feed-Ins', 'feed-ins', 4),
  ('Lemonade Braids', 'lemonade-braids', 5),
  ('Sew-Ins', 'sew-ins', 6),
  ('Ponytails', 'ponytails', 7);

-- ── clear placeholder services (pre-launch, no real bookings reference them) ──
delete from bookings;
delete from services;

-- ── revise services ──────────────────────────────────────
alter table services rename column price_from_pence to base_price_pence;
alter table services rename column duration_mins to service_time_mins;
alter table services alter column service_time_mins drop not null;
alter table services drop column hair_included;
alter table services drop column category;

alter table services
  add column category_id uuid not null references service_categories(id),
  add column size text,
  add column hair_incl_price_pence integer,
  add column style_duration_weeks text,
  add column xpression_packs text,
  add column morning_only boolean not null default false,
  add column included_bundle_count integer not null default 0,
  add column included_bundle_inches integer;

-- ── revise bundles + new bundle_variants ─────────────────
delete from bundles;
alter table bundles drop column description;
alter table bundles drop column price_pence;

insert into bundles (name) values ('Curl texture bulk braiding bundle');

create table bundle_variants (
  id          uuid primary key default gen_random_uuid(),
  bundle_id   uuid not null references bundles(id),
  inches      integer not null,
  colour      text not null,
  price_pence integer not null,
  in_stock    boolean not null default true,
  unique (bundle_id, inches, colour)
);

alter table bundle_variants enable row level security;
create policy public_read_instock_variants on bundle_variants
  for select to anon, authenticated using (in_stock = true);
create policy admin_read_all_variants on bundle_variants
  for select to authenticated using (is_studio_admin(auth.uid()));
create policy admin_update_variants on bundle_variants
  for update to authenticated using (is_studio_admin(auth.uid()));

-- £50 flat placeholder across every inch/colour combination, per the brief —
-- real (likely per-inch) pricing lands here as a data update, no migration.
insert into bundle_variants (bundle_id, inches, colour, price_pence)
select b.id, i.inches, c.colour, 5000
from bundles b
cross join unnest(array[14, 16, 18, 20, 22, 24, 28]) as i(inches)
cross join unnest(array['1B', '2', '4']) as c(colour);

-- ── booking_bundles (join table, replaces bookings.bundle_id) ──
create table booking_bundles (
  id                     uuid primary key default gen_random_uuid(),
  booking_id             uuid not null references bookings(id) on delete cascade,
  bundle_variant_id      uuid not null references bundle_variants(id),
  quantity               integer not null default 1,
  price_pence_at_booking integer not null
);

alter table booking_bundles enable row level security;
create policy admin_select_booking_bundles on booking_bundles
  for select to authenticated using (is_studio_admin(auth.uid()));
-- No public policy: rows are only ever written by the service-role Route
-- Handler alongside their parent booking, same as bookings itself.

-- ── revise bookings ──────────────────────────────────────
alter table bookings drop column bundle_id;
alter table bookings drop column bundle_price_pence;
alter table bookings add column hair_included boolean not null default false;

-- ── studio hours: 8:00–19:00 to fit the longest (11 hr) service ──
update studio_hours set open_time = '08:00', close_time = '19:00' where is_closed = false;

-- ── seed the real 36-service catalogue ───────────────────
-- Where the source document gives a duration range (e.g. "3-4 hrs"), the
-- upper bound is stored for service_time_mins — under-blocking a slot risks
-- a real double-booking, over-blocking only costs an occasionally-idle chair.
-- deposit_pence is a placeholder (~25% of base price, rounded to the
-- nearest £5) pending Miracle's confirmed deposit policy, same caveat as
-- the rest of the booking system. Descriptions are placeholder marketing
-- copy pending real copy from Miracle.
insert into services (
  category_id, slug, name, size, base_price_pence, hair_incl_price_pence,
  service_time_mins, style_duration_weeks, xpression_packs, morning_only,
  included_bundle_count, included_bundle_inches, deposit_pence, description,
  sort_order, active
)
select c.id, v.slug, v.name, v.size, v.base_price_pence, v.hair_incl_price_pence,
       v.service_time_mins, v.style_duration_weeks, v.xpression_packs, v.morning_only,
       v.included_bundle_count, v.included_bundle_inches, v.deposit_pence, v.description,
       v.sort_order, v.active
from (values
  -- Knotless Braids
  ('knotless-braids', 'small-knotless', 'Small Knotless', 'small', 22000, 34000, 600, '6 weeks', '3-4', true, 2, 18, 5500, 'Fine, close partings for a flawless, long-lasting finish — our smallest and most detailed knotless size.', 0, true),
  ('knotless-braids', 'smedium-knotless', 'Smedium Knotless', 'smedium', 18000, 30000, 420, '6 weeks', '3', true, 2, 18, 4500, 'A refined middle-ground parting size, balancing detail with a shorter time in the chair.', 1, true),
  ('knotless-braids', 'medium-knotless', 'Medium Knotless', 'medium', 14000, 26000, 300, '6 weeks', '3', false, 2, 18, 3500, 'Classic medium knotless braids — tension-free, weightless, and endlessly versatile.', 2, true),
  ('knotless-braids', 'large-knotless', 'Large Knotless', 'large', 10000, 24000, 210, '3 weeks', '2-3', false, 2, 18, 2500, 'Bold, chunky knotless braids for a fast, statement finish.', 3, true),
  -- Fulani Braids
  ('fulani-braids', 'small-fulani-braids', 'Small Fulani Braids', 'small', 23500, 35500, 660, '6 weeks+', '3-4', true, 2, 18, 6000, 'Intricate cornrow-and-braid detailing in our finest parting size, built to last.', 4, true),
  ('fulani-braids', 'smedium-fulani-braids', 'Smedium Fulani Braids', 'smedium', 19500, 31500, 540, '6 weeks', '3-4', true, 2, 18, 5000, 'Fulani-inspired braid-and-cornrow styling in a refined mid-small parting.', 5, true),
  ('fulani-braids', 'medium-fulani-braids', 'Medium Fulani Braids', 'medium', 15500, 27500, 330, '4 weeks', null, false, 2, 18, 4000, 'Signature Fulani patterning with cornrow accents, in a classic medium size.', 6, true),
  ('fulani-braids', 'large-fulani-braids', 'Large Fulani Braids', 'large', 10500, 22500, 240, '2-3 weeks', null, false, 2, 18, 2500, 'A bold take on Fulani braids with larger partings for a quicker finish.', 7, true),
  -- Knotless Twists
  ('knotless-twists', 'small-knotless-twists', 'Small Knotless Twists', 'small', 19000, 31000, 540, '4-5 weeks', null, true, 2, 18, 5000, 'Fine, defined knotless twists for a soft, natural texture that holds its shape.', 8, true),
  ('knotless-twists', 'smedium-knotless-twists', 'Smedium Knotless Twists', 'smedium', 15000, 27000, 360, '4-5 weeks', null, false, 2, 18, 4000, 'A balanced twist size offering definition without the longest chair time.', 9, true),
  ('knotless-twists', 'medium-knotless-twists', 'Medium Knotless Twists', 'medium', 11000, 23000, 300, '3-4 weeks', null, false, 2, 18, 3000, 'Classic knotless twists — lightweight, tension-free and easy to maintain.', 10, true),
  ('knotless-twists', 'large-knotless-twists', 'Large Knotless Twists', 'large', 7000, 19000, 180, '2-3 weeks', null, false, 2, 18, 2000, 'Chunky knotless twists for a relaxed, effortless finish.', 11, true),
  -- Fulani Twists (no Medium — not supplied in source document)
  ('fulani-twists', 'small-fulani-twists', 'Small Fulani Twists', 'small', 20500, 32500, 600, '4-5 weeks', null, true, 2, 18, 5000, 'Fulani-patterned twist detailing in our finest, longest-lasting size.', 12, true),
  ('fulani-twists', 'smedium-fulani-twists', 'Smedium Fulani Twists', 'smedium', 16500, 28500, 420, '4 weeks', '3', false, 2, 18, 4000, 'Fulani-inspired twist styling with cornrow accents, in a mid-small size.', 13, true),
  ('fulani-twists', 'large-fulani-twists', 'Large Fulani Twists', 'large', 14500, 26500, 240, '2 weeks', '2', false, 2, 18, 3500, 'Bold Fulani twist patterning with larger sections for a faster finish.', 14, true),
  -- Feed-Ins (no hair-included tier)
  ('feed-ins', 'feed-ins-4', '4 Feed-Ins', null, 6000, null, 120, '2 weeks', '1', false, 0, null, 1500, 'Four sleek, gradually-fed cornrows laid flat to the scalp.', 15, true),
  ('feed-ins', 'feed-ins-6-8', '6–8 Feed-Ins', null, 8000, null, 180, '2 weeks', '1', false, 0, null, 2000, 'Six to eight clean, gradually-fed cornrows for everyday elegance.', 16, true),
  ('feed-ins', 'feed-ins-10-12', '10–12 Feed-Ins', null, 10000, null, 240, '2-3 weeks', '2', false, 0, null, 2500, 'Ten to twelve precisely parted feed-in cornrows, any pattern.', 17, true),
  ('feed-ins', 'feed-ins-14-16', '14–16 Feed-Ins', null, 12000, null, 360, null, '2', true, 0, null, 3000, 'Fourteen to sixteen fine feed-in cornrows for an intricate, detailed finish.', 18, true),
  ('feed-ins', 'feed-ins-18-20', '18–20 Feed-Ins', null, 14000, null, 360, null, '2', true, 0, null, 3500, 'Eighteen to twenty fine feed-in cornrows — sharp partings, maximum detail.', 19, true),
  ('feed-ins', 'feed-ins-20-plus', '20+ Feed-Ins', null, 16000, null, 420, null, '2', true, 0, null, 4000, 'Twenty-plus of our finest feed-in cornrows for the most intricate finish we offer.', 20, true),
  -- Lemonade Braids
  ('lemonade-braids', 'small-lemonade-braids', 'Small Lemonade Braids', 'small', 14000, 26000, 360, '5 weeks+', '3', true, 2, 18, 3500, 'Side-swept cornrow braids in a fine parting size, styled with a flawless sweep.', 21, true),
  ('lemonade-braids', 'medium-lemonade-braids', 'Medium Lemonade Braids', 'medium', 12000, 24000, 300, '4 weeks', '2', true, 2, 18, 3000, 'Our signature side-swept lemonade braids in a classic medium size.', 22, true),
  ('lemonade-braids', 'large-lemonade-braids', 'Large Lemonade Braids', 'large', 10000, 22000, 240, '3-4 weeks', '2', false, 2, 18, 2500, 'Bold, side-swept lemonade braids with larger partings for a quicker finish.', 23, true),
  -- Sew-Ins — inactive: no service time supplied yet, cannot be scheduled
  ('sew-ins', 'small-fulani-sew-in', 'Small Fulani x Sew-In', null, 13000, null, null, null, null, false, 0, null, 3500, 'A Fulani-braided foundation finished with a seamless small-sectioned sew-in.', 24, false),
  ('sew-ins', 'medium-fulani-sew-in', 'Medium Fulani x Sew-In', null, 11000, null, null, null, null, false, 0, null, 3000, 'A Fulani-braided foundation finished with a seamless medium sew-in install.', 25, false),
  ('sew-ins', 'large-fulani-sew-in', 'Large Fulani x Sew-In', null, 9000, null, null, null, null, false, 0, null, 2500, 'A Fulani-braided foundation finished with a seamless, larger-sectioned sew-in.', 26, false),
  ('sew-ins', 'half-up-half-down-sew-in-feed-ins', 'Half Up Half Down Sew-In x Feed-Ins', null, 14000, null, null, null, null, false, 0, null, 3500, 'Feed-in cornrows paired with a half-up, half-down sew-in for the best of both.', 27, false),
  ('sew-ins', 'cassie-braids', 'Cassie Braids', null, 16000, null, null, null, null, false, 0, null, 4000, 'A signature braided style finished with a flawless, natural-looking install.', 28, false),
  -- Ponytails — inactive: no service time supplied yet, cannot be scheduled
  ('ponytails', 'small-feed-in-ponytail', 'Small Feed-In Ponytail', null, 16500, null, null, null, null, false, 0, null, 4000, 'A sleek feed-in ponytail with fine, detailed partings.', 29, false),
  ('ponytails', 'medium-feed-in-ponytail', 'Medium Feed-In Ponytail', null, 14000, null, null, null, null, false, 0, null, 3500, 'A classic feed-in ponytail in a versatile medium parting size.', 30, false),
  ('ponytails', 'large-feed-in-ponytail', 'Large Feed-In Ponytail', null, 12500, null, null, null, null, false, 0, null, 3000, 'A bold feed-in ponytail with larger partings for a faster finish.', 31, false),
  ('ponytails', 'small-double-ponytail', 'Small Double Ponytail', null, 16000, null, null, null, null, false, 0, null, 4000, 'Two sleek, symmetrical ponytails with fine, detailed partings.', 32, false),
  ('ponytails', 'medium-double-ponytail', 'Medium Double Ponytail', null, 13500, null, null, null, null, false, 0, null, 3500, 'Two classic ponytails in a versatile medium parting size.', 33, false),
  ('ponytails', 'large-double-ponytail', 'Large Double Ponytail', null, 11500, null, null, null, null, false, 0, null, 3000, 'Two bold ponytails with larger partings for a faster finish.', 34, false),
  ('ponytails', 'sleek-ponytail-feed-ins', 'Sleek Ponytail x Feed-Ins', null, 12000, null, null, null, null, false, 0, null, 3000, 'A single sleek ponytail finished with fine feed-in cornrows at the crown.', 35, false)
) as v(
  category_slug, slug, name, size, base_price_pence, hair_incl_price_pence,
  service_time_mins, style_duration_weeks, xpression_packs, morning_only,
  included_bundle_count, included_bundle_inches, deposit_pence, description,
  sort_order, active
)
join service_categories c on c.slug = v.category_slug;

-- ── Manual follow-up (not part of this script) ──────────────
-- 1. Confirm with Miracle: Large Knotless hair-included price (£240, a +£140
--    uplift where every other service uses +£120 — likely a typo for £220,
--    kept as-supplied here pending confirmation).
-- 2. Confirm whether Medium Fulani Twists exists (omitted from source doc).
-- 3. Supply service_time_mins for the 12 Sew-In/Ponytail services, then
--    flip their `active` flag to true.
-- 4. Confirm real bundle pricing (currently flat £50 across all variants).
