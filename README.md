# MIRILUXE Studios: Website & Booking Platform

The public website, online booking system, hair shop and admin back office for **MIRILUXE Studios**, a hair-braiding studio in Wembley, North West London, run by founder Mirakle De'shane.

> **Spelling note:** the brand is **MIRILUXE** (live domain `miriluxe.co.uk`). The repository and asset folders use the older spelling **Mireluxe** (`Mireluxe-Studios`, `public/Mireluxe-Studios/`). Both names refer to the same business. Don't "fix" the folder names, because code paths depend on them.

This file is the **orientation guide**: what the site is for and how the code is laid out. For the current live state, open issues and process rules, read [`PROJECT-STATUS.md`](./PROJECT-STATUS.md). For Stripe/Resend setup, see [`docs/INTEGRATIONS.md`](./docs/INTEGRATIONS.md).

---

## 1. What the website is for

The site replaces two third-party tools the studio used before: **Acuity Scheduling** (appointments) and **Shopify** (selling hair). It does four jobs:

| Job | Who it's for | Where it lives |
|---|---|---|
| **Brand showcase**: hero imagery, about the founder, reviews, gallery of past work | Prospective clients | `/`, `/about`, `/gallery`, `/contact` |
| **Online booking**: pick a style, add-ons and hair, choose a slot, pay a deposit | Clients | `/book`, `/book/manage/[id]` |
| **Hair shop**: buy braiding-hair bundles (by length/colour) with shipping, discount codes and pre-orders | Clients | `/shop`, `/shop/checkout` |
| **Admin back office**: calendar, clients, checkout, catalogue, stock, orders, gallery, settings | Mirakle (studio owner) | `/admin/*` (not linked from public nav) |

### Key business rules (encoded in code, not just copy)

- **Deposits:** without-hair bookings pay a flat **£20** deposit. Hair-included bookings pay **50% of the total** (service, add-ons and bundles). The rest is paid in the studio on the day and tracked in the admin *Checkout* tab. See `lib/booking/pricing.ts`.
- **Deposits are non-refundable.** They can be moved to a new date with 48 hours' notice. Self-service reschedule/cancel is blocked within 48h of the appointment (`SELF_SERVICE_CUTOFF_MINUTES`).
- **Slot grid:** hourly start times from **08:00 to 16:00** (Europe/London). Certain add-ons unlock **premium slots** (06:00, 20:00, 21:00). The admin can add extra one-off start times (`slot_overrides`) or block days and time ranges (`blocked_dates`).
- **Minimum notice:** no slot can be booked less than 2 hours ahead.
- **Release window:** on the **20th of each month** the whole of next month opens for booking. Before that, clients can only book to the end of the current month.
- **Payment hold:** a booking is created as `pending_payment` and holds its slot for **15 minutes**. It only becomes `confirmed` when the Stripe webhook reports a successful payment.
- **No double bookings:** a Postgres exclusion constraint (`no_overlapping_bookings`) blocks them at the database level.
- **Privacy:** the public site shows only a vague address ("Wembley, HA9"). The exact studio address goes only in emails to clients who have booked and paid (`PRIVATE_STUDIO_DETAILS` in `lib/site.ts`).
- **Deletion lock:** nothing is hard-deleted. Records are archived (`active = false`) and the change is logged in [`DELETIONS.md`](./DELETIONS.md).

---

## 2. Tech stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 14** (App Router, React 18, TypeScript) |
| Styling | **Tailwind CSS**, `framer-motion` animations, `next-themes` (public site is locked to dark theme) |
| Database / Auth / Storage | **Supabase** (Postgres + Row Level Security, Supabase Auth for admin login, Storage bucket `product-media`) |
| Payments | **Stripe** PaymentIntents + Stripe Elements (`@stripe/react-stripe-js`) |
| Email | **Resend** (confirmations, reminders, reschedule/cancel notices, order emails, owner alerts) |
| Validation | **zod** on every API payload |
| Dates | `date-fns`, `date-fns-tz` (all scheduling runs in `Europe/London`), `react-day-picker` |
| Hosting | **Vercel**. Pushing to `main` deploys to production straight away. Two Vercel Cron jobs are defined in `vercel.json`. |

---

## 3. Repository layout

```
.
├── app/                     Next.js App Router: pages + API routes
│   ├── page.tsx             Home (hero, Trending Deals, about, reviews)
│   ├── about/  contact/  gallery/
│   ├── book/                Booking flow + /book/manage/[id] self-service page
│   ├── shop/                Storefront + /shop/checkout
│   ├── admin/
│   │   ├── login/           Admin sign-in (Supabase Auth)
│   │   └── (authenticated)/ Every protected admin page (shared layout)
│   └── api/                 Route handlers (see §5)
├── components/
│   ├── sections/            Public page sections (HeroSlider, BookingForm, GalleryGrid…)
│   ├── home/                Home-specific pieces (DealsSection, featureFlags)
│   ├── booking/             Booking-flow steps (DatePicker, TimeSlotPicker, AddOnPicker,
│   │                        BundleCatalog, PaymentStep, OrderSummary, ManageBookingClient)
│   ├── shop/                Storefront (ShopGrid, BundleCard)
│   ├── admin/               Back-office UI (AdminShell, CalendarView, BookingDetailsPanel,
│   │                        ServicesTable, ProductsManager, OrdersManager, CheckoutCenter…)
│   ├── ui/                  Shared primitives (Button, Card, Accordion, PageHero, SectionHeader)
│   └── Nav, Footer, SiteChrome, CartProvider, CartDrawer, ThemeProvider…
├── lib/
│   ├── booking/             Booking engine: availability, pricing, constants, types,
│   │                        reminders, ICS calendar-invite generation
│   ├── shop/                Discount validation, shipping calculation, shop types
│   ├── email/               Resend templates + confirmation sender
│   ├── supabase/            Server (service-role + SSR), browser and admin-auth helpers
│   ├── admin/               Admin nav data + booking-status colour map
│   ├── site.ts              Static site content: nav links, contact details, copy, image paths
│   ├── stripe.ts  resend.ts  revalidate.ts
├── supabase/migrations/     Numbered SQL migrations (0001 → 0023), the schema source of truth
├── public/Mireluxe-Studios/
│   ├── Images/              Hero, about and founder photography
│   └── Gallery/             Portfolio photos (read from disk at request time)
├── data/services.json       Raw scrape of the old Acuity catalogue (reference only)
├── docs/INTEGRATIONS.md     Stripe / Resend / env-var setup guide
├── middleware.ts            Redirects unauthenticated users away from /admin/*
├── vercel.json              Cron schedule
├── PROJECT-STATUS.md        Living handoff doc: live state, known gaps, process rules
├── DELETIONS.md             Log of archived/superseded items (deletion lock)
└── .claude/                 Claude Code skills/launch config (design tooling, not app code)
```

---

## 4. Public site: pages and data sources

| Route | What it shows | Data source |
|---|---|---|
| `/` | Hero slider, **Trending Deals** (services in the `trending-deals` category, with optional images), About-me teaser, reviews | Supabase (`services`, `service_categories`), `lib/site.ts` |
| `/about` | Founder story, studio details, FAQ / policies | `lib/site.ts`, `CANCELLATION_POLICY` |
| `/gallery` | Portfolio grid | JPEGs in `public/Mireluxe-Studios/Gallery/` **plus** admin uploads (`gallery_images` table → Storage) |
| `/contact` | Contact form, phone, Instagram, opening hours | `lib/site.ts` (`CONTACT`) |
| `/shop` | Hair bundles with length/colour variants, video-first product cards, cart drawer, pre-order for out-of-stock variants | `bundles`, `bundle_variants`, `bundle_media` |
| `/shop/checkout` | Cart → discount code → shipping → Stripe payment | `/api/shop/checkout` |
| `/book` | Multi-step booking wizard (below) | `/api/services`, `/api/availability/*`, `/api/bookings` |
| `/book/manage/[id]` | Client self-service: view, reschedule or cancel a booking via the link in their email | `/api/bookings/[id]/*` |

### The booking wizard (`components/sections/BookingForm.tsx`)

```
1. Service      → category + style, with or without hair
2. Add-ons      → optional extras per category (price/duration deltas; some unlock premium slots)
3. Bundles      → (hair-included styles only) add hair from shop stock
4. Date & time  → DatePicker + TimeSlotPicker, fed by /api/availability/days|slots
5. Details      → name, email, phone, notes, hair-prep agreement (required)
6. Payment      → POST /api/bookings creates a pending booking + Stripe PaymentIntent;
                  the client pays the deposit with Stripe Elements
   Success      → the Stripe webhook confirms the booking and sends emails (with an .ics invite)
```

The browser-side total (`computeTotals`) is for display only. The server recalculates price, duration and slot availability from the database before it creates the booking.

---

## 5. API routes (`app/api/`)

**Public**

| Route | Purpose |
|---|---|
| `GET /api/services` | Active categories, services, add-ons |
| `GET /api/availability/days` / `slots` | Bookable days in a month / slots on a day for a given service + add-ons |
| `POST /api/bookings` | Validate, hold the slot (15 min), create a Stripe PaymentIntent |
| `/api/bookings/[id]/status \| reschedule \| cancel` | Self-service actions behind a capability link |
| `POST /api/shop/checkout` | Price the cart from the DB, apply discount + shipping, create a PaymentIntent |
| `POST /api/shop/preorder` | "Notify me" signup for an out-of-stock variant (no payment) |
| `POST /api/webhooks/stripe` | **The only place bookings and orders get confirmed.** Handles stock decrement, discount usage, emails, and late payments after a hold has lapsed (reinstates the booking or refunds) |

**Cron** (Bearer `CRON_SECRET`, scheduled in `vercel.json`)

| Route | Schedule | Purpose |
|---|---|---|
| `/api/bookings/cron/reminders` | hourly | 48h and 24h reminder emails |
| `/api/cron/expire-bookings` | daily | Sweep unpaid holds that have expired |

**Admin** (`/api/admin/*`). Every handler checks the caller is listed in the `admins` table. CRUD and reorder endpoints exist for services, service-categories, add-ons, trending-deals, bundles, bundle-variants, bundle-media, gallery, discount-codes, blocked-dates, slot-overrides, studio-hours, booking-settings and shipping-settings. There are also booking actions (create, status, notes, reschedule, cancel, resend-confirmation, admin slot lookup), order actions (update, refund) and `checkout/[id]/collect`, which marks an in-studio balance as paid.

---

## 6. Admin back office (`/admin`)

Sign in at `/admin/login` (Supabase Auth). Access works in two layers:
1. `middleware.ts`: any `/admin/*` request without a session redirects to the login page.
2. `lib/supabase/admin-auth.ts` (`requireAdminPage` / `getAdminUser`): the user must also have a row in the `admins` table.

The layout copies Acuity's: a light theme, a sidebar on desktop and a bottom tab bar on mobile/iPad (`components/admin/AdminShell.tsx`).

**Primary tabs:** Calendar (`/admin/bookings`, with month/day/list views and a full amend/reschedule/cancel workflow), Checkout (`/admin/checkout`, balances to collect), Availability (`/admin/availability`), Clients (`/admin/customers`), Menu (`/admin/menu`).

**Menu sections** (defined in `lib/admin/nav.ts`):

| Group | Pages |
|---|---|
| Catalogue | Service Categories, Services, Add-ons, Trending Deals |
| Shop | Products (bundles, variants, media), Orders (fulfilment and refunds), Discounts, Stock |
| Content | Gallery |
| Scheduling | Blocked Dates |
| Account | Settings (studio hours, booking rules, shipping) |

After an admin change, `lib/revalidate.ts` refreshes the cached public pages so the change shows up on the live site.

---

## 7. Data model (Supabase)

Built from `supabase/migrations/` in numeric order. Main tables:

| Area | Tables |
|---|---|
| Catalogue | `service_categories`, `services` (base + hair-included price/duration, notes, image), `service_addons` |
| Bookings | `bookings` (lifecycle: `pending_payment` → `confirmed` / `cancelled` / `completed` / `no_show` / `expired`; reminder flags; balance collection), `booking_addons`, `booking_bundles` (price snapshots) |
| Scheduling | `studio_hours` (open/closed per weekday), `booking_settings`, `blocked_dates`, `slot_overrides` |
| Shop | `bundles`, `bundle_variants` (length/colour/price/stock, shared by the shop and booking add-ons), `bundle_media`, `shop_orders` (jsonb item snapshots), `discount_codes`, `shipping_settings`, `preorder_notifications` |
| Content | `gallery_images` |
| Auth | `admins` |

Media (product videos and images, deal images, gallery uploads) lives in the public Storage bucket **`product-media`**. The admin uploads straight from the browser to Storage.

---

## 8. Running locally

```bash
npm install
```

```bash
cp .env.example .env.local   # then fill in the values, see docs/INTEGRATIONS.md
```

```bash
npm run dev                  # http://localhost:3000
```

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe   # needed for bookings to confirm locally
```

Environment variables (full list in `.env.example`): Supabase URL, anon key and service-role key; Stripe secret, publishable and webhook keys; `RESEND_API_KEY`, `EMAIL_REPLY_TO`; `NEXT_PUBLIC_SITE_URL`; `CRON_SECRET`.

Schema changes go in a new numbered file under `supabase/migrations/` and are applied with `supabase db push`.

---

## 9. Gotchas worth knowing up front

- **Stale data on the live site?** Both server Supabase clients in `lib/supabase/server.ts` force `cache: 'no-store'` on every fetch, because Vercel was caching Supabase's internal requests. Keep that in place.
- **Never confirm a booking or order from the browser.** Only the Stripe webhook does that.
- **Owner notification addresses** are hard-coded in `lib/site.ts` (`ADMIN_NOTIFICATION_EMAILS`) on purpose. A bad env-var value once caused every notification to fail without any error.
- **Missing images:** `services-carousel-*.jpg` and `cta-banner.jpg` are referenced in `lib/site.ts` but have not been supplied yet. Drop them into `public/Mireluxe-Studios/Images/` and they will appear with no code change.
- **Feature flags:** the hair-included homepage carousel is hidden behind `components/home/featureFlags.ts`.
- **Running `npm run build` while `next dev` is running** corrupts the dev cache. Restart dev afterwards (`rm -rf .next`).
- **Never add debug endpoints to public routes.** Run a local script against the service-role key instead.

See [`PROJECT-STATUS.md`](./PROJECT-STATUS.md) for the full list of open items and process rules.
