import { formatPence, type BookingTotals } from '@/lib/booking/pricing';

type Props = {
  serviceName: string;
  bundleSelected: boolean;
  totals: BookingTotals;
};

export default function OrderSummary({ serviceName, bundleSelected, totals }: Props) {
  return (
    <div className="space-y-2 rounded-xl bg-gold/10 px-4 py-4 text-sm">
      <div className="flex items-center justify-between text-charcoal/70 dark:text-cream/70">
        <span>{serviceName}</span>
        <span>{formatPence(totals.servicePricePence)}</span>
      </div>
      {bundleSelected && (
        <div className="flex items-center justify-between text-charcoal/70 dark:text-cream/70">
          <span>Hair bundle</span>
          <span>{formatPence(totals.bundlePricePence)}</span>
        </div>
      )}
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
