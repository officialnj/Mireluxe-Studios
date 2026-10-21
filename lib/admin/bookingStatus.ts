/** Single source of truth for how a booking status is labelled and coloured
 *  across the admin (calendar blocks, legend, status badges, details panel).
 *  Accessible, restrained tones on a light surface — matches the mockup's
 *  sage / champagne / lilac / rose palette. */

export type BookingStatusKey =
  | 'confirmed'
  | 'pending_payment'
  | 'completed'
  | 'no_show'
  | 'cancelled'
  | 'expired';

type StatusStyle = {
  label: string;
  /** Solid dot / legend swatch. */
  dot: string;
  /** Small text badge (bg + text). */
  badge: string;
  /** Calendar appointment block (bg + left border + text). */
  block: string;
};

export const BOOKING_STATUS: Record<BookingStatusKey, StatusStyle> = {
  confirmed: {
    label: 'Confirmed',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-500/15 text-emerald-700',
    block: 'bg-emerald-50 border-emerald-400 text-emerald-900',
  },
  pending_payment: {
    label: 'Pending',
    dot: 'bg-amber-500',
    badge: 'bg-amber-500/15 text-amber-700',
    block: 'bg-amber-50 border-amber-400 text-amber-900',
  },
  completed: {
    label: 'Completed',
    dot: 'bg-sky-500',
    badge: 'bg-sky-500/15 text-sky-700',
    block: 'bg-sky-50 border-sky-400 text-sky-900',
  },
  no_show: {
    label: 'No-show',
    dot: 'bg-rose-500',
    badge: 'bg-rose-500/15 text-rose-700',
    block: 'bg-rose-50 border-rose-400 text-rose-900',
  },
  cancelled: {
    label: 'Cancelled',
    dot: 'bg-charcoal/40',
    badge: 'bg-charcoal/10 text-charcoal/50',
    block: 'bg-charcoal/[0.04] border-charcoal/30 text-charcoal/50 line-through',
  },
  expired: {
    label: 'Expired',
    dot: 'bg-charcoal/40',
    badge: 'bg-charcoal/10 text-charcoal/50',
    block: 'bg-charcoal/[0.04] border-charcoal/30 text-charcoal/50',
  },
};

export function statusStyle(status: string): StatusStyle {
  return BOOKING_STATUS[status as BookingStatusKey] ?? BOOKING_STATUS.confirmed;
}

/** Statuses shown in the calendar legend, in display order. */
export const LEGEND_STATUSES: BookingStatusKey[] = ['confirmed', 'pending_payment', 'completed', 'no_show', 'cancelled'];
