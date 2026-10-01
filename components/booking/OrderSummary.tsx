import { formatPence, type BookingTotals } from '@/lib/booking/pricing';

export type OrderSummaryBundleLine = {
  variantId: string;
  bundleName?: string | null;
  inches: number;
  colour: string;
  quantity: number;
  pricePence: number;
};

export type OrderSummaryAddOnLine = {
  id: string;
  name: string;
  priceDeltaPence: number;
};

type Props = {
  serviceName: string;
  hairIncluded: boolean;
  bundleLines: OrderSummaryBundleLine[];
  addOnLines?: OrderSummaryAddOnLine[];
  totals: BookingTotals;
};

export default function OrderSummary({ serviceName, hairIncluded, bundleLines, addOnLines = [], totals }: Props) {
  return (
    <div className="space-y-2 rounded-xl bg-gold/10 px-4 py-4 text-sm">
      <div className="flex items-center justify-between text-charcoal/70 dark:text-cream/70">
        <span>
          {serviceName}
          {hairIncluded ? ' (hair included)' : ''}
        </span>
        <span>{formatPence(totals.servicePricePence)}</span>
      </div>
      {bundleLines.map((line) => (
        <div key={line.variantId} className="flex items-center justify-between text-charcoal/70 dark:text-cream/70">
          <span>
            {line.quantity}× {line.bundleName ? `${line.bundleName} — ` : ''}
            {line.inches}&quot; bundle ({line.colour})
          </span>
          <span>{formatPence(line.pricePence * line.quantity)}</span>
        </div>
      ))}
      {addOnLines.map((line) => (
        <div key={line.id} className="flex items-center justify-between text-charcoal/70 dark:text-cream/70">
          <span>{line.name}</span>
          <span>
            {line.priceDeltaPence < 0 ? '−' : ''}
            {formatPence(Math.abs(line.priceDeltaPence))}
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-charcoal/10 pt-2 font-medium dark:border-cream/10">
        <span>Total</span>
        <span>{formatPence(totals.totalPricePence)}</span>
      </div>
      <div className="flex items-center justify-between text-gold">
        <span>Deposit due now</span>
        <span className="font-medium">{formatPence(totals.depositDuePence)}</span>
      </div>
      <div className="flex items-center justify-between text-xs text-charcoal/50 dark:text-cream/50">
        <span>Balance at appointment</span>
        <span>{formatPence(totals.balanceAtAppointmentPence)}</span>
      </div>
    </div>
  );
}
