import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fromZonedTime } from 'date-fns-tz';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { STUDIO_TIMEZONE } from '@/lib/booking/constants';
import { revalidatePublicPages } from '@/lib/revalidate';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Accept "HH:mm" or "HH:mm:ss" and normalize to "HH:mm:ss" for storage.
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  action: z.enum(['open', 'blocked']),
});

function normalizeTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}

/**
 * GET  — list slot_overrides in a date range, for the admin availability
 * calendar. `from`/`through` are optional YYYY-MM-DD bounds (inclusive);
 * omitted entirely returns everything (small table, fine for admin use).
 */
export async function GET(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const from = request.nextUrl.searchParams.get('from');
  const through = request.nextUrl.searchParams.get('through');

  const supabase = createServiceRoleClient();
  let query = supabase.from('slot_overrides').select('*').order('date', { ascending: true }).order('start_time', { ascending: true });
  if (from) query = query.gte('date', from);
  if (through) query = query.lte('date', through);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 });

  return NextResponse.json({ overrides: data ?? [] });
}

/**
 * POST — create a slot override.
 *  - action='open': add an extra bookable start time on a date, any time of
 *    day, including outside the default 08:00-16:00 grid.
 *  - action='blocked': remove one specific DEFAULT start time on a date.
 *    Rejected with 409 if a live (confirmed/pending) booking already starts
 *    at that exact date+time — Mirakle can only block an unbooked slot, per
 *    spec. (`open` overrides are not subject to this check: the availability
 *    engine already treats them as ordinary bookable slots, so a real
 *    booking conflict there just means "already taken," not "invalid.")
 * Upserts on the table's (date, start_time) unique constraint, so re-adding
 * with a different action flips it (e.g. blocked -> open) instead of erroring.
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const { date, action } = parsed.data;
  const startTime = normalizeTime(parsed.data.startTime);
  const supabase = createServiceRoleClient();

  if (action === 'blocked') {
    const slotStartUtc = fromZonedTime(`${date}T${startTime}`, STUDIO_TIMEZONE);
    const nowIso = new Date().toISOString();
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, appointment_start')
      .eq('appointment_start', slotStartUtc.toISOString())
      .or(`status.eq.confirmed,and(status.eq.pending_payment,expires_at.gt.${nowIso})`);

    if (bookings && bookings.length > 0) {
      return NextResponse.json({ error: 'slot_booked' }, { status: 409 });
    }
  }

  const { error } = await supabase
    .from('slot_overrides')
    .upsert({ date, start_time: startTime, action }, { onConflict: 'date,start_time' });

  if (error) return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
  revalidatePublicPages();
  return NextResponse.json({ ok: true });
}
