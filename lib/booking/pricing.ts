import type { DbBundle, DbService } from './types';

export type BookingTotals = {
  servicePricePence: number;
  bundlePricePence: number;
  depositDuePence: number;
  totalPricePence: number;
  balanceAtAppointmentPence: number;
};

/**
 * Presentational totals for the UI running total. The server independently
 * recomputes this from the DB when a booking is actually created — this
 * function is never the source of truth for what gets charged.
 */
export function computeTotals(service: DbService, bundle: DbBundle | null): BookingTotals {
  const servicePricePence = service.price_from_pence;
  const bundlePricePence = bundle ? bundle.price_pence : 0;
  const depositDuePence = service.deposit_pence;
  const totalPricePence = servicePricePence + bundlePricePence;

  return {
    servicePricePence,
    bundlePricePence,
    depositDuePence,
    totalPricePence,
    balanceAtAppointmentPence: totalPricePence - depositDuePence,
  };
}

export function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2).replace(/\.00$/, '')}`;
}
