import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

// Housekeeping only — NOT what guarantees correctness. Availability queries
// and the booking-creation route already lazily treat any pending_payment
// row past its expires_at as non-blocking, so a stale hold never makes a
// slot look unavailable even if this route hasn't run recently. This just
// keeps the admin dashboard and DB tidy on a schedule.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('status', 'pending_payment')
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) {
    return NextResponse.json({ error: 'cleanup_failed' }, { status: 500 });
  }

  return NextResponse.json({ expired: data?.length ?? 0 });
}
