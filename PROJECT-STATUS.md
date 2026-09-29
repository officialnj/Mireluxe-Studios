# MIRILUXE Studios — Project Status

Last updated: 2026-09-29

This is a living handoff doc: what's done, what's live, what's still needed before this stops being a demo and becomes the real site.

---

## ⚠️ Not deployed yet

Everything below is committed to the **local working tree only**, on branch `fix/mobile-hero-cta-bottom`. Nothing has been committed, pushed, or merged to `main`, and the live site (`curious-paprenjak-0b007a.netlify.app`) does **not** reflect any of this work yet. The database migrations (see below) **have** been pushed to the linked Supabase project, but the live Netlify deployment may be pointed at a different Supabase project than the one this local repo is linked to — that was never confirmed. Until code is pushed and a deploy runs, the live URL still shows the old version, including the "Booking is temporarily unavailable" bug from the empty catalogue.

---

## ✅ Completed and verified

### Content & catalogue fixes
- **Founder name corrected** site-wide: "Miracle De'Shanae" → "Mirakle De'shane", including the "Book with Mirakle" button (9 locations across `app/layout.tsx`, `app/about/page.tsx`, `AboutMeSection.tsx`, `HeroSlider.tsx`, `lib/site.ts`).
- **Trending Deals added to the booking system** (migration `0003`) — the category was live on the real Acuity booking system but completely missing from this site. Added with real pricing/durations: Cassie Inspired Half-Stitch (£375), Jayda Wayda Inspired Fulani×Sewin (£290), Infinity Buns (£140), Trending Half Stitch×Sewin (£60).
- **Homepage "Deals of the Month"** now pulls the real Trending Deals from Supabase instead of 3 fake placeholder deals. Each "Book Now" deep-links via `/book?service=<slug>` straight to that exact service, skipping ahead to the bundles step.
- **Gallery page simplified** — removed the category filter tabs, now a plain grid of all photos (lightbox still works).

### Booking system — scheduling
- **All time restrictions lifted** (migration `0004`) — every service's `morning_only` flag set to `false` so nothing is currently blocked to a morning-only window. This was explicitly temporary, pending real constraints from Mirakle; the underlying mechanism is untouched and can be re-enabled per-service later via the admin Services table.
- **New admin Settings page** at `/admin/settings` (migration `0005`):
  - Weekly working-hours editor (open/close time + closed toggle per day, bulk save).
  - Buffer time between appointments (trailing — applies after each booking, admin-configurable minutes).
  - Advance-booking window — **replaced** the old hardcoded "new slots release on the 20th of every month" mechanic with a rolling "book up to N days ahead" window (default 60 days, admin-editable). All 6 places that referenced the old "20th" copy were updated, and the number on the `/book` page itself is now live from the database rather than hardcoded.
  - Days off / one-off closures continue to use the existing Blocked Dates admin page — no changes needed there.

### Booking system — cart & checkout
- **Working shopping cart** — previously the cart icon in the nav was a dead visual stub (badge hardcoded to "0", no click handler) and the `/shop` "Add to Cart" buttons did nothing. Now:
  - A real cart (React Context + `localStorage`, persists across pages and refreshes) tracks both booking bundle add-ons and `/shop` products.
  - Nav cart icon shows a live item count and opens a slide-out drawer.
  - Drawer shows two independent sections (appointment add-ons / shop items) with separate subtotals and separate call-to-action buttons — never a merged "pay" total, since they're genuinely different transactions.
  - `/shop` now has a **real checkout flow** (new: `shop_orders` table, migration `0006`) — full price via Stripe (not a deposit, unlike bookings), with a shipping-address form and a confirmation email template.
  - Verified end-to-end in a real browser: adding items updates the badge live, quantities/remove work, cart survives navigating from `/shop` to `/book`, both booking and shop items coexist correctly in the drawer, and the checkout flow correctly creates a real Stripe PaymentIntent and handles failure/cleanup (tested with the current placeholder Stripe keys, which correctly fail with no orphaned database rows — see below).

### Database migrations applied (pushed to the linked Supabase project)
`0001` → `0006`, all confirmed applied via `supabase migration list`:
- `0003_trending_deals.sql`
- `0004_lift_time_restrictions.sql`
- `0005_admin_settings.sql`
- `0006_shop_orders.sql`

---

## 🚧 Not started yet

### 1. Connect the real Stripe account
No code work needed — this is purely operational. The site already uses a single-account Stripe integration (no Stripe Connect/marketplace complexity). What's needed:
- Mirakle's verified Stripe account's **live-mode** keys: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- Register the live webhook endpoint in the Stripe dashboard and set `STRIPE_WEBHOOK_SECRET`.
- Add all of the above to the production hosting environment's env vars (Netlify site settings), not just `.env.local`.

Currently the site is running on placeholder/invalid Stripe keys — confirmed by a live test checkout that correctly failed with a clean error (no orphaned orders), so the failure path itself is proven to work.

### 2. Google Calendar two-way sync
Nothing built yet. Scope, per what's been agreed:
- **Push**: confirmed bookings automatically appear as events on Mirakle's Google Calendar.
- **Pull**: her existing personal calendar events count as busy time and block those slots from public booking availability.
- Needs: a new Google Cloud project + OAuth consent screen (Mirakle has to set this up — a one-time click-through "unverified app" warning is expected and fine for a single-user tool, but the consent screen needs to be flipped from "Testing" to "In production" in Google Cloud Console or the connection will silently expire every 7 days).
- Needs new code: OAuth connect/callback/disconnect routes in the admin Settings page, a `googleapis` dependency, new Supabase tables for the stored refresh token and a short-lived busy-time cache, and changes to the availability engine (`lib/booking/availability.ts`) to merge in calendar busy time.

### 3. Automated email reminders + fixing the scheduling gap
Not started. Two things bundled together:
- New reminder emails at **48 hours** and **2 hours** before each appointment.
- This also fixes a real existing bug: the site has a daily cleanup job (auto-expiring unpaid booking holds) that's configured for Vercel's cron system, but the site is hosted on Netlify — Netlify doesn't read that config, so **the cleanup job has never actually run in production**. The plan is to move all scheduled jobs to **Supabase Cron** (runs from inside the database itself, so it keeps working regardless of which host serves the actual website — this only broke once already because of the Vercel/Netlify mismatch).

---

## 📋 Known gaps vs. the real Acuity booking system (identified, not yet actioned)

From a direct comparison against the live Acuity system, still outstanding:
- **Miracle Knots** category (4 real, bookable services, £75–£135) — not in this site's catalogue at all.
- **Touch-Ups** category (2 services, £50 flat, priced as 50% of the original style) — not in this site's catalogue at all.
- **Sew-Ins** and **Ponytails** — rows exist in the database but are marked inactive because no appointment duration has been confirmed for them yet; that's 8 real, currently-bookable-on-Acuity services that can't be booked on this site.
- Some pricing mismatches vs. the real business — Twists pricing is off by £30–£75 in places, a couple of Fulani Braids prices don't match, and the Feed-Ins tier breakdown differs slightly (this site is missing a "12–14" tier that Acuity has).
- Bundle pricing is a flat £50 placeholder across every length and colour — real per-length pricing hasn't been confirmed.

---

## ❓ Things only Mirakle can provide

- Real, accurate working hours per day (currently a placeholder 8am–7pm).
- Real buffer time between clients.
- Confirmed cancellation/deposit policy (deposits are currently ~25% of the service price, rounded to the nearest £5 — an explicitly-flagged placeholder, not her real policy).
- Real bundle pricing by length/colour (currently flat £50 for every option).
- Missing service data: Miracle Knots, Touch-Ups, and durations for Sew-Ins/Ponytails, so those can be activated.
- A decision on shop order shipping cost (currently £0 placeholder — real UK shipping rates aren't knowable from anything in the codebase).
- Her real Stripe account (live keys) and a Google account to connect for Calendar sync.

---

## Recommended order for what's left

1. Get Mirakle's real Stripe keys in — quick, unblocks real payments immediately.
2. Google Calendar sync (push, then pull) + Supabase Cron for reminders — the bigger remaining build, and it depends on Mirakle completing Google Cloud setup first, so worth kicking off in parallel with other work.
3. Backfill the real catalogue gaps (Miracle Knots, Touch-Ups, Sew-Ins/Ponytails durations, corrected pricing) once she confirms the numbers.
4. Confirm which Supabase project the live Netlify deployment actually points to, and get this branch committed, pushed, and deployed.
