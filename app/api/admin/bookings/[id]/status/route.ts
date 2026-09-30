import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidatePublicPages } from '@/lib/revalidate';

const bodySchema = z.object({ status: z.enum(['completed', 'no_show']) });

/**
 * The only status transitions this route allows are confirmed -> completed
 * and confirmed -> no_show, both admin-only, both post-appointment. Never
 * accepts an arbitrary status string from the client — the zod enum plus the
 * .eq('status', 'confirmed') guard on the update are what enforce that.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const supabase = createServiceRoleClient();
  const { data: booking, error } = await supabase.from('bookings').select('*').eq('id', params.id).single();
  if (error || !booking) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (booking.status !== 'confirmed') {
    return NextResponse.json({ error: 'invalid_transition' }, { status: 400 });
  }
  if (new Date(booking.appointment_start) > new Date()) {
    return NextResponse.json({ error: 'appointment_not_started' }, { status: 400 });
  }

  const { error: updateError, count } = await supabase
    .from('bookings')
    .update({ status: parsed.data.status }, { count: 'exact' })
    .eq('id', params.id)
    .eq('status', 'confirmed');

  if (updateError) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  if (count === 0) return NextResponse.json({ error: 'invalid_transition' }, { status: 409 });

  revalidatePublicPages();
  return NextResponse.json({ ok: true });
}
