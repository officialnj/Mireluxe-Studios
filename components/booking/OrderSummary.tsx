import { formatPence, type BookingTotals } from '@/lib/booking/pricing';

export type OrderSummaryBundleLine = {
  inches: number;
  colour: string;
  quantity: number;
  pricePence: number;
};

type Props = {
  serviceName: string;
  hairIncluded: boolean;
  bundleLines: OrderSummaryBundleLine[];
  totals: BookingTotals;
};

export default function OrderSummary({ serviceName, hairIncluded, bundleLines, totals }: Props) {
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
        <div key={`${line.inches}-${line.colour}`} className="flex items-center justify-between text-charcoal/70 dark:text-cream/70">
          <span>
            {line.quantity}× {line.inches}&quot; bundle ({line.colour})
          </span>
          <span>{formatPence(line.pricePence * line.quantity)}</span>
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
