import { formatInTimeZone } from 'date-fns-tz';
import { CANCELLATION_POLICY_PLACEHOLDER, STUDIO_TIMEZONE } from '@/lib/booking/constants';
import { formatPence } from '@/lib/booking/pricing';
import { generateBookingIcs } from '@/lib/booking/ics';
import { CONTACT } from '@/lib/site';
import type { DbBooking, DbService } from '@/lib/booking/types';

// ── Dark theme tokens ──────────────────────────────────────────────────────
// Email clients can't read Tailwind classes, so these are the site's actual
// tailwind.config.ts hex values, hardcoded here for inline styles only.
const COLOR = {
  bg: '#1a1a1a', // charcoal.DEFAULT
  surface: '#232323', // charcoal.soft
  surfaceMuted: '#2c2c2c', // charcoal.muted
  text: '#f5f1ea', // cream.DEFAULT
  textSoft: '#ede7dc', // cream.soft
  textMuted: '#b7b2a8', // dimmed cream for secondary copy — not a token, derived for email-only use
  gold: '#b08d57', // gold.DEFAULT
  goldLight: '#c6a678', // gold.light
  goldDark: '#98763f', // gold.dark
  border: 'rgba(176,141,87,0.28)', // gold at low opacity, used for hairline dividers
} as const;

// Reply-to for every outgoing email — an Outlook mailbox the studio already
// checks. Resend remains the sending relay; this is never used for SMTP.
// Overridable via EMAIL_REPLY_TO (see .env.example / docs/INTEGRATIONS.md);
// falls back to the studio's known admin mailbox if unset.
const REPLY_TO_EMAIL = process.env.EMAIL_REPLY_TO ?? 'Mireluxestudios@outlook.com';

export type EmailAttachment = {
  filename: string;
  /** Base64-encoded file content — matches the Resend `Attachment.content` contract. */
  content: string;
  contentType?: string;
};

type EmailContent = {
  subject: string;
  html: string;
  /** Every template sets this to REPLY_TO_EMAIL. The send call site must pass
   *  it through as `replyTo` (Resend SDK v6 field name) — see docs/INTEGRATIONS.md
   *  for the exact gap, since app/api/webhooks/stripe/route.ts is not owned here. */
  replyTo: string;
  attachments?: EmailAttachment[];
};

export type BundleLineInfo = {
  inches: number;
  colour: string;
  quantity: number;
  pricePence: number;
};

export type AddOnLineInfo = {
  name: string;
  priceDeltaPence: number;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatAppointment(isoStart: string): string {
  const start = new Date(isoStart);
  const date = formatInTimeZone(start, STUDIO_TIMEZONE, 'EEEE d MMMM yyyy');
  const time = formatInTimeZone(start, STUDIO_TIMEZONE, 'h:mmaaa');
  return `${date} at ${time}`;
}

/** One label/value row inside a details table. */
function row(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${COLOR.border};color:${COLOR.textMuted};font-size:13px;font-family:Helvetica,Arial,sans-serif;vertical-align:top;">${label}</td>
      <td style="padding:10px 0;border-bottom:1px solid ${COLOR.border};color:${COLOR.text};font-size:14px;font-family:Georgia,'Times New Roman',serif;text-align:right;vertical-align:top;">${value}</td>
    </tr>`;
}

/** Wraps a set of row() strings in a full-width details table. */
function detailsTable(rowsHtml: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:24px 0;">${rowsHtml}</table>`;
}

function bundleLinesText(bundleLines: BundleLineInfo[]): string {
  if (bundleLines.length === 0) return '';
  return bundleLines
    .map(
      (line) =>
        `${line.quantity}&times; ${line.inches}&Prime; bundle (${escapeHtml(line.colour)}) &mdash; ${formatPence(line.pricePence * line.quantity)}`
    )
    .join('<br/>');
}

function addOnLinesText(addOnLines: AddOnLineInfo[]): string {
  if (addOnLines.length === 0) return '';
  return addOnLines
    .map((line) => {
      const sign = line.priceDeltaPence < 0 ? '&minus;' : '';
      return `${escapeHtml(line.name)} &mdash; ${sign}${formatPence(Math.abs(line.priceDeltaPence))}`;
    })
    .join('<br/>');
}

function ctaButton(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 4px;">
      <tr>
        <td bgcolor="${COLOR.gold}" style="border-radius:6px;">
          <a href="${href}" style="display:inline-block;padding:13px 28px;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;color:${COLOR.bg};text-decoration:none;border-radius:6px;">${label}</a>
        </td>
      </tr>
    </table>`;
}

/**
 * Shared dark-theme shell for every transactional email. Table-based markup
 * with inline styles only (no <style> blocks, no Tailwind classes) so it
 * renders consistently dark across Gmail, Apple Mail and Outlook desktop.
 */
function emailShell(opts: { eyebrow: string; heading: string; bodyHtml: string; preheader?: string }): string {
  const { eyebrow, heading, bodyHtml, preheader } = opts;
  return `
    <div style="background-color:${COLOR.bg};padding:0;margin:0;">
      ${
        preheader
          ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COLOR.bg};">${escapeHtml(preheader)}</div>`
          : ''
      }
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${COLOR.bg}" style="background-color:${COLOR.bg};padding:32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${COLOR.surface}" style="max-width:520px;width:100%;background-color:${COLOR.surface};border:1px solid ${COLOR.border};border-radius:12px;overflow:hidden;">
              <tr>
                <td bgcolor="${COLOR.gold}" style="height:4px;line-height:4px;font-size:0;background-color:${COLOR.gold};">&nbsp;</td>
              </tr>
              <tr>
                <td style="padding:36px 32px 8px;text-align:center;">
                  <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:${COLOR.gold};">MIRILUXE Studios</div>
                </td>
              </tr>
              <tr>
                <td style="padding:4px 32px 0;text-align:center;">
                  <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${COLOR.textMuted};">${escapeHtml(eyebrow)}</div>
                  <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:24px;line-height:1.3;color:${COLOR.text};margin:10px 0 0;">${escapeHtml(heading)}</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 32px 8px;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.6;color:${COLOR.textSoft};">
                  ${bodyHtml}
                </td>
              </tr>
              <tr>
                <td bgcolor="${COLOR.surfaceMuted}" style="background-color:${COLOR.surfaceMuted};padding:24px 32px;text-align:center;border-top:1px solid ${COLOR.border};">
                  <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:${COLOR.textMuted};line-height:1.7;">
                    ${escapeHtml(CONTACT.address)}<br/>
                    <a href="mailto:${CONTACT.email}" style="color:${COLOR.goldLight};text-decoration:none;">${CONTACT.email}</a>
                    &nbsp;&middot;&nbsp;
                    <a href="tel:${CONTACT.phone.replace(/\s+/g, '')}" style="color:${COLOR.goldLight};text-decoration:none;">${CONTACT.phone}</a>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>`;
}

function noteBox(html: string): string {
  return `
    <div style="margin:20px 0;padding:14px 16px;background-color:${COLOR.surfaceMuted};border-left:3px solid ${COLOR.gold};border-radius:4px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:${COLOR.textSoft};">
      ${html}
    </div>`;
}

// ── 1. Booking confirmation ──────────────────────────────────────────────

export function customerConfirmationEmail(
  booking: DbBooking,
  service: DbService,
  bundleLines: BundleLineInfo[],
  addOnLines: AddOnLineInfo[] = []
): EmailContent {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://miriluxe.co.uk';
  const balancePence = booking.total_price_pence - booking.deposit_paid_pence;
  const priceTierLabel = booking.hair_included ? `${service.name} (hair included)` : service.name;

  const rows =
    row('Reference', `<strong>${escapeHtml(booking.booking_ref)}</strong>`) +
    row('Service', escapeHtml(priceTierLabel)) +
    row('Date &amp; time', formatAppointment(booking.appointment_start)) +
    (addOnLines.length > 0 ? row('Extras', addOnLinesText(addOnLines)) : '') +
    (bundleLines.length > 0 ? row('Bundles', bundleLinesText(bundleLines)) : '') +
    row('Deposit paid', formatPence(booking.deposit_paid_pence)) +
    row('Balance at appointment', formatPence(balancePence));

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi ${escapeHtml(booking.customer_name)},</p>
    <p style="margin:0 0 8px;">Thank you for booking with MIRILUXE Studios. Here are your appointment details:</p>
    ${detailsTable(rows)}
    ${noteBox(
      '<strong style="color:' +
        COLOR.text +
        ';">Before your appointment:</strong> please arrive with natural hair freshly washed and blow-dried, free of any oils or conditioners.'
    )}
    <p style="font-size:13px;color:${COLOR.textMuted};margin:16px 0;">${CANCELLATION_POLICY_PLACEHOLDER}</p>
    <p style="text-align:center;font-size:13px;color:${COLOR.textMuted};margin:8px 0 0;">A calendar invite for this appointment is attached to this email.</p>
    ${ctaButton(`${siteUrl}/book/manage/${booking.id}`, 'Manage Your Booking')}
    <p style="text-align:center;margin:8px 0 0;"><a href="${siteUrl}/about" style="color:${COLOR.goldLight};font-size:12px;">Read our full studio policies</a></p>
    <p style="margin:24px 0 0;">We can't wait to see you.<br/>MIRILUXE Studios</p>
  `;

  const html = emailShell({
    eyebrow: 'Booking Confirmed',
    heading: 'Your crown is booked',
    preheader: `Booking ${booking.booking_ref} confirmed for ${formatAppointment(booking.appointment_start)}`,
    bodyHtml,
  });

  const ics = generateBookingIcs(booking, service);
  const icsBase64 = Buffer.from(ics, 'utf-8').toString('base64');

  return {
    subject: `Booking confirmed — ${booking.booking_ref}`,
    html,
    replyTo: REPLY_TO_EMAIL,
    attachments: [
      {
        filename: `mireluxe-booking-${booking.booking_ref}.ics`,
        content: icsBase64,
        contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
      },
    ],
  };
}

// ── 2. Shop order confirmation ───────────────────────────────────────────

export type ShopOrderItem = { slug: string; name: string; quantity: number; pricePence: number };

export type ShopOrder = {
  id: string;
  customer_name: string;
  customer_email: string;
  shipping_line1: string;
  shipping_line2: string | null;
  shipping_city: string;
  shipping_postcode: string;
  shipping_country: string;
  items: ShopOrderItem[];
  subtotal_pence: number;
};

export function shopOrderConfirmationEmail(order: ShopOrder): EmailContent {
  const itemsHtml = order.items
    .map((item) => `${item.quantity}&times; ${escapeHtml(item.name)} &mdash; ${formatPence(item.pricePence * item.quantity)}`)
    .join('<br/>');
  const address = [order.shipping_line1, order.shipping_line2, order.shipping_city, order.shipping_postcode, order.shipping_country]
    .filter(Boolean)
    .map((part) => escapeHtml(part as string))
    .join(', ');

  const rows = row('Items', itemsHtml) + row('Total', formatPence(order.subtotal_pence)) + row('Shipping to', address);

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi ${escapeHtml(order.customer_name)},</p>
    <p style="margin:0 0 8px;">Thank you for your order from MIRILUXE Studios. Here's what's on its way:</p>
    ${detailsTable(rows)}
    <p style="margin:24px 0 0;">We can't wait for you to try it.<br/>MIRILUXE Studios</p>
  `;

  return {
    subject: 'Order confirmed — MIRILUXE Studios',
    html: emailShell({ eyebrow: 'Order Confirmed', heading: 'Your order is on its way', bodyHtml }),
    replyTo: REPLY_TO_EMAIL,
  };
}

// ── 3. Owner/admin new-booking notification ──────────────────────────────

export function ownerNotificationEmail(
  booking: DbBooking,
  service: DbService,
  bundleLines: BundleLineInfo[],
  addOnLines: AddOnLineInfo[] = []
): EmailContent {
  const priceTierLabel = booking.hair_included ? `${service.name} (hair included)` : service.name;

  const rows =
    row('Reference', escapeHtml(booking.booking_ref)) +
    row('Client', escapeHtml(booking.customer_name)) +
    row('Email', escapeHtml(booking.customer_email)) +
    row('Phone', escapeHtml(booking.customer_phone)) +
    row('Service', escapeHtml(priceTierLabel)) +
    row('Date &amp; time', formatAppointment(booking.appointment_start)) +
    (service.xpression_packs ? row('Xpression packs needed', escapeHtml(service.xpression_packs)) : '') +
    (addOnLines.length > 0 ? row('Extras', addOnLinesText(addOnLines)) : '') +
    (bundleLines.length > 0 ? row('Bundles', bundleLinesText(bundleLines)) : '') +
    row('Deposit paid', formatPence(booking.deposit_paid_pence)) +
    (booking.notes ? row('Notes', escapeHtml(booking.notes)) : '');

  const bodyHtml = `
    <p style="margin:0 0 8px;">A new booking has just been confirmed.</p>
    ${detailsTable(rows)}
  `;

  return {
    subject: `New booking — ${booking.booking_ref}`,
    html: emailShell({ eyebrow: 'New Booking', heading: 'New booking received', bodyHtml }),
    replyTo: REPLY_TO_EMAIL,
  };
}

// ── 4. Appointment reminder (48h / 24h) ──────────────────────────────────

export function reminderEmail(booking: DbBooking, service: DbService, hoursBefore: 48 | 24): EmailContent {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://miriluxe.co.uk';
  const priceTierLabel = booking.hair_included ? `${service.name} (hair included)` : service.name;
  const whenLabel = hoursBefore === 48 ? 'in 2 days' : 'tomorrow';

  const rows =
    row('Reference', escapeHtml(booking.booking_ref)) +
    row('Service', escapeHtml(priceTierLabel)) +
    row('Date &amp; time', formatAppointment(booking.appointment_start));

  // Self-service reschedule/cancel closes at the same 48h cutoff as the
  // 48h-out reminder itself (see SELF_SERVICE_CUTOFF_MINUTES), so only the
  // 48h reminder can honestly offer a working "Manage Your Booking" link —
  // by the 24h reminder that link's actions would already 409.
  const manageSection =
    hoursBefore === 48
      ? ctaButton(`${siteUrl}/book/manage/${booking.id}`, 'Manage Your Booking')
      : `<p style="font-size:13px;color:${COLOR.textMuted};margin:16px 0;text-align:center;">Need to make a change? It's inside 48 hours now, so please call or email the studio directly rather than using the online reschedule/cancel link.</p>`;

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi ${escapeHtml(booking.customer_name)},</p>
    <p style="margin:0 0 8px;">Just a friendly reminder that your MIRILUXE appointment is ${whenLabel}.</p>
    ${detailsTable(rows)}
    ${noteBox(
      '<strong style="color:' +
        COLOR.text +
        ';">Before your appointment:</strong> please arrive with natural hair freshly washed and blow-dried, free of any oils or conditioners.'
    )}
    ${manageSection}
    <p style="margin:24px 0 0;">See you soon.<br/>MIRILUXE Studios</p>
  `;

  return {
    subject: hoursBefore === 48 ? `Reminder: your appointment is in 2 days — ${booking.booking_ref}` : `Reminder: your appointment is tomorrow — ${booking.booking_ref}`,
    html: emailShell({
      eyebrow: 'Appointment Reminder',
      heading: `Your appointment is ${whenLabel}`,
      preheader: `${escapeHtml(priceTierLabel)} on ${formatAppointment(booking.appointment_start)}`,
      bodyHtml,
    }),
    replyTo: REPLY_TO_EMAIL,
  };
}

// ── 5. Reschedule confirmation ────────────────────────────────────────────

/** Minimal slot shape needed to describe an old/new appointment time —
 *  intentionally narrower than TimeSlot (no `label`) since callers usually
 *  only have ISO start/end on hand (e.g. booking.appointment_start/end
 *  before/after the update). */
export type SlotInfo = { start: string; end: string };

export function rescheduleConfirmationEmail(
  booking: DbBooking,
  service: DbService,
  oldSlot: SlotInfo,
  newSlot: SlotInfo
): EmailContent {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://miriluxe.co.uk';
  const priceTierLabel = booking.hair_included ? `${service.name} (hair included)` : service.name;

  const rows =
    row('Reference', escapeHtml(booking.booking_ref)) +
    row('Service', escapeHtml(priceTierLabel)) +
    row('Previous time', `<span style="text-decoration:line-through;color:${COLOR.textMuted};">${formatAppointment(oldSlot.start)}</span>`) +
    row('New time', `<strong>${formatAppointment(newSlot.start)}</strong>`);

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi ${escapeHtml(booking.customer_name)},</p>
    <p style="margin:0 0 8px;">Your appointment has been rescheduled. Here's your updated booking:</p>
    ${detailsTable(rows)}
    <p style="font-size:13px;color:${COLOR.textMuted};margin:16px 0;">${CANCELLATION_POLICY_PLACEHOLDER}</p>
    ${ctaButton(`${siteUrl}/book/manage/${booking.id}`, 'Manage Your Booking')}
    <p style="margin:24px 0 0;">See you at your new time.<br/>MIRILUXE Studios</p>
  `;

  return {
    subject: `Booking rescheduled — ${booking.booking_ref}`,
    html: emailShell({
      eyebrow: 'Booking Rescheduled',
      heading: 'Your appointment has moved',
      preheader: `New time: ${formatAppointment(newSlot.start)}`,
      bodyHtml,
    }),
    replyTo: REPLY_TO_EMAIL,
  };
}

// ── 6. Cancellation confirmation ─────────────────────────────────────────

export function cancellationConfirmationEmail(booking: DbBooking, service: DbService): EmailContent {
  const priceTierLabel = booking.hair_included ? `${service.name} (hair included)` : service.name;

  const rows =
    row('Reference', escapeHtml(booking.booking_ref)) +
    row('Service', escapeHtml(priceTierLabel)) +
    row('Was scheduled for', formatAppointment(booking.appointment_start)) +
    row('Deposit paid', formatPence(booking.deposit_paid_pence));

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi ${escapeHtml(booking.customer_name)},</p>
    <p style="margin:0 0 8px;">This confirms your MIRILUXE Studios appointment has been cancelled.</p>
    ${detailsTable(rows)}
    ${noteBox(
      'As this cancellation was made outside our 48-hour window, your deposit refund is being processed automatically and should appear back on your original payment method within 5&ndash;10 business days.'
    )}
    <p style="margin:24px 0 0;">We hope to welcome you back soon.<br/>MIRILUXE Studios</p>
  `;

  return {
    subject: `Booking cancelled — ${booking.booking_ref}`,
    html: emailShell({ eyebrow: 'Booking Cancelled', heading: 'Your appointment is cancelled', bodyHtml }),
    replyTo: REPLY_TO_EMAIL,
  };
}
