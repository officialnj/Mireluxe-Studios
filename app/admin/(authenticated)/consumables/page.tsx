import { formatInTimeZone } from 'date-fns-tz';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { STUDIO_TIMEZONE } from '@/lib/booking/constants';

export const dynamic = 'force-dynamic';

type ConsumablesRow = {
  id: string;
  booking_ref: string;
  customer_name: string;
  appointment_start: string;
  status: string;
  services: { name: string; xpression_packs: string | null } | null;
  booking_bundles: Array<{ quantity: number; bundle_variants: { inches: number; colour: string } | null }>;
};

export default async function AdminConsumablesPage() {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('bookings')
    .select('id, booking_ref, customer_name, appointment_start, status, services(name, xpression_packs), booking_bundles(quantity, bundle_variants(inches, colour))')
    .in('status', ['pending_payment', 'confirmed'])
    .gte('appointment_start', new Date().toISOString())
    .order('appointment_start', { ascending: true });

  const bookings = (data ?? []) as unknown as ConsumablesRow[];

  return (
    <div>
      <h1 className="mb-2 font-serif text-2xl font-light">Consumables</h1>
      <p className="mb-6 text-sm text-cream/60">
        Upcoming bookings with the Xpression hair packs and bundles needed for each — for stock planning.
      </p>

      {bookings.length === 0 ? (
        <p className="text-sm text-cream/50">No upcoming bookings.</p>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <div key={b.id} className="rounded-xl border border-cream/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium">
                    {formatInTimeZone(new Date(b.appointment_start), STUDIO_TIMEZONE, 'd MMM yyyy, h:mmaaa')}
                  </span>
                  <span className="ml-2 text-cream/60">{b.customer_name}</span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    b.status === 'confirmed' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-gold/15 text-gold'
                  }`}
                >
                  {b.status}
                </span>
              </div>
              <div className="mt-2 text-sm text-cream/70">{b.services?.name ?? '—'}</div>
              <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-xs text-cream/50">
                {b.services?.xpression_packs && <span>Xpression: {b.services.xpression_packs} packs</span>}
                {b.booking_bundles.length > 0 && (
                  <span>
                    Bundles:{' '}
                    {b.booking_bundles
                      .filter((line) => line.bundle_variants)
                      .map((line) => `${line.quantity}× ${line.bundle_variants!.inches}" (${line.bundle_variants!.colour})`)
                      .join(', ')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
