import type { DbBundleVariant, DbService, DbServiceAddon } from './types';

export type BundleLine = {
  variant: DbBundleVariant;
  quantity: number;
};

export type AddOnLine = {
  addon: DbServiceAddon;
};

export type BookingTotals = {
  servicePricePence: number;
  bundlesPricePence: number;
  addOnsPricePence: number;
  depositDuePence: number;
  totalPricePence: number;
  balanceAtAppointmentPence: number;
  /** Appointment duration in minutes: the hair-included/without-hair base
   *  duration plus every selected add-on's duration delta (can be negative,
   *  e.g. "Short Bob" shortens the appointment). Never allowed below 15. */
  durationMins: number;
};

/** Flat deposit for a "without hair" booking, regardless of service. */
export const WITHOUT_HAIR_FLAT_DEPOSIT_PENCE = 2000;

/** An appointment can never be shortened below this by add-on deltas. */
const MIN_DURATION_MINS = 15;

/**
 * Presentational totals for the UI running total. The server independently
 * recomputes this from the DB when a booking is actually created — this
 * function is never the source of truth for what gets charged.
 *
 * Deposit rule (replaces the old flat `service.deposit_pence` column, now
 * unused): "without hair" bookings pay a flat £20 deposit regardless of
 * service; "with hair" bookings pay 50% of the total price — service plus
 * every add-on/bundle — rounded to the nearest penny.
 *
 * Duration: base duration is `service.hair_incl_service_time_mins` when
 * hair is included and set, falling back to `service.service_time_mins`
 * otherwise — same null-fallback convention `hair_incl_price_pence` already
 * uses against `base_price_pence`. Every selected add-on's duration delta
 * is added on top (can be negative).
 */
export function computeTotals(
  service: DbService,
  hairIncluded: boolean,
  bundleLines: BundleLine[],
  addOnLines: AddOnLine[] = []
): BookingTotals {
  const servicePricePence =
    hairIncluded && service.hair_incl_price_pence != null ? service.hair_incl_price_pence : service.base_price_pence;
  const bundlesPricePence = bundleLines.reduce((sum, line) => sum + line.variant.price_pence * line.quantity, 0);
  const addOnsPricePence = addOnLines.reduce((sum, line) => sum + line.addon.price_delta_pence, 0);
  const totalPricePence = servicePricePence + bundlesPricePence + addOnsPricePence;
  const depositDuePence = hairIncluded ? Math.round(totalPricePence * 0.5) : WITHOUT_HAIR_FLAT_DEPOSIT_PENCE;

  const baseDurationMins =
    (hairIncluded ? service.hair_incl_service_time_mins ?? service.service_time_mins : service.service_time_mins) ?? 0;
  const addOnDurationDeltaMins = addOnLines.reduce((sum, line) => sum + line.addon.duration_delta_mins, 0);
  const durationMins = Math.max(MIN_DURATION_MINS, baseDurationMins + addOnDurationDeltaMins);

  return {
    servicePricePence,
    bundlesPricePence,
    addOnsPricePence,
    depositDuePence,
    totalPricePence,
    balanceAtAppointmentPence: totalPricePence - depositDuePence,
    durationMins,
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
