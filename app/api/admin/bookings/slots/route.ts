import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminUser } from '@/lib/supabase/admin-auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getAdminDayAvailability } from '../_lib/adminAvailability';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
});

/**
 * Admin-only equivalent of GET /api/availability/slots, used by
 * CreateBookingModal's date/time picker. Bypasses the customer-facing
 * minimum-notice and release-window rules (see _lib/adminAvailability.ts)
 * but still reflects studio hours, blocked dates, slot overrides, and real
 * booking conflicts — the definitive double-booking guard is always the DB
 * exclusion constraint checked again on insert.
 */
export async function GET(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = querySchema.safeParse({
    serviceId: request.nextUrl.searchParams.get('serviceId'),
    date: request.nextUrl.searchParams.get('date'),
  });
  if (!parsed.success) return NextResponse.json({ error: 'invalid_query' }, { status: 400 });

  const supabase = createServiceRoleClient();
  const { slots, service } = await getAdminDayAvailability(supabase, parsed.data.serviceId, parsed.data.date);
  if (!service) return NextResponse.json({ error: 'service_not_found' }, { status: 404 });

  return NextResponse.json({ slots, service });
}
