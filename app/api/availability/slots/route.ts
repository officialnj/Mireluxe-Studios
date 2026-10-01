import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getDayAvailability, fetchBlockedDates, blockedRangesForDay } from '@/lib/booking/availability';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    serviceId: request.nextUrl.searchParams.get('serviceId'),
    date: request.nextUrl.searchParams.get('date'),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { slots, fullyBooked, service } = await getDayAvailability(supabase, parsed.data.serviceId, parsed.data.date);

  if (!service) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 });
  }

  if (request.nextUrl.searchParams.get('debug') === '1') {
    const { data: rawBlocked } = await supabase
      .from('blocked_dates')
      .select('*')
      .eq('blocked_date', parsed.data.date);
    const viaHelper = await fetchBlockedDates(supabase, parsed.data.date, parsed.data.date);
    const rangesResult = blockedRangesForDay(parsed.data.date, viaHelper);
    const rawHelperShape = await supabase
      .from('blocked_dates')
      .select('blocked_date, start_time, end_time')
      .gte('blocked_date', parsed.data.date)
      .lte('blocked_date', parsed.data.date);
    return NextResponse.json({
      slots,
      fullyBooked,
      debug: {
        serverNow: new Date().toISOString(),
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        vercelEnv: process.env.VERCEL_ENV ?? null,
        rawBlocked,
        viaHelper,
        rangesResult: { wholeDay: rangesResult.wholeDay, rangeCount: rangesResult.ranges.length },
        rawHelperShapeError: rawHelperShape.error,
        rawHelperShapeData: rawHelperShape.data,
        rawHelperShapeStatus: rawHelperShape.status,
        rawHelperShapeStatusText: rawHelperShape.statusText,
      },
    });
  }

  return NextResponse.json({ slots, fullyBooked });
}
