# DELETIONS.md

Deletion lock is in effect for the `feat/v2-booking-shop` build: nothing listed below has been removed.
Everything here is hidden, feature-flagged, or simply superseded-but-left-in-place, pending the exact phrase
"Make Delete changes now" from Mirakle/the client.

Format: `- [ ] path/or/table.column — why it's obsolete — what replaced it`

## Candidates (populated as agents report them)

### From Agent B (schema + booking engine)
- [ ] `services.deposit_pence` — no longer read by `computeTotals()` now that deposit is £20-flat / 50%-of-total by rule. Admin Services UI can still edit it harmlessly (cosmetically inert). Superseded by: dynamic deposit formula in `lib/booking/pricing.ts`.
- [ ] `booking_settings.advance_booking_days` — no longer read by `getReleasedWindow()`. Superseded by: the 20th-of-month rolling window rule.
- [ ] `lib/booking/constants.ts` `SLOT_INTERVAL_MINUTES` — no longer referenced now that default slot generation uses a fixed hourly grid (08:00–16:00). Superseded by: hardcoded hourly slot generation + `slot_overrides` table.
- [ ] `studio_hours.open_time` / `close_time` — no longer used to size the bookable window (only `is_closed` is still read). Agent D confirmed `StudioHoursTable.tsx` still edits these; left as-is (cosmetically inert, no UI warning added). Still not a hard delete candidate — Mirakle may still want to record real hours for reference even if the booking engine no longer enforces them.

### From GATE 1 seeding (migration 0009_acuity_reconciliation.sql)
- [x] `services` rows: `cassie-inspired-half-stitch`, `jayda-wayda-fulani-sewin`, `infinity-buns`, `trending-half-stitch-sewin` — deactivated (`active = false`), NOT deleted, when replaced by the client's 3 new Trending Deals rows. Rows still exist in the DB and can be reactivated any time.

### From Agent E (shop + homepage + dark theme)
- [ ] `components/sections/DealsSection.tsx` — superseded by `components/home/DealsSection.tsx`; no longer imported anywhere.
- [ ] `components/sections/ShopGrid.tsx` — superseded by `components/shop/ShopGrid.tsx` + `BundleCard.tsx`; no longer imported anywhere.
- [ ] `lib/site.ts`: `PRODUCTS` / `PRODUCT_CATEGORIES` — no longer read by `/shop` now that it's DB-backed.
- [ ] `lib/site.ts`: `HAIR_INCLUDED` + `components/sections/ServicesCarousel.tsx` — hidden behind `SHOW_HAIR_INCLUDED_CAROUSEL = false` in `components/home/featureFlags.ts`, not deleted.
- [ ] `components/ThemeToggle.tsx` + its usage in `components/Nav.tsx` — now functionally inert since dark mode is force-locked (`forcedTheme="dark"` in `ThemeProvider`). Clicking it does nothing visually and its icon can drift out of sync with reality. Recommend removal once approved.

### From gallery rework + real site photos (2026-09-30)
- [ ] `lib/site.ts`: `GALLERY` — superseded by `app/gallery/page.tsx` reading `public/Mireluxe-Studios/Gallery/` directly at request time. No longer imported anywhere.

### From booking step-2 bundle catalog rework (2026-09-30)
- [ ] `components/booking/BundleUpsell.tsx` default export (`BundleUpsell` component) — hardcoded/product-agnostic `INCH_OPTIONS`/`COLOUR_OPTIONS` picker with no per-product grouping, superseded by `components/booking/BundleCatalog.tsx` + `BookingBundleCard.tsx` (reuses the shop's per-product `BundleCard` pattern). Not deleted — its `BundleLine` type export is still imported by `components/CartProvider.tsx` and `components/sections/BookingForm.tsx`.
