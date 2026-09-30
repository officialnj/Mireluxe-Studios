import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getBookingsNeedingReminder, markReminderSent, type ReminderWindow } from '@/lib/booking/reminders';
import { getResend } from '@/lib/resend';
import { reminderEmail } from '@/lib/email/templates';
import type { DbBooking, DbService } from '@/lib/booking/types';

export const dynamic = 'force-dynamic';

// Same CRON_SECRET bearer-token pattern as app/api/cron/expire-bookings.
// GET is the actual cron entry point: it fetches every booking due a 48h or
// 24h reminder, sends it via Resend, and marks it sent — a single scheduled
// hit (Vercel Cron or a Netlify Scheduled Function, see
// docs/INTEGRATIONS.md) covers both windows. POST remains available for
// manually marking a specific booking's reminder as sent (e.g. if Mirakle
// handles it by phone and wants to suppress the automated one).

const windowSchema = z.enum(['48h', '24h']);
const markBodySchema = z.object({ bookingId: z.string().uuid(), window: windowSchema });

const FROM_ADDRESS = 'MIRILUXE Studios <bookings@mireluxestudios.co.uk>';

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  return !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

async function sendRemindersForWindow(supabase: ReturnType<typeof createServiceRoleClient>, window: ReminderWindow) {
  const dueBookings = await getBookingsNeedingReminder(supabase, window);
  const resend = getResend();
  const results: Array<{ bookingId: string; sent: boolean }> = [];

  for (const row of dueBookings) {
    const [{ data: booking }, { data: service }] = await Promise.all([
      supabase.from('bookings').select('*').eq('id', row.id).single(),
      supabase.from('services').select('*').eq('id', row.service_id).single(),
    ]);
    if (!booking || !service) {
      results.push({ bookingId: row.id, sent: false });
      continue;
    }
    try {
      const email = reminderEmail(booking as DbBooking, service as DbService, window === '48h' ? 48 : 24);
      await resend.emails.send({
        from: FROM_ADDRESS,
        to: (booking as DbBooking).customer_email,
        replyTo: email.replyTo,
        subject: email.subject,
        html: email.html,
      });
      await markReminderSent(supabase, row.id, window);
      results.push({ bookingId: row.id, sent: true });
    } catch {
      results.push({ bookingId: row.id, sent: false });
    }
  }
  return results;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const requestedWindow = windowSchema.safeParse(request.nextUrl.searchParams.get('window'));
  const windows: ReminderWindow[] = requestedWindow.success ? [requestedWindow.data] : ['48h', '24h'];

  const supabase = createServiceRoleClient();
  const results: Array<{ window: ReminderWindow; sent: Array<{ bookingId: string; sent: boolean }> }> = [];
  for (const window of windows) {
    results.push({ window, sent: await sendRemindersForWindow(supabase, window) });
  }
  return NextResponse.json({ results });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = markBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const ok = await markReminderSent(supabase, parsed.data.bookingId, parsed.data.window);
  if (!ok) {
    return NextResponse.json({ error: 'mark_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
