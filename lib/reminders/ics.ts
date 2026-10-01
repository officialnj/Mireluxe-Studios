import { STUDIO } from "./config";
import type { ReminderBooking } from "./template";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escIcs = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

/** Calendar invite so clients can add the appointment in one tap. */
export function buildIcs(b: ReminderBooking): string {
  const end = new Date(b.startsAt.getTime() + b.durationMinutes * 60_000);
  const a = STUDIO.address;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MIRILUXE Studios//Bookings//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:booking-${b.id}@miriluxe.co.uk`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(b.startsAt)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escIcs(`${b.serviceName} – ${STUDIO.name}`)}`,
    `LOCATION:${escIcs(`${a.line1}, ${a.line2}, ${a.town} ${a.postcode}`)}`,
    `DESCRIPTION:${escIcs(`Arrive with hair freshly blow-dried, no oils/conditioners. Bring cash. Sign your car in at reception within 10 min. Stylist: ${STUDIO.phone}`)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Appointment in 2 hours",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
