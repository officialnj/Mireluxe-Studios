import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getDayAvailability } from '@/lib/booking/availability';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  hairIncluded: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  extraDurationMins: z.coerce.number().int().optional().default(0),
  premiumSlotsUnlocked: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    serviceId: request.nextUrl.searchParams.get('serviceId'),
    date: request.nextUrl.searchParams.get('date'),
    hairIncluded: request.nextUrl.searchParams.get('hairIncluded') ?? undefined,
    extraDurationMins: request.nextUrl.searchParams.get('extraDurationMins') ?? undefined,
    premiumSlotsUnlocked: request.nextUrl.searchParams.get('premiumSlotsUnlocked') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { slots, fullyBooked, service } = await getDayAvailability(
    supabase,
    parsed.data.serviceId,
    parsed.data.date,
    parsed.data.hairIncluded,
    parsed.data.extraDurationMins,
    parsed.data.premiumSlotsUnlocked
  );

  if (!service) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 });
  }

  return NextResponse.json({ slots, fullyBooked });
}
