# MIRILUXE Studios — Integrations & Deployment Guide

This is the step-by-step guide for wiring up Stripe (payments) and Resend
(transactional email), and for setting environment variables on whichever
hosting platform is authoritative — **both Netlify and Vercel are covered
below** since that hasn't been settled yet for this project.

Nobody but you should ever type a real secret into this repo. Every value
below is entered by you, directly into the Stripe/Resend dashboard and the
Netlify/Vercel environment-variable UI — never into a file that gets
committed. `.env.example` (repo root) lists every variable name with a
placeholder; copy it to `.env.local` for local dev and fill in real values
there (`.env.local` is git-ignored).

---

## 1. Stripe (payments + deposits)

### 1.1 Get test-mode API keys

1. Go to <https://dashboard.stripe.com> and sign in (or create an account).
2. Make sure the dashboard toggle in the top-left reads **Test mode** (it's
   orange/amber when live, grey when test — always start in test mode).
3. In the left sidebar: **Developers → API keys**.
4. Copy the **Publishable key** (starts `pk_test_...`) and the **Secret key**
   (starts `sk_test_...`, click "Reveal test key" first).
5. Put them in `.env.local`:
   - `STRIPE_PUBLISHABLE_KEY=pk_test_...`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...` (same value — the
     `NEXT_PUBLIC_` copy is what actually reaches the browser bundle)
   - `STRIPE_SECRET_KEY=sk_test_...`

### 1.2 Create the webhook endpoint

The booking flow only ever becomes "confirmed" via the Stripe webhook
(`app/api/webhooks/stripe/route.ts`), never from the browser — so this step
is required for bookings to work at all, even in dev.

1. Stripe dashboard → **Developers → Webhooks → Add endpoint**.
2. Endpoint URL depends on where you're deploying:
   - **Vercel**: `https://<your-vercel-domain>/api/webhooks/stripe`
     (e.g. `https://mireluxe-studios.vercel.app/api/webhooks/stripe`, or your
     custom domain once attached to the Vercel project)
   - **Netlify**: `https://<your-netlify-domain>/api/webhooks/stripe`
     (e.g. `https://mireluxe-studios.netlify.app/api/webhooks/stripe` — Next.js
     API routes are served the same way on Netlify via the Next.js runtime
     plugin, same path, no `/.netlify/functions/` prefix needed)
3. Select events: `payment_intent.succeeded` and
   `checkout.session.completed` (the webhook handler listens for both; only
   the first fires in the current PaymentIntent-based checkout flow, the
   second is handled defensively).
4. Click **Add endpoint**, then open it and click **Reveal signing secret**
   (`whsec_...`). Put it in `.env.local` / your host's env settings as
   `STRIPE_WEBHOOK_SECRET`.
5. **Local development**: instead of a dashboard webhook, run the Stripe CLI
   so events reach `localhost`:
   ```
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   This prints its own `whsec_...` — use that one for local `.env.local`
   instead of the dashboard's (they're different secrets per endpoint).

### 1.3 Add the env vars on Netlify AND Vercel

Do this on **whichever platform(s) are actually deployed** — if you're not
sure which is authoritative right now, set them on both so neither
deployment breaks.

**Vercel:**
1. Project → **Settings** tab → **Environment Variables** (left nav).
2. Add each variable name/value, and tick which environments it applies to
   (Production / Preview / Development). For secrets like
   `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, Production is the
   important one — add Preview too if you test webhooks against preview
   deploys.
3. Redeploy (Vercel doesn't hot-apply env var changes to an already-running
   deployment — trigger a new deploy from the **Deployments** tab, or push a
   commit).

**Netlify:**
1. Site → **Site configuration** → **Environment variables** (or the older
   path: **Site settings → Build & deploy → Environment**, depending on
   Netlify's current UI version).
2. **Add a variable** for each one. Netlify lets you scope by deploy context
   (Production / Deploy previews / Branch deploys) — same idea as Vercel's
   environments.
3. Trigger a redeploy from **Deploys → Trigger deploy → Deploy site** for the
   new values to take effect.

### 1.4 Run a full test booking

1. With test-mode keys + webhook wired up, go to `/book` on your deployed
   (or local, with `stripe listen` running) site and go through a real
   booking.
2. At the payment step, use a Stripe test card:
   - `4242 4242 4242 4242` — succeeds. Any future expiry date, any 3-digit
     CVC, any postcode.
   - `4000 0000 0000 9995` — fails with "insufficient funds", useful for
     testing the pending/retry path (booking should stay `pending_payment`,
     never flip to `expired` immediately — see
     `lib/booking/constants.ts`'s `BOOKING_HOLD_MINUTES`).
   - Full list: <https://stripe.com/docs/testing>.
3. Confirm in the Stripe dashboard (**Payments**) that the PaymentIntent
   shows as succeeded, and in Supabase that the `bookings` row flipped to
   `status = 'confirmed'`.
4. Confirm the customer + owner confirmation emails arrived (see §2) — if
   `RESEND_API_KEY` isn't set yet, email sending fails silently by design
   (the booking is still confirmed regardless; see the `try/catch` in
   `app/api/webhooks/stripe/route.ts`), so check server logs for the
   swallowed error if emails don't show up.

### 1.5 Flipping to live mode later

1. Complete Stripe's account activation (business details, bank account) —
   dashboard will prompt for this.
2. Toggle the dashboard to **Live mode**, repeat §1.1 to get live keys
   (`pk_live_...` / `sk_live_...`) and §1.2 to create a **new** live-mode
   webhook endpoint (test and live webhooks are entirely separate — the live
   one gets its own `whsec_...`).
3. Replace the env vars on your host (§1.3) with the live values. Do this as
   an atomic swap (all four Stripe vars at once) — a live secret key paired
   with a test webhook secret (or vice versa) will silently fail signature
   verification on every event.
4. Re-run §1.4 once against live mode with a real card and a real (small,
   refundable) booking before announcing it's live.

---

## 2. Email (Resend)

Resend is the **only** email-sending mechanism in this codebase
(`lib/resend.ts`). Outlook (`Mireluxestudios@outlook.com`) is **only** the
reply-to / admin-alert mailbox that customer replies and internal
notifications land in — it is never used as an SMTP relay, and nothing here
should ever be reconfigured to send mail directly through Outlook/Microsoft
365 SMTP. Keep it that way: Resend handles deliverability, SPF/DKIM
authentication, and bounce/complaint handling, which a shared Outlook mailbox
cannot do reliably at volume.

### 2.1 Create a Resend account and get an API key

1. Sign up at <https://resend.com>.
2. Dashboard → **API Keys → Create API Key**. Name it something like
   `miriluxe-production` (create a separate one per environment if you want
   to be able to revoke dev/staging access independently of production).
3. Copy the key (starts `re_...`) — Resend only shows it once. Set it as
   `RESEND_API_KEY` locally and on both hosts (§2.4).

### 2.2 Verify the sending domain (`miriluxe.co.uk`)

Resend needs to send FROM this domain (the code hardcodes
`bookings@miriluxe.co.uk` as the from-address today), which means the
domain has to prove to email providers (Gmail, Outlook, etc.) that Resend is
allowed to send on its behalf. Do this once:

1. Resend dashboard → **Domains → Add Domain** → enter `miriluxe.co.uk`.
2. Resend shows a list of DNS records to add at whoever hosts the domain's
   DNS (registrar or a separate DNS provider — check where
   `miriluxe.co.uk`'s nameservers currently point). You'll typically
   see:
   - **SPF (TXT record)** — a plain-language allowlist: it tells other mail
     servers "these are the only servers allowed to send email claiming to
     be from this domain." Resend gives you the exact TXT value to add
     (usually `v=spf1 include:resend... ~all`, or Resend adds itself to an
     existing SPF record if one already exists — a domain can only have
     ONE SPF TXT record, so if `miriluxe.co.uk` already has one for
     something else, that record needs to be merged, not duplicated).
   - **DKIM (TXT/CNAME records)** — a cryptographic signature: Resend signs
     every outgoing email with a private key, and the DKIM DNS record
     publishes the matching public key so receiving mail servers can verify
     the email wasn't forged or altered in transit. Resend gives you one or
     more CNAME or TXT records (usually under a `resend._domainkey`-style
     subdomain) — add exactly as shown.
   - **DMARC (TXT record)** — the policy layer: it tells receiving servers
     what to do if a message claims to be from `miriluxe.co.uk` but
     FAILS both SPF and DKIM (quarantine it, reject it, or just report it).
     A safe starting record is
     `v=DMARC1; p=none; rua=mailto:<an-inbox-you-monitor>` — `p=none` means
     "don't block anything yet, just tell me about failures," which is the
     right starting posture before tightening to `p=quarantine` or
     `p=reject` once you've confirmed legitimate mail isn't being flagged.
3. Add all the records Resend lists, at your DNS provider's dashboard (this
   step happens outside this repo, in whatever registrar/DNS panel manages
   `miriluxe.co.uk`).
4. Back in Resend, click **Verify** (DNS propagation can take anywhere from a
   few minutes to ~48 hours; Resend will show each record as pending/verified
   individually).
5. Until verification completes, Resend will only let you send from its
   default `onboarding@resend.dev` sender or to your own verified account
   email — real customer sends from `bookings@miriluxe.co.uk` will
   fail until the domain shows fully verified.

### 2.3 Reply-to / admin-alert address

Every template in `lib/email/templates.ts` sets
`replyTo: Mireluxestudios@outlook.com` (overridable via the `EMAIL_REPLY_TO`
env var — see `.env.example`). This is separate from
`ADMIN_NOTIFICATION_EMAIL`, which is who *new-booking notification* emails
are addressed **to**; `EMAIL_REPLY_TO` is what address a customer's email
client will pre-fill if they hit "Reply" on any MIRILUXE email. Both can
point at the same Outlook mailbox, which is the current setup.

> **Known gap:** the reply-to only takes effect if the code that actually
> calls `resend.emails.send(...)` passes `replyTo` through. As of this
> writing, `app/api/webhooks/stripe/route.ts` builds its `send()` calls
> field-by-field rather than spreading the template's return value, so
> `replyTo` is currently computed by every template but **silently dropped**
> at the two send call sites in that file. That file is outside this
> workstream's ownership — see the "Gaps for other owners" section at the
> bottom of this doc for the exact one-line fix needed in each spot.

### 2.4 Add `RESEND_API_KEY` (and `EMAIL_REPLY_TO`) on Netlify and Vercel

Same navigation as §1.3:
- **Vercel**: Project → Settings → Environment Variables → add
  `RESEND_API_KEY` and `EMAIL_REPLY_TO`, redeploy.
- **Netlify**: Site → Site configuration → Environment variables → add both,
  trigger a redeploy.

---

## 3. Environment variable reference

| Variable | Purpose | Where to get it | Netlify | Vercel |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL, used client + server side | Supabase dashboard → Project Settings → API | Required | Required |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anon key (RLS-restricted) | Same page as above | Required | Required |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase key, bypasses RLS — used by all admin/webhook/cron routes via `createServiceRoleClient()` | Same page as above ("service_role" key, click reveal) | Required (server only — never expose with `NEXT_PUBLIC_`) | Required |
| `STRIPE_SECRET_KEY` | Server-side Stripe API calls (create PaymentIntent, refunds) | Stripe dashboard → Developers → API keys | Required | Required |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (server-readable copy) | Same page | Required | Required |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Same value, `NEXT_PUBLIC_`-prefixed so Next.js inlines it into the client bundle for Stripe Elements | Same page (copy `STRIPE_PUBLISHABLE_KEY`'s value) | Required | Required |
| `STRIPE_WEBHOOK_SECRET` | Verifies incoming webhook signatures in `app/api/webhooks/stripe/route.ts` | Stripe dashboard → Developers → Webhooks → your endpoint → Reveal signing secret | Required | Required |
| `RESEND_API_KEY` | Auth for all outgoing transactional email | Resend dashboard → API Keys | Required | Required |
| `EMAIL_REPLY_TO` | Reply-to address stamped on every outgoing email (see §2.3 for the current wiring gap) | Pick the mailbox the studio actually checks | Required | Required |
| `NEXT_PUBLIC_SITE_URL` | Base URL for absolute links built into emails (e.g. the "Read Studio Policies" link) and elsewhere | Your deployed domain, e.g. `https://miriluxe.co.uk` | Required | Required |
| `ADMIN_NOTIFICATION_EMAIL` | Recipient of new-booking owner-notification emails | Studio's admin inbox | Required | Required |
| `CRON_SECRET` | Bearer-token auth shared by `/api/cron/expire-bookings` and `/api/bookings/cron/reminders` | Generate yourself: `openssl rand -hex 32` | Required (and required by whatever triggers the cron — see §4) | Required |

---

## 4. Scheduling the reminder cron on both platforms

`vercel.json` at the repo root already declares a Vercel Cron Job for
`/api/cron/expire-bookings` (daily). It does **not** yet declare one for the
newer `/api/bookings/cron/reminders` endpoint — that endpoint exists and is
bearer-token protected the same way, but nothing currently calls it on a
schedule on either platform. See "Gaps for other owners" below for the exact
config needed; `vercel.json` isn't owned by this workstream (only
`docs/INTEGRATIONS.md`, `.env.example`, and `lib/email/*` are), so it's
called out rather than edited directly.

In the meantime it can be triggered manually/for testing with:
```
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://<your-domain>/api/bookings/cron/reminders?window=24h"
```

---

## 5. Gaps for other owners

These are the exact, minimal edits needed in files outside this
workstream's ownership (`app/api/**`, `vercel.json`) to fully wire up what's
built here. Nothing below has been applied to those files.

1. **`app/api/webhooks/stripe/route.ts` — reply-to is computed but dropped.**
   Both `resend.emails.send({...})` calls inside `sendConfirmationEmails` and
   `sendShopOrderConfirmationEmail` build their options object field-by-field
   instead of spreading the template's return value, so `replyTo` (now
   returned by every template in `lib/email/templates.ts`) never reaches
   Resend. Add one field to each of the three `send()` calls:
   ```ts
   await resend.emails.send({
     from: 'MIRILUXE Studios <bookings@miriluxe.co.uk>',
     to: booking.customer_email,
     subject: customerEmail.subject,
     html: customerEmail.html,
     replyTo: customerEmail.replyTo,       // ← add this line
     attachments: customerEmail.attachments, // ← add this line (ics invite)
   });
   ```
   (and the equivalent `replyTo: ownerEmail.replyTo` /
   `replyTo: email.replyTo` on the other two calls). The
   `customerConfirmationEmail` template now also returns an `attachments`
   array (the `.ics` calendar invite from `lib/booking/ics.ts`) — that field
   needs the same pass-through on the customer send call specifically.

2. **`app/api/bookings/[id]/reschedule/route.ts` — no confirmation email
   sent.** After the `updateError` check succeeds (around line 76, right
   before `return NextResponse.json({ ok: true, ... })`), send
   `rescheduleConfirmationEmail`:
   ```ts
   import { rescheduleConfirmationEmail } from '@/lib/email/templates';
   import { getResend } from '@/lib/resend';
   // ...
   const email = rescheduleConfirmationEmail(
     { ...booking, appointment_start: matchedSlot.start, appointment_end: matchedSlot.end },
     service,
     { start: booking.appointment_start, end: booking.appointment_end }, // old slot
     { start: matchedSlot.start, end: matchedSlot.end }                   // new slot
   );
   try {
     await getResend().emails.send({
       from: 'MIRILUXE Studios <bookings@miriluxe.co.uk>',
       to: booking.customer_email,
       subject: email.subject,
       html: email.html,
       replyTo: email.replyTo,
     });
   } catch {
     // best-effort, same swallow-and-log pattern as the webhook handler
   }
   ```

3. **`app/api/bookings/[id]/cancel/route.ts` — no confirmation email sent.**
   Same shape, after the cancel `updateError` check succeeds, using
   `cancellationConfirmationEmail(booking, service)` (note: `service` isn't
   currently fetched in this route — it only selects `bookings.*` — so a
   `supabase.from('services').select('*').eq('id', booking.service_id).single()`
   call needs to be added there too, matching the pattern in
   `sendConfirmationEmails` in the webhook route).

4. **`app/api/bookings/cron/reminders/route.ts` — GET only returns the list,
   nothing sends the emails.** This route's own comments say as much
   ("This route does NOT send email"). The simplest fix without inventing a
   new worker process: extend the existing `GET` handler (or add a separate
   authenticated `POST /api/bookings/cron/reminders/send`) to loop the
   result of `getBookingsNeedingReminder` and, per booking, fetch its
   service, call `reminderEmail(booking, service, hoursBefore)`, send via
   `getResend()`, then call `markReminderSent(supabase, booking.id, window)`
   — mirroring the fetch-service-then-send shape already used in
   `sendConfirmationEmails` in the Stripe webhook route. Whatever route ends
   up doing the sending also needs to actually be invoked on a schedule (see
   #5 below) — right now nothing calls it automatically on either platform.

5. **`vercel.json` — no cron entry for reminders.** Add a second entry
   alongside the existing `expire-bookings` one:
   ```json
   {
     "crons": [
       { "path": "/api/cron/expire-bookings", "schedule": "0 0 * * *" },
       { "path": "/api/bookings/cron/reminders?window=48h", "schedule": "0 9 * * *" },
       { "path": "/api/bookings/cron/reminders?window=24h", "schedule": "0 9,17 * * *" }
     ]
   }
   ```
   Vercel Cron Jobs call the path with `GET` and no custom headers, so
   `CRON_SECRET` bearer auth as currently written won't authorize a
   Vercel-triggered call — Vercel's own recommended pattern is to check
   `request.headers.get('authorization') === \`Bearer ${process.env.CRON_SECRET}\`` 
   where Vercel automatically attaches that header for Cron-Job-triggered
   requests when `CRON_SECRET` is set as an env var on the project (see
   Vercel's cron docs) — this needs verifying against however
   `isAuthorized()` is currently written in that route once cron entries are
   added.
   **Netlify has no equivalent of `vercel.json` crons.** If Netlify ends up
   the authoritative host, reminders need either a Netlify Scheduled
   Function (a separate function with a `schedule` config, which can't
   directly call a Next.js API route — it would need its own fetch/logic or
   to hit the deployed route's URL with the bearer token) or an external
   scheduler (e.g. a GitHub Actions cron, or a third-party service like
   cron-job.org) hitting `/api/bookings/cron/reminders` with the
   `Authorization: Bearer $CRON_SECRET` header on a schedule. This ambiguity
   is exactly the Netlify-vs-Vercel authority question flagged at the top of
   this doc — whichever platform is decided as authoritative determines
   which of these two paths to take.

---

## 6. Deletion candidates

Noted per the deletion-lock rule (not deleted, just flagged for whoever owns
these files):

- `lib/booking/constants.ts`'s `SLOT_INTERVAL_MINUTES` — already flagged
  in-file as unused after the switch to a fixed hourly slot grid; confirmed
  still unused by this pass, no email code references it.
- No `lib/email/*` exports became unused by this rewrite — all three
  original templates are still called from `app/api/webhooks/stripe/route.ts`
  and were rewritten in place (not replaced), per the deletion lock.
