'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { formatPence } from '@/lib/booking/pricing';
import type { DbShopOrder, ShopOrderFulfillmentStatus, ShopOrderPaymentStatus } from '@/lib/shop/types';

type StatusFilter = 'all' | ShopOrderPaymentStatus;

const PAYMENT_BADGE: Record<ShopOrderPaymentStatus, string> = {
  pending_payment: 'bg-gold/15 text-gold',
  paid: 'bg-emerald-500/15 text-emerald-300',
  cancelled: 'bg-red-500/15 text-red-300',
};

const FULFILLMENT_BADGE: Record<ShopOrderFulfillmentStatus, string> = {
  unfulfilled: 'bg-cream/10 text-cream/60',
  fulfilled: 'bg-blue-500/15 text-blue-300',
  shipped: 'bg-gold/15 text-gold',
  delivered: 'bg-emerald-500/15 text-emerald-300',
  cancelled: 'bg-red-500/15 text-red-300',
};

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${className}`}>{children}</span>;
}

export default function OrdersManager({ initialOrders }: { initialOrders: DbShopOrder[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [trackingDraft, setTrackingDraft] = useState<Record<string, { number: string; carrier: string }>>({});

  const filtered = useMemo(
    () => (filter === 'all' ? orders : orders.filter((o) => o.status === filter)),
    [orders, filter]
  );

  function patchLocal(id: string, patch: Partial<DbShopOrder>) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  function trackingFor(order: DbShopOrder) {
    return trackingDraft[order.id] ?? { number: order.tracking_number ?? '', carrier: order.tracking_carrier ?? '' };
  }

  async function updateOrder(id: string, body: Record<string, unknown>) {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to update order.');
      return null;
    }
    const { order } = await res.json();
    patchLocal(id, order);
    return order as DbShopOrder;
  }

  async function markFulfilled(order: DbShopOrder) {
    const draft = trackingFor(order);
    await updateOrder(order.id, {
      fulfillment_status: 'fulfilled',
      tracking_number: draft.number.trim() || null,
      tracking_carrier: draft.carrier.trim() || null,
    });
  }

  async function saveTracking(order: DbShopOrder) {
    const draft = trackingFor(order);
    await updateOrder(order.id, {
      tracking_number: draft.number.trim() || null,
      tracking_carrier: draft.carrier.trim() || null,
    });
  }

  async function advanceFulfillment(order: DbShopOrder, next: ShopOrderFulfillmentStatus) {
    await updateOrder(order.id, { fulfillment_status: next });
  }

  async function saveNotes(order: DbShopOrder) {
    const notes = notesDraft[order.id] ?? order.admin_notes ?? '';
    await updateOrder(order.id, { admin_notes: notes });
  }

  async function refund(order: DbShopOrder) {
    if (!confirm(`Refund ${formatPence(order.subtotal_pence)} to ${order.customer_name} and cancel this order?`)) return;
    setBusy(order.id);
    setError(null);
    const res = await fetch(`/api/admin/orders/${order.id}/refund`, { method: 'POST' });
    setBusy(null);
    if (!res.ok) {
      setError('Failed to issue refund.');
      return;
    }
    const { order: updated } = await res.json();
    patchLocal(order.id, updated);
  }

  if (orders.length === 0) {
    return <p className="text-sm text-cream/60">No orders yet.</p>;
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      <div className="flex gap-2">
        {(['all', 'paid', 'pending_payment', 'cancelled'] as StatusFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              filter === f ? 'bg-gold text-charcoal' : 'bg-cream/10 text-cream/70 hover:bg-cream/20'
            }`}
          >
            {f === 'all' ? 'All' : f === 'pending_payment' ? 'Pending' : f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((order) => {
          const isOpen = expanded === order.id;
          const isBusy = busy === order.id;
          const draft = trackingFor(order);
          const canFulfill = order.status === 'paid';
          return (
            <div key={order.id} className="rounded-xl border border-cream/10 bg-cream/[0.02]">
              <button
                onClick={() => setExpanded(isOpen ? null : order.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <div>
                  <div className="text-sm font-medium">{order.customer_name}</div>
                  <div className="text-xs text-cream/50">
                    {order.customer_email} · {format(new Date(order.created_at), 'd MMM yyyy, h:mmaaa')}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-cream/60">
                    {order.items.reduce((n, i) => n + i.quantity, 0)} item
                    {order.items.reduce((n, i) => n + i.quantity, 0) === 1 ? '' : 's'}
                  </span>
                  <span className="font-medium text-cream">{formatPence(order.subtotal_pence)}</span>
                  <Badge className={PAYMENT_BADGE[order.status]}>{order.status.replace('_', ' ')}</Badge>
                  <Badge className={FULFILLMENT_BADGE[order.fulfillment_status]}>{order.fulfillment_status}</Badge>
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-cream/5 px-4 py-5">
                  <div className="grid gap-6 md:grid-cols-2">
                          <div>
                            <h3 className="mb-2 text-xs uppercase tracking-wide text-cream/50">Items</h3>
                            <ul className="mb-4 space-y-1 text-sm">
                              {order.items.map((item, i) => (
                                <li key={i} className="flex justify-between gap-4">
                                  <span>
                                    {item.quantity}&times; {item.name}
                                  </span>
                                  <span className="text-cream/60">{formatPence(item.pricePence * item.quantity)}</span>
                                </li>
                              ))}
                            </ul>

                            <h3 className="mb-2 text-xs uppercase tracking-wide text-cream/50">Shipping address</h3>
                            <p className="text-sm text-cream/80">
                              {order.shipping_line1}
                              {order.shipping_line2 ? <>, {order.shipping_line2}</> : null}
                              <br />
                              {order.shipping_city}, {order.shipping_postcode}
                              <br />
                              {order.shipping_country}
                            </p>
                            {order.customer_phone && (
                              <p className="mt-2 text-sm text-cream/60">Phone: {order.customer_phone}</p>
                            )}

                            <h3 className="mb-2 mt-4 text-xs uppercase tracking-wide text-cream/50">Admin notes</h3>
                            <textarea
                              value={notesDraft[order.id] ?? order.admin_notes ?? ''}
                              onChange={(e) => setNotesDraft((prev) => ({ ...prev, [order.id]: e.target.value }))}
                              rows={3}
                              placeholder="Internal notes, never shown to the customer…"
                              className="w-full rounded border border-cream/20 bg-transparent px-3 py-2 text-sm"
                            />
                            <button
                              onClick={() => saveNotes(order)}
                              disabled={isBusy}
                              className="mt-2 inline-flex items-center rounded-full bg-gold/15 px-2.5 py-1 text-xs font-medium text-gold transition-colors hover:bg-gold/25 disabled:opacity-50"
                            >
                              Save notes
                            </button>
                          </div>

                          <div>
                            <h3 className="mb-2 text-xs uppercase tracking-wide text-cream/50">Fulfillment</h3>

                            {!canFulfill ? (
                              <p className="text-sm text-cream/50">
                                Order is {order.status.replace('_', ' ')} — no fulfillment actions available.
                              </p>
                            ) : (
                              <div className="space-y-3">
                                {(order.fulfillment_status === 'unfulfilled' || order.fulfillment_status === 'fulfilled') && (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <input
                                      value={draft.number}
                                      onChange={(e) =>
                                        setTrackingDraft((prev) => ({
                                          ...prev,
                                          [order.id]: { ...draft, number: e.target.value },
                                        }))
                                      }
                                      placeholder="Tracking number"
                                      className="w-40 rounded border border-cream/20 bg-transparent px-2 py-1.5 text-xs"
                                    />
                                    <input
                                      value={draft.carrier}
                                      onChange={(e) =>
                                        setTrackingDraft((prev) => ({
                                          ...prev,
                                          [order.id]: { ...draft, carrier: e.target.value },
                                        }))
                                      }
                                      placeholder="Carrier"
                                      className="w-32 rounded border border-cream/20 bg-transparent px-2 py-1.5 text-xs"
                                    />
                                    {order.fulfillment_status === 'fulfilled' && (
                                      <button
                                        onClick={() => saveTracking(order)}
                                        disabled={isBusy}
                                        className="inline-flex items-center rounded-full bg-gold/15 px-2.5 py-1 text-xs font-medium text-gold transition-colors hover:bg-gold/25 disabled:opacity-50"
                                      >
                                        Save tracking
                                      </button>
                                    )}
                                  </div>
                                )}

                                <div className="flex flex-wrap gap-2">
                                  {order.fulfillment_status === 'unfulfilled' && (
                                    <button
                                      onClick={() => markFulfilled(order)}
                                      disabled={isBusy}
                                      className="rounded-full bg-gold px-3 py-1 text-xs font-medium text-charcoal disabled:opacity-50"
                                    >
                                      Mark fulfilled
                                    </button>
                                  )}
                                  {order.fulfillment_status === 'fulfilled' && (
                                    <button
                                      onClick={() => advanceFulfillment(order, 'shipped')}
                                      disabled={isBusy}
                                      className="rounded-full bg-gold px-3 py-1 text-xs font-medium text-charcoal disabled:opacity-50"
                                    >
                                      Mark shipped
                                    </button>
                                  )}
                                  {order.fulfillment_status === 'shipped' && (
                                    <button
                                      onClick={() => advanceFulfillment(order, 'delivered')}
                                      disabled={isBusy}
                                      className="rounded-full bg-gold px-3 py-1 text-xs font-medium text-charcoal disabled:opacity-50"
                                    >
                                      Mark delivered
                                    </button>
                                  )}
                                </div>

                                {order.shipped_at && (
                                  <p className="text-xs text-cream/50">
                                    Shipped {format(new Date(order.shipped_at), 'd MMM yyyy, h:mmaaa')}
                                    {order.tracking_carrier ? ` via ${order.tracking_carrier}` : ''}
                                    {order.tracking_number ? ` (${order.tracking_number})` : ''}
                                  </p>
                                )}

                                <div className="border-t border-cream/10 pt-3">
                                  <button
                                    onClick={() => refund(order)}
                                    disabled={isBusy}
                                    className="inline-flex items-center rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/25 disabled:opacity-50"
                                  >
                                    Issue refund &amp; cancel order
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
          );
        })}
      </div>
    </div>
  );
}
