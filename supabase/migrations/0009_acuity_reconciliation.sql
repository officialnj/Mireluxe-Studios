-- MIRILUXE Studios — Acuity reconciliation (GATE 1 → GATE 2)
-- Reconciles the 0002/0003 seed catalogue against a full live scrape of
-- bookwithmiriluxe.as.me (see data/services.json for the raw scrape and
-- Agent A's comparison report for the full price/duration diff). Idempotent:
-- every statement is safe to re-run against a database that already has some
-- or all of these changes applied. Depends on 0008 (hair_incl_service_time_mins).
--
-- Deletion lock respected throughout: nothing found in the DB but missing
-- live (Smedium Fulani Braids/Twists, 18-20 Feed-Ins, Medium/Large Lemonade
-- Braids, Cassie Braids, the old Trending Deals rows) is deleted — only the
-- old Trending Deals rows are deactivated, per explicit instruction.
--
-- PLACEHOLDER figures introduced by this migration (none of these came off
-- the live Acuity scrape — flagged here and in Agent A's report for Mirakle
-- to confirm/adjust via the admin Services / Trending Deals page):
--   1. small-lemonade-braids.hair_incl_price_pence (38000 / £380) — Acuity
--      only exposes one all-inclusive Lemonade price (£260, now stored as
--      base_price_pence per client direction); no real hair-included number
--      exists to scrape, so this uses a +£120 premium in line with
--      comparable braid styles of similar base price/duration.
--   2. medium-miracle-knots.hair_incl_price_pence (21000 / £210) and
--      large-miracle-knots.hair_incl_price_pence (17000 / £170) — Acuity has
--      no Boho/hair-included tier for these two sizes; premiums extrapolated
--      from the confirmed Small (+£155) and Smedium (+£135) pattern.
--   3. All three new trending-deals rows' service_time_mins — the client's
--      spec gave prices and deposit rules only, no durations. Placeholders:
--      Small Mirakle Knots 360min (matches the real hair-included Small
--      Miracle Knots duration), Medium Boho Knotless 300min (matches the
--      real Medium Boho Knotless Twist duration — name is ambiguous between
--      the Braids and Twists Boho lines, flagging that ambiguity too),
--      4 Stitch Braids x Sew-in 210min (matches the outgoing "Trending Half
--      Stitch x Sewin" deal it appears to replace).
--   4. Every new/updated deposit_pence value below still follows the
--      ~25%-of-price-rounded-to-£5 placeholder convention from 0002 (except
--      the three trending-deals rows, whose deposits are the client's exact
--      50%/50%/flat-£20 spec) — deposit_pence is cosmetically inert per
--      0007's follow-up note 4, so none of this affects real checkout math.

-- ── Knotless Braids: base duration corrections + hair-included durations ──
update services set service_time_mins = 240 where slug = 'medium-knotless';
update services set service_time_mins = 180 where slug = 'large-knotless';

update services set hair_incl_service_time_mins = 720 where slug = 'small-knotless';
update services set hair_incl_service_time_mins = 480 where slug = 'smedium-knotless';
update services set hair_incl_service_time_mins = 360 where slug = 'medium-knotless';
update services set hair_incl_service_time_mins = 240 where slug = 'large-knotless';

-- ── Fulani Braids: base price + duration corrections, hair-included durations ──
-- smedium-fulani-braids: DB-ONLY, not found live — left untouched (deletion lock).
update services set service_time_mins = 480 where slug = 'small-fulani-braids';
update services set base_price_pence = 12000, service_time_mins = 240 where slug = 'medium-fulani-braids';
update services set base_price_pence = 10000, service_time_mins = 180 where slug = 'large-fulani-braids';

update services set hair_incl_service_time_mins = 600 where slug = 'small-fulani-braids';
update services set hair_incl_service_time_mins = 420 where slug = 'medium-fulani-braids';
update services set hair_incl_service_time_mins = 300 where slug = 'large-fulani-braids';

-- ── Knotless Twists: base price + duration corrections, hair-included durations ──
-- Client-confirmed: several hair-included Twists durations are genuinely
-- SHORTER than their base (no-hair) duration — not a data error, use as scraped.
update services set base_price_pence = 14000, service_time_mins = 480 where slug = 'small-knotless-twists';
update services set base_price_pence = 12000, service_time_mins = 300 where slug = 'smedium-knotless-twists';
update services set base_price_pence = 10000, service_time_mins = 360 where slug = 'medium-knotless-twists';
update services set base_price_pence = 8000,  service_time_mins = 240 where slug = 'large-knotless-twists';

update services set hair_incl_service_time_mins = 600 where slug = 'small-knotless-twists';
update services set hair_incl_service_time_mins = 360 where slug = 'smedium-knotless-twists';
update services set hair_incl_service_time_mins = 300 where slug = 'medium-knotless-twists';
update services set hair_incl_service_time_mins = 210 where slug = 'large-knotless-twists';

-- ── Fulani Twists: base price correction, hair-included durations, new Medium tier ──
-- smedium-fulani-twists: DB-ONLY, not found live — left untouched (deletion lock).
update services set base_price_pence = 13000 where slug = 'small-fulani-twists';
update services set base_price_pence = 9000, service_time_mins = 320 where slug = 'large-fulani-twists';

update services set hair_incl_service_time_mins = 480 where slug = 'small-fulani-twists';
update services set hair_incl_service_time_mins = 240 where slug = 'large-fulani-twists';

-- Medium Fulani Twists was omitted from the 0002 source doc pending
-- confirmation it existed — the live scrape confirms it does.
insert into services (
  category_id, slug, name, size, base_price_pence, hair_incl_price_pence,
  service_time_mins, hair_incl_service_time_mins, style_duration_weeks,
  xpression_packs, morning_only, included_bundle_count, included_bundle_inches,
  deposit_pence, description, sort_order, active
)
select c.id, 'medium-fulani-twists', 'Medium Fulani Twists', 'medium', 11000, 28500,
       300, 360, null, null, false, 2, 18, 3000,
       'Signature Fulani twist patterning with cornrow accents, in a classic medium size.',
       15, true
from service_categories c where c.slug = 'fulani-twists'
on conflict (slug) do nothing;

-- ── Feed-Ins: duration corrections + brand-new tiers ─────────
update services set service_time_mins = 60  where slug = 'feed-ins-4';
update services set service_time_mins = 300 where slug = 'feed-ins-10-12';
update services set service_time_mins = 300 where slug = 'feed-ins-14-16';
update services set service_time_mins = 360 where slug = 'feed-ins-20-plus';
-- feed-ins-18-20: DB-ONLY, not found live — left untouched (deletion lock).
-- feed-ins-6-8: exact match, no change.

insert into services (
  category_id, slug, name, size, base_price_pence, hair_incl_price_pence,
  service_time_mins, deposit_pence, description, sort_order, active
)
select c.id, v.slug, v.name, null, v.price_pence, v.hair_incl_price_pence,
       v.duration_mins, v.deposit_pence, v.description, v.sort_order, true
from (values
  ('feed-ins-2', '2 Feed-Ins', 4000, null, 30, 1000,
    'Two sleek feed-in cornrows for a quick, minimal style.', 21),
  -- Boho (hair-included) FeedIns: Acuity prices these as a single
  -- all-inclusive figure with no separate without-hair tier, same pattern
  -- 0003 used for Cassie Inspired Half-Stitch — base = hair-included price.
  ('feed-ins-6-8-boho', '6-8 Boho FeedIns', 15000, 15000, 240, 3500,
    'Six to eight feed-in cornrows with premium braiding hair included.', 22),
  ('feed-ins-10-12-boho', '10-12 Boho FeedIns', 16000, 16000, 330, 4000,
    'Ten to twelve feed-in cornrows with premium braiding hair included.', 23),
  ('feed-ins-12-14-boho', '12-14 Boho FeedIns', 17000, 17000, 360, 4000,
    'Twelve to fourteen feed-in cornrows with premium braiding hair included.', 24),
  ('feed-ins-20-plus-boho', '20+ Boho FeedIns', 18000, 18000, 430, 4500,
    'Twenty-plus fine feed-in cornrows with premium braiding hair included.', 25)
) as v(slug, name, price_pence, hair_incl_price_pence, duration_mins, deposit_pence, description, sort_order)
join service_categories c on c.slug = 'feed-ins'
on conflict (slug) do nothing;

-- ── Lemonade Braids ───────────────────────────────────────
-- Client direction: keep the single live Acuity figure (£260/6h) as the
-- BASE (without-hair) price/duration for Small Lemonade Braids, not as a
-- hair-included price. No real hair-included number exists to scrape, so a
-- placeholder premium (+£120, in line with comparable styles) is used until
-- Mirakle supplies the real figure via admin.
-- medium-lemonade-braids / large-lemonade-braids: DB-ONLY, not found live —
-- left untouched (deletion lock).
update services
   set base_price_pence = 26000,
       service_time_mins = 360,
       hair_incl_price_pence = 38000
 where slug = 'small-lemonade-braids';

-- ── Sew-Ins: durations + hair-included tier now known, activate ──
-- 0002 left these inactive solely because service_time_mins was unknown
-- (see its follow-up note 3); the live scrape now supplies it, so they can
-- be activated. Base prices already matched Acuity exactly and are unchanged.
update services
   set service_time_mins = 240,
       hair_incl_price_pence = 35000,
       hair_incl_service_time_mins = 300,
       active = true
 where slug = 'small-fulani-sew-in';

update services
   set service_time_mins = 240,
       hair_incl_price_pence = 31000,
       hair_incl_service_time_mins = 240,
       active = true
 where slug = 'medium-fulani-sew-in';

update services
   set service_time_mins = 180,
       hair_incl_price_pence = 27000,
       hair_incl_service_time_mins = 210,
       active = true
 where slug = 'large-fulani-sew-in';

-- cassie-braids: DB-ONLY, not found live — left untouched (deletion lock).

-- ── "Half Up Half Down Sew-In x Feed-Ins" → moved to Ponytails ──
-- Matches Acuity exactly: lives under Ponytails there, not Sew-Ins, and its
-- live name drops "Sew-In". Moved in place (same row/slug) rather than
-- duplicated — the service's old Sew-Ins categorization is superseded by
-- this update; not a separate deletion candidate since nothing is left
-- behind to delete.
update services
   set category_id = (select id from service_categories where slug = 'ponytails'),
       name = 'Half up , Half Down X FeedIns',
       base_price_pence = 10000,
       service_time_mins = 240,
       active = true
 where slug = 'half-up-half-down-sew-in-feed-ins';

-- ── Ponytails: prices/durations now known, activate ──────────
update services set base_price_pence = 15000, service_time_mins = 480, active = true where slug = 'small-feed-in-ponytail';
update services set base_price_pence = 12500, service_time_mins = 300, active = true where slug = 'medium-feed-in-ponytail';
update services set base_price_pence = 10000, service_time_mins = 240, active = true where slug = 'large-feed-in-ponytail';
update services set base_price_pence = 16500, service_time_mins = 480, active = true where slug = 'small-double-ponytail';
update services set base_price_pence = 14000, service_time_mins = 360, active = true where slug = 'medium-double-ponytail';
update services set base_price_pence = 11500, service_time_mins = 240, active = true where slug = 'large-double-ponytail';
update services set base_price_pence = 11000, service_time_mins = 240, active = true where slug = 'sleek-ponytail-feed-ins';

-- New Ponytail size variants with no prior DB row.
insert into services (
  category_id, slug, name, base_price_pence, service_time_mins,
  deposit_pence, description, sort_order, active
)
select c.id, v.slug, v.name, v.price_pence, v.duration_mins, v.deposit_pence, v.description, v.sort_order, true
from (values
  ('sleek-ponytail-medium-feedins', 'Sleek Ponytail X Medium FeedIns', 9000, 210, 2500,
    'A sleek ponytail finished with medium feed-in cornrows at the crown.', 36),
  ('sleek-ponytail-large-feedins', 'Sleek Ponytail X Large FeedIns', 7000, 180, 2000,
    'A sleek ponytail finished with large feed-in cornrows at the crown.', 37)
) as v(slug, name, price_pence, duration_mins, deposit_pence, description, sort_order)
join service_categories c on c.slug = 'ponytails'
on conflict (slug) do nothing;

-- ── Miracle Knots: brand-new category ────────────────────────
insert into service_categories (name, slug, sort_order)
select 'Miracle Knots', 'miracle-knots', 9
where not exists (select 1 from service_categories where slug = 'miracle-knots');

insert into services (
  category_id, slug, name, size, base_price_pence, hair_incl_price_pence,
  service_time_mins, hair_incl_service_time_mins, deposit_pence, description, note,
  sort_order, active
)
select c.id, v.slug, v.name, v.size, v.base_price_pence, v.hair_incl_price_pence,
       v.duration_mins, v.hair_incl_duration_mins, v.deposit_pence, v.description, v.note,
       v.sort_order, true
from (values
  ('small-miracle-knots', 'Small Miracle Knots', 'small', 13500, 29000, 420, 360, 3500,
    'Delicate crochet-feathered knots in our finest size for a soft, natural finish.',
    'Requires 2 bundles of crotchet HUMAN HAIR only (client-supplied). Hair-included price uses our own 100% human 18 inch crotchet feathered hair. Must be booked in a morning slot between 8am-12pm.',
    0),
  ('smedium-miracle-knots', 'Smedium Miracle Knots', 'smedium', 11500, 25000, 300, null, 3000,
    'A refined mid-small crochet knot size, balancing detail with a shorter chair time.',
    'Requires a minimum of 2 crotchet bundles HUMAN HAIR only (client-supplied). Hair-included price uses our own 100% human 18 inch crotchet feathered hair.',
    1),
  ('medium-miracle-knots', 'Medium Miracle Knots', 'medium', 9500, 21000, 240, null, 2500,
    'Classic crochet knot styling in a versatile medium size.',
    'Requires a minimum of 2 crotchet bundles HUMAN HAIR only (client-supplied). PLACEHOLDER hair-included price -- no Boho/hair-included tier exists live for this size yet; confirm with Mirakle.',
    2),
  ('large-miracle-knots', 'Large Miracle Knots', 'large', 7500, 17000, 180, null, 2000,
    'Bold crochet knot patterning with larger sections for a faster finish.',
    'Requires a minimum of 1 crotchet bundle HUMAN HAIR only (client-supplied). PLACEHOLDER hair-included price -- no Boho/hair-included tier exists live for this size yet; confirm with Mirakle.',
    3)
) as v(slug, name, size, base_price_pence, hair_incl_price_pence, duration_mins, hair_incl_duration_mins, deposit_pence, description, note, sort_order)
join service_categories c on c.slug = 'miracle-knots'
on conflict (slug) do nothing;

-- ── Touch-Ups: brand-new category ────────────────────────────
insert into service_categories (name, slug, sort_order)
select 'Touch-Ups', 'touch-ups', 10
where not exists (select 1 from service_categories where slug = 'touch-ups');

insert into services (
  category_id, slug, name, base_price_pence, service_time_mins, deposit_pence,
  description, note, sort_order, active
)
select c.id, v.slug, v.name, v.price_pence, v.duration_mins, v.deposit_pence, v.description, v.note, v.sort_order, true
from (values
  ('braids-touch-up', 'Braids Touch-Up', 5000, 120, 1500,
    'A refresh of your existing braided style''s regrowth and partings.',
    'Price WILL vary: a touch-up is 50% of the original hairstyle price (e.g. original £150 -> touch-up £75). Contact before booking if you want a different design from your original style.',
    0),
  ('fulani-touch-up', 'Fulani Touch-Up', 5000, 120, 1500,
    'A refresh of your existing Fulani style''s regrowth and partings.',
    'Price WILL vary: a touch-up is 50% of the original hairstyle price (e.g. original £150 -> touch-up £75). Contact before booking if you want a different design from your original style.',
    1)
) as v(slug, name, price_pence, duration_mins, deposit_pence, description, note, sort_order)
join service_categories c on c.slug = 'touch-ups'
on conflict (slug) do nothing;

-- ── Trending Deals: replace the 4 seeded-from-old-scrape rows with the
--    client's current 3-item spec ──────────────────────────────
-- Deactivated, not deleted, per the deletion lock.
update services
   set active = false
 where category_id = (select id from service_categories where slug = 'trending-deals')
   and slug in (
     'cassie-inspired-half-stitch',
     'jayda-wayda-fulani-sewin',
     'infinity-buns',
     'trending-half-stitch-sewin'
   );

insert into services (
  category_id, slug, name, base_price_pence, hair_incl_price_pence,
  service_time_mins, deposit_pence, description, note, sort_order, active
)
select c.id, v.slug, v.name, v.price_pence, v.hair_incl_price_pence,
       v.duration_mins, v.deposit_pence, v.description, v.note, v.sort_order, true
from (values
  -- All-inclusive (hair included): base = hair-incl price, same convention
  -- 0003 used for Cassie Inspired Half-Stitch.
  ('trending-small-mirakle-knots', 'Small Mirakle Knots', 25000, 25000, 360, 12500,
    'This month''s featured Small Mirakle Knots deal, hair included.',
    'PLACEHOLDER duration (360min) -- client spec gave price and 50% deposit only, no duration. Deposit = 50% of price per client spec.',
    1),
  ('trending-medium-boho-knotless', 'Medium Boho Knotless', 22000, 22000, 300, 11000,
    'This month''s featured Medium Boho Knotless deal, hair included.',
    'PLACEHOLDER duration (300min) -- client spec gave price and 50% deposit only, no duration; name is ambiguous between the Boho Knotless Braids and Boho Knotless Twist lines. Deposit = 50% of price per client spec.',
    2),
  ('trending-4-stitch-braids-sewin', '4 Stitch Braids x Sew-in', 6000, null, 210, 2000,
    'This month''s featured 4 Stitch Braids x Sew-in deal, hair not included.',
    'PLACEHOLDER duration (210min) -- client spec gave price and flat £20 deposit only, no duration. Deposit = flat £20 per client spec.',
    3)
) as v(slug, name, price_pence, hair_incl_price_pence, duration_mins, deposit_pence, description, note, sort_order)
join service_categories c on c.slug = 'trending-deals'
on conflict (slug) do nothing;
