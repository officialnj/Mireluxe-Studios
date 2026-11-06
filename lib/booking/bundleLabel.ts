/** Shared shape + formatting for a booking's hair bundles, as selected via
 *  `booking_bundles(quantity, price_pence_at_booking, bundle_variants(inches, colour, bundles(name)))`.
 *  The bundle product name (bundles.name) is the curl pattern / texture,
 *  e.g. "Deep Wave", "Italian Curls". */

export type BookingBundleRow = {
  quantity: number;
  price_pence_at_booking: number;
  bundle_variants: {
    inches: number;
    colour: string;
    // PostgREST returns a to-one embed as an object, but older typings /
    // some query shapes can surface it as a single-element array.
    bundles: { name: string } | { name: string }[] | null;
  } | null;
};

export function bundleCurlPattern(row: BookingBundleRow): string {
  const b = row.bundle_variants?.bundles;
  const name = Array.isArray(b) ? b[0]?.name : b?.name;
  return name ?? 'Bundle';
}

/** True when the bundle was included in a hair-included service price (no
 *  extra charge) rather than bought as a paid extra. */
export function isIncludedBundle(row: BookingBundleRow): boolean {
  return row.price_pence_at_booking === 0;
}

/** e.g. `2× Deep Wave · 18" · 1B` */
export function formatBookingBundle(row: BookingBundleRow): string {
  const v = row.bundle_variants;
  if (!v) return `${row.quantity}× bundle (details unavailable)`;
  return `${row.quantity}× ${bundleCurlPattern(row)} · ${v.inches}" · ${v.colour}`;
}
