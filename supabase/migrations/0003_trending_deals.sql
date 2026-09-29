-- MIRILUXE Studios — Trending Deals category
-- Adds the "Trending Deals" category and its 4 real services, sourced from
-- the studio's live Acuity booking system (bookwithmiriluxe.as.me), which
-- was previously missing entirely from this catalogue.

insert into service_categories (name, slug, sort_order) values
  ('Trending Deals', 'trending-deals', 8);

-- All 4 rows are active on insert (unlike the Sew-Ins/Ponytails placeholders
-- in 0002) because real durations are known from the source booking system,
-- so there's nothing blocking them from being scheduled immediately.
insert into services (
  category_id, slug, name, size, base_price_pence, hair_incl_price_pence,
  service_time_mins, style_duration_weeks, xpression_packs, morning_only,
  included_bundle_count, included_bundle_inches, deposit_pence, description,
  note, sort_order, active
)
select c.id, v.slug, v.name, v.size, v.base_price_pence, v.hair_incl_price_pence,
       v.service_time_mins, v.style_duration_weeks, v.xpression_packs, v.morning_only,
       v.included_bundle_count, v.included_bundle_inches, v.deposit_pence, v.description,
       v.note, v.sort_order, v.active
from (values
  ('trending-deals', 'cassie-inspired-half-stitch', 'Cassie Inspired Half-Stitch', null, 37500, 37500, 480, null, null, true, 3, 24, 9500,
   'A signature half-stitch style, all hair included (3x 24" raw body wave bundles).',
   'Hair must be clean and free of oils/conditioners. Must be booked between 9–11am. We''ll contact you for a consultation after booking.',
   0, true),
  ('trending-deals', 'jayda-wayda-fulani-sewin', 'Jayda Wayda Inspired Fulani X Sewin', null, 29000, 29000, 300, null, null, false, 0, null, 7500,
   'A Fulani-braided foundation finished with a seamless sew-in — all hair included.',
   'Hair must be clean and free of oils/conditioners. We''ll contact you for a consultation after booking.',
   1, true),
  ('trending-deals', 'infinity-buns', 'Infinity Buns', null, 14000, 14000, 390, null, null, false, 0, null, 3500,
   'A braided mohawk finished into bantu twisted buns — all hair included.',
   null,
   2, true),
  ('trending-deals', 'trending-half-stitch-sewin', 'Trending Half Stitch x Sewin', null, 6000, null, 210, null, null, false, 0, null, 1500,
   'A trending half-stitch and sew-in combination style.',
   'Requires 3 bundles of human hair, supplied by the client.',
   3, true)
) as v(
  category_slug, slug, name, size, base_price_pence, hair_incl_price_pence,
  service_time_mins, style_duration_weeks, xpression_packs, morning_only,
  included_bundle_count, included_bundle_inches, deposit_pence, description,
  note, sort_order, active
)
join service_categories c on c.slug = v.category_slug;

-- ── Manual follow-up (not part of this script) ──────────────
-- 1. Bundle counts for Jayda Wayda Fulani x Sewin and Infinity Buns: Acuity
--    only states "all hair included," no bundle count/length given. Set to
--    0/null here rather than inventing a false-precision figure — confirm
--    with Mirakle and update via a data migration (not a schema change).
-- 2. deposit_pence follows the same ~25%-of-price-rounded-to-£5 placeholder
--    convention used throughout 0002, pending Mirakle's confirmed deposit
--    policy.
-- 3. Cassie Inspired Half-Stitch requires morning_only = true, but the real
--    Acuity constraint is a specific 9–11am start window. The existing
--    availability logic (lib/booking/availability.ts, generateCandidateSlots)
--    only enforces "start before 12:00" for morning_only services, which is
--    broader than the real requirement — under-restricting risks 11:xxam
--    starts being offered when Acuity would not allow them. A true fix (a
--    per-service time-window column) is out of scope for this migration.
-- 4. The 3 hair-included deals set base_price_pence == hair_incl_price_pence
--    since Acuity exposes only one all-inclusive price per deal (no separate
--    "without hair" tier) — this means step 1 of the booking form will show
--    a redundant "Without hair" button at the same price for these three.
--    Acceptable for now since the homepage deep-link (see BookingForm.tsx)
--    bypasses step 1 entirely for these cards.
