import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ id: z.string().uuid() });

// The booking id itself acts as an unguessable capability token here — this
// route intentionally returns nothing beyond status/reference/appointment
// time, never customer PII, so it's safe to poll without authentication.
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('bookings')
    .select('status, booking_ref, appointment_start')
    .eq('id', parsed.data.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    status: data.status,
    bookingRef: data.booking_ref,
    appointmentStart: data.appointment_start,
  });
}
