import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getResend, logEmailResult } from '@/lib/resend';
import { preorderNotificationEmail } from '@/lib/email/templates';
import { ADMIN_NOTIFICATION_EMAILS } from '@/lib/site';

export const dynamic = 'force-dynamic';

const FROM_ADDRESS = 'MIRILUXE Studios <bookings@miriluxe.co.uk>';

const bodySchema = z.object({
  bundle_id: z.string().uuid().nullable().optional(),
  bundle_variant_id: z.string().uuid(),
  inches: z.number().int().positive().nullable().optional(),
  colour: z.string().trim().min(1).nullable().optional(),
  email: z.string().trim().email(),
});

/**
 * Public "notify me when back in stock" signup for an out-of-stock bundle
 * variant. Collects an email only — no payment. Persists the lead and emails
 * the studio. The variant details are re-read server-side (trust-nothing) so
 * the stored record and the notification can't be spoofed from the client.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const supabase = createServiceRoleClient();

  // Re-resolve the variant + bundle name from the DB rather than trusting the
  // client-supplied inches/colour/bundle_id.
  const { data: variant } = await supabase
    .from('bundle_variants')
    .select('id, bundle_id, inches, colour, bundles(name)')
    .eq('id', parsed.data.bundle_variant_id)
    .single();

  if (!variant) return NextResponse.json({ error: 'variant_not_found' }, { status: 404 });

  const bundleName = (variant as unknown as { bundles: { name: string } | null }).bundles?.name ?? 'Braiding Hair';

  const { error } = await supabase.from('preorder_notifications').insert({
    bundle_id: variant.bundle_id,
    bundle_variant_id: variant.id,
    inches: variant.inches,
    colour: variant.colour,
    email: parsed.data.email,
  });
  if (error) return NextResponse.json({ error: 'insert_failed' }, { status: 500 });

  // Best-effort studio notification — never fail the request on a send error.
  try {
    const email = preorderNotificationEmail({
      bundleName,
      inches: variant.inches,
      colour: variant.colour,
      email: parsed.data.email,
    });
    const result = await getResend().emails.send({
      from: FROM_ADDRESS,
      to: ADMIN_NOTIFICATION_EMAILS,
      replyTo: email.replyTo,
      subject: email.subject,
      html: email.html,
    });
    logEmailResult(`preorder interest for ${bundleName} (${variant.inches}" ${variant.colour})`, result);
  } catch (err) {
    console.error('[preorder] owner notification failed', err);
  }

  return NextResponse.json({ ok: true });
}
