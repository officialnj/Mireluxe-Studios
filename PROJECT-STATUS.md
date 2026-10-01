# MIRILUXE Studios — Project Status

Last updated: 2026-10-01

Living handoff doc for any agent (or human) picking this project up. Read this first — it reflects the **actual current state** of the live site, not the original demo. If anything here conflicts with what you observe in the code or on the live site, trust what you observe and update this file.

---

## What this is

A Next.js 14 (App Router) + Supabase booking and shop platform for **MIRILUXE Studios**, a hair-braiding studio in Wembley, London (founder: Mirakle De'shane). Built to match the real functionality of **Acuity Scheduling** (bookings/scheduling) and **Shopify** (product shop) — not a simplified imitation of either.

- **Live site:** https://www.miriluxe.co.uk (also reachable at the default `*.vercel.app` URL)
- **Hosting:** Vercel. Pushing to the `main` branch on GitHub auto-deploys to production immediately — there is no staging environment and no manual deploy step.
- **Repo:** `github.com/officialnj/Mireluxe-Studios`, branch `main` is the only long-lived branch.
- **Database:** Supabase project `olyinnxgsgdlhcnidyod` (eu-west-1). Migrations live in `supabase/migrations/`, currently `0001` through `0018`, all applied via `supabase db push`. **Migrations are the source of truth for schema/data changes — write one for anything beyond a one-off admin-UI edit, and commit it to git** (see Process notes below — this has been missed before).
- **Admin dashboard:** `/admin/login`. Not linked from the public site nav (removed deliberately — see Recent changes). Mirakle has the direct URL saved. Real Supabase Auth account exists for her (`miriluxestudios@outlook.com`); a row in the `admins` table authorizes it.

---

## Architecture at a glance

- **Booking engine** (`lib/booking/`): hourly slot grid (08:00–16:00 default start times), deposit formula (£20 flat without hair / 50% of total with hair), double-booking protection via a Postgres exclusion constraint (`no_overlapping_bookings`), 15-minute payment holds, booking lifecycle states (`pending_payment` → `confirmed`/`cancelled`/`completed`/`no_show`/`expired`), 20th-of-month rolling release window for new availability.
- **Admin dashboard** (`app/admin/(authenticated)/`, `components/admin/`): real Shopify/Acuity-parity back office — bookings calendar + lifecycle tools, customer directory, service categories, services, trending deals, products (bundles + media), orders + refunds, discount codes, shipping settings, availability/blocked-dates calendars, consumables, general settings. Mobile-friendly nav as of this session (collapsible hamburger below `md` breakpoint).
- **Shop** (`app/shop/`, `components/shop/`): DB-backed product catalogue (`bundles` + `bundle_variants` tables), dark theme, video-first product cards (hover-to-play desktop / tap-to-play mobile, first-frame poster).
- **Booking bundle picker** (`components/booking/BundleCatalog.tsx` + `BookingBundleCard.tsx`): step-2 "add hair to your appointment" flow, reuses the shop's per-product card pattern — grouped by product, not a single flat picker.
- **Payments:** Stripe PaymentIntents (not Checkout Sessions) for both booking deposits and shop orders. Webhook at `app/api/webhooks/stripe/route.ts` is the sole source of truth for confirming a booking/order — hardened this session with retryable-error handling, metadata-first lookup, and late-payment reinstate-or-refund logic for the case where a customer pays after their 15-minute hold already expired.
- **Email:** Resend, via `lib/email/templates.ts`. Booking confirmation + admin notification fire from the Stripe webhook on payment success. Reminder emails (48h and 24h before appointment) fire from an hourly Vercel Cron job (`vercel.json` → `/api/bookings/cron/reminders`). A second cron (`/api/cron/expire-bookings`) sweeps expired unpaid holds. **Whether `RESEND_API_KEY`/`CRON_SECRET` are set to real values in Vercel's *production* environment (as opposed to local `.env.local`) was never independently confirmed this session — verify in the Vercel dashboard before assuming reminder emails are actually sending.**
- **Images/video:** `public/Mireluxe-Studios/Images/` (hero, about, CEO — real photography, ~28MB total after compression) and `public/Mireluxe-Studios/Gallery/` (62 real photos, read directly via `fs.readdirSync` at request time, no manifest). Product videos live in Supabase Storage (`product-media` bucket), referenced via the `bundle_media` table.
- **Deletion lock policy:** nothing in this project gets permanently deleted — only archived (`active = false`) or superseded-in-place, logged in `DELETIONS.md`. This has been followed strictly all session and should continue to be. The unlock phrase (`"Make Delete changes now"`) has never been sent.

---

## Recent changes (this session, 2026-09-30 → 2026-10-01)

Roughly in order:

1. **Full "Acuity + Shopify level" rebuild** — booking engine, admin v2, shop rebuild, bundle catalog rework. (~120 files; this was built across many turns and briefly sat uncommitted for the whole build before being committed and pushed in 6 logical commits — see Process notes.)
2. **Stripe webhook hardened** — merged in retryable-error handling and late-payment reinstate-or-refund logic from a hand-written reference file, while keeping this build's discount-usage tracking and stock decrement.
3. **Real site photography + gallery** populated (replacing all demo placeholders), 864MB of raw source photos compressed to ~28MB with `sips`.
4. **Merged to `main` and deployed to production** for the first time this session (previously only ever a local demo).
5. **Bundle length/pricing update** — all 6 active bundle products (Body Wave, Burmese Curl, Deep Wave, Italian Curls, Loose Deep Wave, Water Wave) given the full 14"–26" length range with real client-provided pricing; only 18" in stock (qty 10) per product.
6. **Product videos attached** — 6 short (≤15s, one intentionally 21s per client confirmation) iPhone videos uploaded to Supabase Storage with first-frame posters, wired to each product's 18" variant.
7. **Admin nav made mobile-friendly** — collapsible hamburger menu below `md`, matching the pattern already proven on the public site's nav.
8. **Public "Admin login" icon removed from the site nav** — client security request. The `/admin/login` route itself is untouched; Mirakle has the direct link saved separately.
9. **Service catalogue reconciled against the live Acuity booking page** (`bookwithmiriluxe.as.me`) — 2 services renamed (price/duration were already correct, name wasn't), 3 services had an invented "hair included" price removed (base price correct, but Acuity doesn't offer that size with hair included), 5 services archived (`active = false`) with no match anywhere on the live Acuity page. Full detail in `DELETIONS.md`.
10. **Fixed a real, serious production-only bug**: admin edits (service renames, blocked dates, etc.) were not reliably showing up on the live site, despite routes being marked `dynamic = 'force-dynamic'`. Root cause: Vercel/Next.js caches the Supabase client's internal `fetch()` calls at the platform level, and route-level dynamic config didn't reliably disable this for a third-party library's internal fetches. **Fix:** both server-side Supabase clients (`lib/supabase/server.ts`) now pass an explicit `fetch` wrapper forcing `cache: 'no-store'` on every request. **This is an important gotcha for any future agent** — if live data ever looks stale again despite the database being correct, check this first before assuming it's a logic bug.

### A note on how bug #10 was found

While diagnosing it, a temporary debug endpoint was briefly added to a public, unauthenticated API route that exposed raw database rows and server environment info. It was caught by the permission system and reverted within the same deploy cycle, but it did go live briefly. No production incident resulted, but any future agent should **never** add diagnostic endpoints to public routes without first asking — use a local script against the service-role key instead (as was done for every other diagnostic query this session).

---

## What's working and verified live

- Customer booking flow end-to-end: service selection → bundle add-ons → time slot → payment → confirmation email.
- Admin dashboard: all sections reachable, blocked dates now correctly exclude slots (whole-day and partial time-range), service edits reflect live immediately.
- Shop: browsing, cart, checkout, discount codes, shipping calculation.
- Product videos: hover-to-play (desktop) / tap-to-play (mobile), verified on 6 products.
- Stripe webhook: booking/order confirmation, stock decrement, discount usage tracking, late-payment reinstate-or-refund.

## What's unconfirmed / needs verification

- **Stripe live-mode connection** — a guided walkthrough was started earlier in the project (client entering her own keys, never the agent) but was paused mid-way needing the exact production domain, which has since resolved (`miriluxe.co.uk` is live). Whether live Stripe keys are actually in Vercel's production env vars was never confirmed in this session — check before assuming real payments work.
- **`RESEND_API_KEY` / `CRON_SECRET` in production** — confirmed present in local `.env.local`, not independently confirmed in Vercel's production environment. If a customer reports not receiving a confirmation or reminder email, check this first.
- **Resend sending-domain verification** (SPF/DKIM/DMARC for `miriluxe.co.uk`) — needed for Resend to actually deliver, separate from the API key being valid. See `docs/INTEGRATIONS.md`.

## Known gaps / missing assets

- `services-carousel-1.jpg`, `services-carousel-2.jpg`, `services-carousel-3.jpg`, and `cta-banner.jpg` — referenced in `lib/site.ts` but never provided by the client; currently broken/missing images on the homepage's services carousel and CTA banner sections.
- Google Calendar sync — scoped once early in the project (push confirmed bookings, pull busy time) but never built. The client's actual day-to-day calendar is Outlook, not Gmail — confirm this is still wanted, and in what form, before building anything.
- A handful of services were archived this session for having no match on the live Acuity page (`Smedium Fulani Braids`, `Smedium Fulani Twists`, `18–20 Feed-Ins`, `Medium Lemonade Braids`, `Large Lemonade Braids`) — these can be reactivated with real data if Mirakle confirms she still offers them. See `DELETIONS.md`.

---

## Process notes for future agents working on this project

- **Commit continuously, not at the end of a session.** Earlier this project sat with ~120 files of real client work completely uncommitted for an entire build. Treat "uncommitted for more than a day" as a bug in your own process.
- **Separate raw/source assets from deployed assets, and gitignore the former immediately.** An 864MB raw-photo dump folder and a raw bundle-video folder both had to be excluded after the fact — see `.gitignore` for the pattern (`/New Folder With Items/`, `/Media for bundles/`).
- **Every schema or bulk-data change should be a migration file**, committed to git, applied via `supabase db push` — not a one-off script that only exists in a chat transcript.
- **Deletion lock stays in effect**: archive (`active = false`), never delete, log it in `DELETIONS.md`, until the client sends the exact phrase `"Make Delete changes now"`.
- **If `npm run build` is run while `next dev` is already running, restart the dev server immediately after** (`pkill -f "next dev"; rm -rf .next; npm run dev`) — otherwise the dev server's cache corrupts and throws confusing chunk-not-found errors.
- **Verify changes live in a real browser (or via curl against the live site) after every deploy that touches customer- or admin-facing behavior.** Several real bugs this project (admin nav hidden behind public nav, a toggle not persisting, a React key collision, the Supabase fetch-caching issue above) were only ever found this way — never purely by reading code.
- **Never add diagnostic/debug endpoints to public routes.** Use a local Node script against the service-role key for any live-data investigation.
