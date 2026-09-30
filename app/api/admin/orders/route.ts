import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Optional payment-status filter, e.g. ?status=paid — used by the admin
  // orders table's filter tabs. Omit to return every order.
  const status = request.nextUrl.searchParams.get('status');

  const supabase = createServiceRoleClient();
  let query = supabase.from('shop_orders').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 });

  return NextResponse.json({ orders: data ?? [] });
}
