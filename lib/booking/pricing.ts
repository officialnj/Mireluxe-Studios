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

/** Flat deposit for a "without hair" booking, regardless of service. */
export const WITHOUT_HAIR_FLAT_DEPOSIT_PENCE = 2000;

/**
 * Presentational totals for the UI running total. The server independently
 * recomputes this from the DB when a booking is actually created — this
 * function is never the source of truth for what gets charged.
 *
 * Deposit rule (replaces the old flat `service.deposit_pence` column, now
 * unused): "without hair" bookings pay a flat £20 deposit regardless of
 * service; "with hair" bookings pay 50% of the total price — service plus
 * every add-on/bundle — rounded to the nearest penny.
 */
export function computeTotals(service: DbService, hairIncluded: boolean, bundleLines: BundleLine[]): BookingTotals {
  const servicePricePence =
    hairIncluded && service.hair_incl_price_pence != null ? service.hair_incl_price_pence : service.base_price_pence;
  const bundlesPricePence = bundleLines.reduce((sum, line) => sum + line.variant.price_pence * line.quantity, 0);
  const totalPricePence = servicePricePence + bundlesPricePence;
  const depositDuePence = hairIncluded ? Math.round(totalPricePence * 0.5) : WITHOUT_HAIR_FLAT_DEPOSIT_PENCE;

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

/** Effective purchasability everywhere bundle_variants is used (the retail
 *  shop and booking add-ons) — `in_stock` is a manual admin override,
 *  `stock_quantity` is real inventory. Both must hold. */
export function isPurchasable(variant: DbBundleVariant): boolean {
  return variant.in_stock === true && variant.stock_quantity > 0;
}
