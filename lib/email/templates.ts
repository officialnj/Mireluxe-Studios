import { formatInTimeZone } from 'date-fns-tz';
import { CANCELLATION_POLICY_PLACEHOLDER, STUDIO_TIMEZONE } from '@/lib/booking/constants';
import { formatPence } from '@/lib/booking/pricing';
import { CONTACT } from '@/lib/site';
import type { DbBooking, DbService } from '@/lib/booking/types';

type EmailContent = { subject: string; html: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatAppointment(booking: DbBooking): string {
  const start = new Date(booking.appointment_start);
  const date = formatInTimeZone(start, STUDIO_TIMEZONE, 'EEEE d MMMM yyyy');
  const time = formatInTimeZone(start, STUDIO_TIMEZONE, 'h:mmaaa');
  return `${date} at ${time}`;
}

function row(label: string, value: string): string {
  return `<tr><td style="padding:6px 0;color:#666;">${label}</td><td style="padding:6px 0;text-align:right;">${value}</td></tr>`;
}

export function customerConfirmationEmail(booking: DbBooking, service: DbService): EmailContent {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mireluxestudios.co.uk';
  const balancePence = booking.total_price_pence - booking.deposit_paid_pence;

  return {
    subject: `Booking confirmed — ${booking.booking_ref}`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; color:#1a1a1a;">
        <h1 style="font-size: 22px; font-weight: 400;">Your booking is confirmed</h1>
        <p>Hi ${escapeHtml(booking.customer_name)},</p>
        <p>Thank you for booking with MIRILUXE Studios. Here are your appointment details:</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          ${row('Reference', `<strong>${escapeHtml(booking.booking_ref)}</strong>`)}
          ${row('Service', escapeHtml(service.name))}
          ${row('Date &amp; time', formatAppointment(booking))}
          ${row('Deposit paid', formatPence(booking.deposit_paid_pence))}
          ${row('Balance at appointment', formatPence(balancePence))}
        </table>
        <p style="color:#666;">Studio address: ${escapeHtml(CONTACT.address)}</p>
        <p style="color:#666;font-size:13px;">${CANCELLATION_POLICY_PLACEHOLDER}</p>
        <p><a href="${siteUrl}/about">Read our full studio policies</a></p>
        <p>We can't wait to see you.<br/>MIRILUXE Studios</p>
      </div>
    `,
  };
}

export function ownerNotificationEmail(booking: DbBooking, service: DbService): EmailContent {
  return {
    subject: `New booking — ${booking.booking_ref}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color:#1a1a1a;">
        <h1 style="font-size: 20px;">New booking received</h1>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          ${row('Reference', escapeHtml(booking.booking_ref))}
          ${row('Client', escapeHtml(booking.customer_name))}
          ${row('Email', escapeHtml(booking.customer_email))}
          ${row('Phone', escapeHtml(booking.customer_phone))}
          ${row('Service', escapeHtml(service.name))}
          ${row('Date &amp; time', formatAppointment(booking))}
          ${row('Deposit paid', formatPence(booking.deposit_paid_pence))}
          ${booking.notes ? row('Notes', escapeHtml(booking.notes)) : ''}
        </table>
      </div>
    `,
  };
}
