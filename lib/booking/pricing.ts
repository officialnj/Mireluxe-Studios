import type { DbBundleVariant, DbService } from './types';

export type BundleLine = {
  variant: DbBundleVariant;
  quantity: number;
};

export type BookingTotals = {
  servicePricePence: number;
  bundlesPricePence: number;
  depositDuePence: number;
  totalPricePence: number;
  balanceAtAppointmentPence: number;
};

/**
 * Presentational totals for the UI running total. The server independently
 * recomputes this from the DB when a booking is actually created — this
 * function is never the source of truth for what gets charged.
 */
export function computeTotals(service: DbService, hairIncluded: boolean, bundleLines: BundleLine[]): BookingTotals {
  const servicePricePence =
    hairIncluded && service.hair_incl_price_pence != null ? service.hair_incl_price_pence : service.base_price_pence;
  const bundlesPricePence = bundleLines.reduce((sum, line) => sum + line.variant.price_pence * line.quantity, 0);
  const depositDuePence = service.deposit_pence;
  const totalPricePence = servicePricePence + bundlesPricePence;

  return {
    servicePricePence,
    bundlesPricePence,
    depositDuePence,
    totalPricePence,
    balanceAtAppointmentPence: totalPricePence - depositDuePence,
  };
}

export function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2).replace(/\.00$/, '')}`;
}
