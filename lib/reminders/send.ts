import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { STUDIO, REMINDER_WINDOWS } from "./config";
import { buildEmail, ReminderBooking, ReminderKind } from "./template";
import { buildIcs } from "./ics";

const SENT_COLUMN: Record<ReminderKind, string> = {
  confirmation: "confirmation_sent_at",
  "48h": "reminder_48h_sent_at",
  "24h": "reminder_24h_sent_at",
};

export function adminClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

/** Row shape of the `booking_reminder_view` view (see migration). */
type ViewRow = {
  id: string;
  customer_name: string;
  customer_email: string;
  service_name: string;
  starts_at: string;
  duration_minutes: number;
  created_at: string;
};

const toBooking = (r: ViewRow): ReminderBooking => ({
  id: r.id,
  customerName: r.customer_name,
  customerEmail: r.customer_email,
  serviceName: r.service_name,
  startsAt: new Date(r.starts_at),
  durationMinutes: r.duration_minutes,
});

/** Send one email through Resend's HTTP API (no SDK needed). */
async function sendViaResend(kind: ReminderKind, b: ReminderBooking) {
  const { subject, html, text } = buildEmail(kind, b);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `${b.id}-${kind}`,
    },
    body: JSON.stringify({
      from: STUDIO.fromEmail,
      to: [b.customerEmail],
      reply_to: STUDIO.replyTo,
      bcc: process.env.REMINDER_BCC ? [process.env.REMINDER_BCC] : undefined,
      subject,
      html,
      text,
      attachments: [
        { filename: "miriluxe-appointment.ics", content: Buffer.from(buildIcs(b)).toString("base64") },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

/**
 * Claim → send → (release on failure). The claim is an atomic
 * "set sent_at where sent_at is null", so a booking can never get
 * the same email twice even if two cron runs overlap.
 */
async function claimAndSend(db: SupabaseClient, kind: ReminderKind, b: ReminderBooking) {
  const col = SENT_COLUMN[kind];
  const { data: claimed, error } = await db
    .from("bookings")
    .update({ [col]: new Date().toISOString() })
    .eq("id", b.id)
    .is(col, null)
    .select("id");
  if (error) throw error;
  if (!claimed?.length) return "skipped" as const; // already sent

  try {
    await sendViaResend(kind, b);
    return "sent" as const;
  } catch (e) {
    await db.from("bookings").update({ [col]: null }).eq("id", b.id); // retry next run
    throw e;
  }
}

/** Call this right after a booking is confirmed (or in your Stripe webhook). */
export async function sendBookingConfirmation(bookingId: string) {
  const db = adminClient();
  const { data, error } = await db.from("booking_reminder_view").select("*").eq("id", bookingId).single();
  if (error || !data) throw error ?? new Error(`Booking ${bookingId} not found`);
  return claimAndSend(db, "confirmation", toBooking(data as ViewRow));
}

/** Called hourly by the cron route. Sends any due 48h / 24h reminders. */
export async function runDueReminders(now = new Date()) {
  const db = adminClient();
  const results = { sent: 0, skipped: 0, failed: [] as string[] };
  const hrs = (h: number) => new Date(now.getTime() + h * 3_600_000).toISOString();

  // 48h: appointment is 24–48h away, and was booked more than 48h ahead
  // (last-minute bookings already got the confirmation, so skip the 48h one).
  const jobs: { kind: ReminderKind; from: string; to: string }[] = [
    { kind: "48h", from: hrs(REMINDER_WINDOWS["24h"]), to: hrs(REMINDER_WINDOWS["48h"]) },
    { kind: "24h", from: hrs(1), to: hrs(REMINDER_WINDOWS["24h"]) },
  ];

  for (const job of jobs) {
    const { data, error } = await db
      .from("booking_reminder_view")
      .select("*")
      .is(SENT_COLUMN[job.kind], null)
      .gt("starts_at", job.from)
      .lte("starts_at", job.to);
    if (error) throw error;

    for (const row of (data ?? []) as (ViewRow & Record<string, unknown>)[]) {
      const b = toBooking(row);
      // Skip a reminder if the booking was made inside that window —
      // the confirmation email already covered it.
      const leadHours = (b.startsAt.getTime() - new Date(row.created_at).getTime()) / 3_600_000;
      if (leadHours < REMINDER_WINDOWS[job.kind as "48h" | "24h"]) continue;
      try {
        const r = await claimAndSend(db, job.kind, b);
        results[r]++;
      } catch (e) {
        results.failed.push(`${b.id}:${job.kind}:${(e as Error).message}`);
      }
    }
  }
  return results;
}
