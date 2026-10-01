import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendConfirmationEmails } from '@/lib/email/sendBookingConfirmation';
import type { DbBooking } from '@/lib/booking/types';

// Manual trigger for the same confirmation email the Stripe webhook sends
// automatically — for cases like a customer reporting they never received
// theirs (e.g. the from-domain was misconfigured, or a transient Resend
// failure). Only valid for a booking that is actually confirmed; this never
// changes booking status or payment state, it only re-sends the email.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createServiceRoleClient();
  const { data: booking, error } = await supabase.from('bookings').select('*').eq('id', params.id).single();
  if (error || !booking) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (booking.status !== 'confirmed') {
    return NextResponse.json({ error: 'not_confirmed' }, { status: 400 });
  }

  await sendConfirmationEmails(supabase, booking as DbBooking);
  return NextResponse.json({ ok: true });
}
