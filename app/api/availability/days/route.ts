import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getMonthAvailability } from '@/lib/booking/availability';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  serviceId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM'),
  hairIncluded: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  // Net minutes from every selected add-on's duration delta (can be
  // negative) — the client sums these; the server independently re-derives
  // and trusts nothing at booking-creation time, same as price.
  extraDurationMins: z.coerce.number().int().optional().default(0),
  premiumSlotsUnlocked: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    serviceId: request.nextUrl.searchParams.get('serviceId'),
    month: request.nextUrl.searchParams.get('month'),
    hairIncluded: request.nextUrl.searchParams.get('hairIncluded') ?? undefined,
    extraDurationMins: request.nextUrl.searchParams.get('extraDurationMins') ?? undefined,
    premiumSlotsUnlocked: request.nextUrl.searchParams.get('premiumSlotsUnlocked') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const days = await getMonthAvailability(
    supabase,
    parsed.data.serviceId,
    parsed.data.month,
    parsed.data.hairIncluded,
    parsed.data.extraDurationMins,
    parsed.data.premiumSlotsUnlocked
  );

  return NextResponse.json({ days });
}
