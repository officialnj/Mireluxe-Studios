import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getMonthAvailability } from '@/lib/booking/availability';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  serviceId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM'),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    serviceId: request.nextUrl.searchParams.get('serviceId'),
    month: request.nextUrl.searchParams.get('month'),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const days = await getMonthAvailability(supabase, parsed.data.serviceId, parsed.data.month);

  return NextResponse.json({ days });
}
