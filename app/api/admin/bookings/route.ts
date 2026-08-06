import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const date = request.nextUrl.searchParams.get('date'); // optional YYYY-MM-DD filter
  const supabase = createServiceRoleClient();
  let query = supabase
    .from('bookings')
    .select('*, services(name, duration_mins)')
    .in('status', ['pending_payment', 'confirmed'])
    .order('appointment_start', { ascending: true });

  if (date) {
    query = query.gte('appointment_start', `${date}T00:00:00Z`).lt('appointment_start', `${date}T23:59:59Z`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 });

  return NextResponse.json({ bookings: data ?? [] });
}
