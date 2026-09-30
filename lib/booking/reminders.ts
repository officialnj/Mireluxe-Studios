import type { SupabaseClient } from '@supabase/supabase-js';

// Exposes the "which bookings need a reminder right now" query for another
// agent's Resend-sending job to consume (via lib import or the thin
// app/api/bookings/cron/reminders route wrapper) — this file owns the query
// logic and dedupe bookkeeping, not the email itself.

export type ReminderWindow = '48h' | '24h';

const WINDOW_HOURS: Record<ReminderWindow, number> = { '48h': 48, '24h': 24 };

const SENT_COLUMN: Record<ReminderWindow, 'reminder_48h_sent_at' | 'reminder_24h_sent_at'> = {
  '48h': 'reminder_48h_sent_at',
  '24h': 'reminder_24h_sent_at',
};

export type BookingReminderRow = {
  id: string;
  booking_ref: string;
  customer_name: string;
  customer_email: string;
  appointment_start: string;
  appointment_end: string;
  service_id: string;
  services: { name: string } | { name: string }[] | null;
};

/**
 * Bookings that need a `window` reminder sent right now: confirmed, in the
 * future, within `window` hours of now, and that specific reminder hasn't
 * been recorded as sent yet. A booking stays eligible (rather than needing a
 * narrow polling slice) until `markReminderSent` is called for it — safe
 * against a missed or late cron run, and safe to call repeatedly.
 */
export async function getBookingsNeedingReminder(
  supabase: SupabaseClient,
  window: ReminderWindow,
  now: Date = new Date()
): Promise<BookingReminderRow[]> {
  const hours = WINDOW_HOURS[window];
  const sentColumn = SENT_COLUMN[window];
  const cutoffIso = new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('bookings')
    .select('id, booking_ref, customer_name, customer_email, appointment_start, appointment_end, service_id, services(name)')
    .eq('status', 'confirmed')
    .is(sentColumn, null)
    .gt('appointment_start', now.toISOString())
    .lte('appointment_start', cutoffIso)
    .order('appointment_start', { ascending: true });

  if (error || !data) return [];
  return data as unknown as BookingReminderRow[];
}

/** Records that the `window` reminder for this booking has been sent, so it
 *  won't be returned by getBookingsNeedingReminder again. */
export async function markReminderSent(
  supabase: SupabaseClient,
  bookingId: string,
  window: ReminderWindow,
  sentAt: Date = new Date()
): Promise<boolean> {
  const sentColumn = SENT_COLUMN[window];
  const { error } = await supabase
    .from('bookings')
    .update({ [sentColumn]: sentAt.toISOString() })
    .eq('id', bookingId);
  return !error;
}
