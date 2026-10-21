'use client';

import { useMemo, useState } from 'react';
import { formatPence } from '@/lib/booking/pricing';

export type CheckoutItem = {
  id: string;
  booking_ref: string;
  customer_name: string;
  service_name: string;
  appointment_start: string;
  total_price_pence: number;
  deposit_paid_pence: number;
  balance_pence: number;
  balance_collected_at: string | null;
  balance_payment_method: string | null;
  addons: { name: string; price_pence: number }[];
  bundles: { label: string; quantity: number; price_pence: number }[];
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CheckoutCenter({ initialItems }: { initialItems: CheckoutItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const outstanding = useMemo(() => items.filter((i) => !i.balance_collected_at), [items]);
  const settled = useMemo(() => items.filter((i) => i.balance_collected_at), [items]);
  const totalOwed = outstanding.reduce((sum, i) => sum + i.balance_pence, 0);

  async function collect(id: string, method: 'cash' | 'card' | 'clear') {
    setBusy(`${id}-${method}`);
    setError(null);
    const res = await fetch(`/api/admin/checkout/${id}/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method }),
    });
    setBusy(null);
    if (!res.ok) {
      setError('Could not update — try again.');
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              balance_collected_at: method === 'clear' ? null : new Date().toISOString(),
              balance_payment_method: method === 'clear' ? null : method,
            }
          : i
      )
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>}

      {/* Owed summary */}
      <div className="rounded-2xl border border-charcoal/10 bg-white p-5">
        <p className="text-[0.68rem] uppercase tracking-luxe text-charcoal/45">Balance to collect</p>
        <p className="mt-1 font-serif text-4xl font-light text-charcoal">{formatPence(totalOwed)}</p>
        <p className="mt-1 text-xs text-charcoal/50">
          across {outstanding.length} upcoming appointment{outstanding.length === 1 ? '' : 's'}
        </p>
      </div>

      <Section title="Coming up">
        {outstanding.length === 0 ? (
          <Empty>No balances outstanding. 🎉</Empty>
        ) : (
          outstanding.map((item) => (
            <Row
              key={item.id}
              item={item}
              open={openId === item.id}
              onToggle={() => setOpenId((o) => (o === item.id ? null : item.id))}
              busy={busy}
              onCollect={collect}
            />
          ))
        )}
      </Section>

      {settled.length > 0 && (
        <Section title="Settled">
          {settled.map((item) => (
            <Row
              key={item.id}
              item={item}
              open={openId === item.id}
              onToggle={() => setOpenId((o) => (o === item.id ? null : item.id))}
              busy={busy}
              onCollect={collect}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-[0.68rem] font-semibold uppercase tracking-luxe text-charcoal/45">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-charcoal/15 p-6 text-center text-sm text-charcoal/50">{children}</p>;
}

function Row({
  item,
  open,
  onToggle,
  busy,
  onCollect,
}: {
  item: CheckoutItem;
  open: boolean;
  onToggle: () => void;
  busy: string | null;
  onCollect: (id: string, method: 'cash' | 'card' | 'clear') => void;
}) {
  const settled = Boolean(item.balance_collected_at);
  return (
    <div className="overflow-hidden rounded-2xl border border-charcoal/10 bg-white">
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-4 p-4 text-left">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-charcoal">{item.customer_name}</span>
          <span className="mt-0.5 block truncate text-xs text-charcoal/55">
            {item.service_name} · {formatWhen(item.appointment_start)}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className={`block font-serif text-lg font-light ${settled ? 'text-emerald-700' : 'text-charcoal'}`}>
            {settled ? 'Paid' : formatPence(item.balance_pence)}
          </span>
          <span className="block text-[0.62rem] uppercase tracking-luxe text-charcoal/40">
            {settled ? item.balance_payment_method ?? 'collected' : 'balance'}
          </span>
        </span>
      </button>

      {open && (
        <div className="border-t border-charcoal/10 px-4 py-4">
          <dl className="space-y-1.5 text-sm">
            <Line label={item.service_name} value={formatPence(item.total_price_pence - item.addons.reduce((s, a) => s + a.price_pence, 0) - item.bundles.reduce((s, b) => s + b.price_pence * b.quantity, 0))} />
            {item.addons.map((a, i) => (
              <Line key={`a${i}`} label={`+ ${a.name}`} value={formatPence(a.price_pence)} muted />
            ))}
            {item.bundles.map((b, i) => (
              <Line key={`b${i}`} label={`+ ${b.label}${b.quantity > 1 ? ` ×${b.quantity}` : ''}`} value={formatPence(b.price_pence * b.quantity)} muted />
            ))}
            <div className="my-2 border-t border-charcoal/10" />
            <Line label="Total" value={formatPence(item.total_price_pence)} />
            <Line label="Deposit paid" value={`− ${formatPence(item.deposit_paid_pence)}`} muted />
            <Line label="Balance" value={formatPence(item.balance_pence)} strong />
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            {!settled ? (
              <>
                <ActionButton onClick={() => onCollect(item.id, 'cash')} disabled={busy === `${item.id}-cash`}>
                  {busy === `${item.id}-cash` ? '…' : 'Mark paid — cash'}
                </ActionButton>
                <ActionButton onClick={() => onCollect(item.id, 'card')} disabled={busy === `${item.id}-card`}>
                  {busy === `${item.id}-card` ? '…' : 'Mark paid — card'}
                </ActionButton>
              </>
            ) : (
              <button
                onClick={() => onCollect(item.id, 'clear')}
                disabled={busy === `${item.id}-clear`}
                className="rounded-full bg-charcoal/10 px-3.5 py-1.5 text-xs font-medium text-charcoal/70 hover:bg-charcoal/20 disabled:opacity-50"
              >
                {busy === `${item.id}-clear` ? '…' : 'Undo'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Line({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={`${muted ? 'text-charcoal/50' : 'text-charcoal/75'} ${strong ? 'font-medium text-charcoal' : ''}`}>{label}</dt>
      <dd className={`shrink-0 tabular-nums ${strong ? 'font-medium text-gold' : muted ? 'text-charcoal/50' : 'text-charcoal/75'}`}>{value}</dd>
    </div>
  );
}

function ActionButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-full bg-gold px-3.5 py-1.5 text-xs font-medium text-charcoal transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
