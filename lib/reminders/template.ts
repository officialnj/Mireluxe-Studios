import { STUDIO, POLICIES } from "./config";

export type ReminderKind = "confirmation" | "48h" | "24h";

export type ReminderBooking = {
  id: string;
  customerName: string;
  customerEmail: string;
  serviceName: string;
  startsAt: Date;
  durationMinutes: number;
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );

const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: STUDIO.timezone, ...opts }).format(d);

export function formatWhen(b: ReminderBooking) {
  const end = new Date(b.startsAt.getTime() + b.durationMinutes * 60_000);
  const date = fmt(b.startsAt, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const start = fmt(b.startsAt, { hour: "2-digit", minute: "2-digit", hour12: false });
  const finish = fmt(end, { hour: "2-digit", minute: "2-digit", hour12: false });
  const h = Math.floor(b.durationMinutes / 60);
  const m = b.durationMinutes % 60;
  const length = [h && `${h} hr${h > 1 ? "s" : ""}`, m && `${m} min`].filter(Boolean).join(" ");
  return { date, start, finish, length };
}

const COPY: Record<ReminderKind, { subject: (b: ReminderBooking, w: ReturnType<typeof formatWhen>) => string; eyebrow: string; heading: string; intro: (first: string) => string }> = {
  confirmation: {
    subject: (b, w) => `You're booked: ${b.serviceName} on ${w.date} at ${w.start}`,
    eyebrow: "Booking confirmed",
    heading: "You're booked in",
    intro: (n) => `Hi ${n}, thank you for booking with ${STUDIO.name}. Your appointment details are below. Please read the policies so everything runs smoothly on the day.`,
  },
  "48h": {
    subject: (b, w) => `2 days to go: ${b.serviceName}, ${w.date} at ${w.start}`,
    eyebrow: "Appointment reminder",
    heading: "See you in 2 days",
    intro: (n) => `Hi ${n}, just a reminder that your appointment is coming up. Now is a good time to wash and blow-dry your hair so it's oil- and conditioner-free on the day.`,
  },
  "24h": {
    subject: (b, w) => `Tomorrow at ${w.start}: ${b.serviceName}`,
    eyebrow: "Appointment reminder",
    heading: "See you tomorrow",
    intro: (n) => `Hi ${n}, your appointment is tomorrow. Please remember to arrive with freshly blow-dried hair, bring cash, and allow time to sign your car in at reception.`,
  },
};

export function buildEmail(kind: ReminderKind, b: ReminderBooking) {
  const w = formatWhen(b);
  const c = COPY[kind];
  const C = STUDIO.colors;
  const first = b.customerName.trim().split(/\s+/)[0] || "there";
  const addr = STUDIO.address;
  const addrLine = `${addr.line1}, ${addr.line2}, ${addr.town} ${addr.postcode}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addrLine)}`;

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:10px 0;width:90px;vertical-align:top;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${C.muted};">${label}</td>
      <td style="padding:10px 0;vertical-align:top;font-size:16px;line-height:1.45;color:${C.ink};">${value}</td>
    </tr>`;

  const policies = POLICIES.map(
    (p) => `
    <tr><td style="padding:18px 0 6px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:${C.accent};font-weight:bold;">${esc(p.title)}</td></tr>
    ${p.points.map((pt) => `<tr><td style="padding:3px 0 3px 14px;font-size:14px;line-height:1.55;color:${C.ink};border-left:2px solid ${C.rule};">${esc(pt)}</td></tr>`).join("")}`
  ).join("");

  const button = (href: string, label: string, primary: boolean) =>
    `<a href="${href}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 20px;border-radius:999px;font-size:14px;font-weight:bold;text-decoration:none;${primary ? `background:${C.ink};color:#fff;` : `border:1px solid ${C.ink};color:${C.ink};`}">${label}</a>`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.heading)}</title></head>
<body style="margin:0;padding:0;background:${C.background};font-family:Georgia,'Times New Roman',serif;">
<span style="display:none;max-height:0;overflow:hidden;">${esc(b.serviceName)} · ${esc(w.date)} at ${w.start}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.background};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td align="center" style="padding-bottom:24px;font-size:22px;letter-spacing:.35em;color:${C.ink};">MIRILUXE</td></tr>
  <tr><td style="background:${C.card};border-radius:16px;padding:36px 32px;font-family:Helvetica,Arial,sans-serif;">
    <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${C.accent};font-weight:bold;">${c.eyebrow}</div>
    <h1 style="margin:8px 0 14px;font-family:Georgia,serif;font-weight:normal;font-size:30px;color:${C.ink};">${c.heading}</h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:${C.muted};">${esc(c.intro(first))}</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.rule};border-bottom:1px solid ${C.rule};">
      ${row("What", `<strong>${esc(b.serviceName)}</strong><br><span style="color:${C.muted};font-size:14px;">with ${esc(STUDIO.stylistName)}</span>`)}
      ${row("When", `${esc(w.date)}<br>${w.start} – ${w.finish} <span style="color:${C.muted};font-size:14px;">(${w.length})</span>`)}
      ${row("Where", `${esc(addr.line1)}<br>${esc(addr.line2)}, ${esc(addr.town)}<br>${esc(addr.postcode)}`)}
    </table>

    <div style="padding-top:22px;">
      ${button(mapsUrl, "Get directions", true)}
      ${button(`tel:${STUDIO.phoneIntl}`, "Call / text stylist", false)}
    </div>
    <p style="margin:6px 0 0;font-size:12px;color:${C.muted};">A calendar invite (.ics) is attached — tap it to add this to your calendar.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">${policies}</table>

    <p style="margin:28px 0 0;font-size:14px;line-height:1.6;color:${C.ink};">Any other questions, contact your stylist by phone or text on <a href="tel:${STUDIO.phoneIntl}" style="color:${C.ink};">${STUDIO.phone}</a>.</p>
    <p style="margin:18px 0 0;font-family:Georgia,serif;font-size:17px;color:${C.ink};">Hope you have a great appointment!<br><em>${esc(STUDIO.signOff)}</em></p>
  </td></tr>
  <tr><td align="center" style="padding:20px 8px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${C.muted};">
    ${esc(STUDIO.name)} · ${esc(addrLine)}<br>
    Booking ref: ${esc(b.id.slice(0, 8).toUpperCase())} · <a href="${STUDIO.website}" style="color:${C.muted};">${STUDIO.website.replace(/^https?:\/\//, "")}</a>
  </td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    `${c.heading.toUpperCase()}`,
    c.intro(first),
    "",
    `What:  ${b.serviceName} with ${STUDIO.stylistName}`,
    `When:  ${w.date}, ${w.start}–${w.finish} (${w.length})`,
    `Where: ${addrLine}`,
    `Directions: ${mapsUrl}`,
    "",
    ...POLICIES.flatMap((p) => [p.title.toUpperCase(), ...p.points.map((x) => `- ${x}`), ""]),
    `Questions? Call or text ${STUDIO.phone}.`,
    "",
    "Hope you have a great appointment!",
    STUDIO.signOff,
  ].join("\n");

  return { subject: c.subject(b, w), html, text };
}
