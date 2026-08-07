import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { addMinutes } from 'date-fns';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

const bodySchema = z.object({ newStart: z.string().datetime() });

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const supabase = createServiceRoleClient();
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, services(service_time_mins)')
    .eq('id', params.id)
    .single();
  if (!booking) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const durationMins = booking.services?.service_time_mins ?? 60;
  const newStart = new Date(parsed.data.newStart);
  const newEnd = addMinutes(newStart, durationMins);

  // The DB exclusion constraint checks this row's new range against every
  // other pending/confirmed booking automatically — no separate overlap
  // query needed, same guarantee that protects booking creation.
  const { error } = await supabase
    .from('bookings')
    .update({ appointment_start: newStart.toISOString(), appointment_end: newEnd.toISOString() })
    .eq('id', params.id);

  if (error) {
    if (error.code === '23P01') return NextResponse.json({ error: 'slot_taken' }, { status: 409 });
    return NextResponse.json({ error: 'reschedule_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
