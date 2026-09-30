import { CONTACT } from '@/lib/site';
import type { DbBooking, DbService } from './types';

// Owned here (the booking engine knows appointment_start/end + service
// duration/name); actual email attaching/sending belongs to a different
// agent's email templates/sending code, which just calls this and attaches
// the result as a `text/calendar` part.

function toIcsUtc(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(
    d.getUTCMinutes()
  )}${pad(d.getUTCSeconds())}Z`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/** RFC 5545 line folding at 75 octets (simplified, char-based). */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    chunks.push(rest.slice(0, 75));
    rest = ' ' + rest.slice(75);
  }
  chunks.push(rest);
  return chunks.join('\r\n');
}

/**
 * Generates a single-event .ics calendar invite for a confirmed booking.
 * Pure/synchronous — takes the already-fetched booking + service rows, does
 * no I/O. Uses CRLF line endings and folding per RFC 5545.
 */
export function generateBookingIcs(booking: DbBooking, service: DbService): string {
  const dtstamp = toIcsUtc(new Date().toISOString());
  const dtstart = toIcsUtc(booking.appointment_start);
  const dtend = toIcsUtc(booking.appointment_end);
  const summary = escapeIcsText(`${service.name} — MIRILUXE Studios`);
  const description = escapeIcsText(
    `Booking reference: ${booking.booking_ref}\nService: ${service.name}\n` +
      `Please arrive with clean, product-free hair as discussed at booking.`
  );
  const location = escapeIcsText(CONTACT.address);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MIRILUXE Studios//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${booking.id}@mireluxestudios.co.uk`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.map(foldLine).join('\r\n') + '\r\n';
}
