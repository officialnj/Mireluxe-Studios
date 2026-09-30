'use client';

import { Fragment, useMemo, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { STUDIO_TIMEZONE } from '@/lib/booking/constants';
import { formatPence } from '@/lib/booking/pricing';
import type { BookingStatus } from '@/lib/booking/types';
import type { ShopOrderItem, ShopOrderPaymentStatus } from '@/lib/shop/types';

export type CustomerRecord = {
  /** lower(customer_email) — the stable identity key for a customer. */
  email: string;
  /** Contact info from the most recent booking/order. */
  name: string;
  phone: string | null;
  /** All distinct names/phones ever seen for this email, oldest first. */
  nameVariants: string[];
  phoneVariants: string[];
  bookingsCount: number;
  ordersCount: number;
  /** Money actually collected — confirmed/completed booking deposits + paid shop orders. */
  lifetimeSpendPence: number;
  lastActivityAt: string;
};

export type CustomerBookingRow = {
  id: string;
  email: string;
  serviceName: string;
  appointmentStart: string;
  status: BookingStatus;
  amountPence: number;
};

export type CustomerOrderRow = {
  id: string;
  email: string;
  items: ShopOrderItem[];
  createdAt: string;
  status: ShopOrderPaymentStatus;
  subtotalPence: number;
};

type SortKey = 'activity' | 'name' | 'spend' | 'visits';

const BOOKING_STATUS_STYLE: Record<BookingStatus, string> = {
  confirmed: 'bg-emerald-500/15 text-emerald-300',
  completed: 'bg-emerald-500/15 text-emerald-300',
  pending_payment: 'bg-gold/15 text-gold',
  cancelled: 'bg-red-500/15 text-red-300',
  expired: 'bg-cream/10 text-cream/50',
  no_show: 'bg-red-500/15 text-red-300',
};

const ORDER_STATUS_STYLE: Record<ShopOrderPaymentStatus, string> = {
  paid: 'bg-emerald-500/15 text-emerald-300',
  pending_payment: 'bg-gold/15 text-gold',
  cancelled: 'bg-red-500/15 text-red-300',
};

function formatDate(iso: string) {
  return formatInTimeZone(new Date(iso), STUDIO_TIMEZONE, 'd MMM yyyy, h:mmaaa');
}

export default function CustomerDirectory({
  customers,
  bookings,
  orders,
}: {
  customers: CustomerRecord[];
  bookings: CustomerBookingRow[];
  orders: CustomerOrderRow[];
}) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('activity');
  const [expanded, setExpanded] = useState<string | null>(null);

  const bookingsByEmail = useMemo(() => {
    const map = new Map<string, CustomerBookingRow[]>();
    for (const b of bookings) {
      const list = map.get(b.email) ?? [];
      list.push(b);
      map.set(b.email, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(b.appointmentStart).getTime() - new Date(a.appointmentStart).getTime());
    }
    return map;
  }, [bookings]);

  const ordersByEmail = useMemo(() => {
    const map = new Map<string, CustomerOrderRow[]>();
    for (const o of orders) {
      const list = map.get(o.email) ?? [];
      list.push(o);
      map.set(o.email, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return map;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = customers;
    if (q) {
      list = customers.filter((c) => {
        const haystack = [c.email, ...c.nameVariants, ...c.phoneVariants].join(' ').toLowerCase();
        return haystack.includes(q);
      });
    }
    const sorted = [...list];
    switch (sortKey) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'spend':
        sorted.sort((a, b) => b.lifetimeSpendPence - a.lifetimeSpendPence);
        break;
      case 'visits':
        sorted.sort((a, b) => b.bookingsCount + b.ordersCount - (a.bookingsCount + a.ordersCount));
        break;
      case 'activity':
      default:
        sorted.sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
        break;
    }
    return sorted;
  }, [customers, query, sortKey]);

  if (customers.length === 0) {
    return <p className="text-sm text-cream/60">No customers yet.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, or phone…"
          className="w-72 max-w-full rounded border border-cream/20 bg-transparent px-3 py-2 text-sm placeholder:text-cream/40 focus:border-gold focus:outline-none"
        />
        <div className="flex items-center gap-2 text-xs text-cream/50">
          <span>Sort:</span>
          {(
            [
              ['activity', 'Recent activity'],
              ['name', 'Name'],
              ['spend', 'Lifetime spend'],
              ['visits', 'Total visits'],
            ] as [SortKey, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className={`rounded-full px-2 py-1 ${sortKey === key ? 'bg-gold/15 text-gold' : 'hover:text-cream'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-cream/40">
          {filtered.length} customer{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-cream/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-cream/10 text-xs uppercase tracking-wide text-cream/50">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Bookings</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Lifetime spend</th>
              <th className="px-4 py-3">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((customer) => {
              const isOpen = expanded === customer.email;
              const customerBookings = bookingsByEmail.get(customer.email) ?? [];
              const customerOrders = ordersByEmail.get(customer.email) ?? [];
              return (
                <Fragment key={customer.email}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : customer.email)}
                    className="cursor-pointer border-b border-cream/5 last:border-0 hover:bg-cream/5"
                  >
                    <td className="px-4 py-3">
                      <div>{customer.name}</div>
                      <div className="text-xs text-cream/50">
                        {customer.email}
                        {customer.phone ? ` · ${customer.phone}` : ''}
                      </div>
                      {customer.nameVariants.length > 1 && (
                        <div className="mt-0.5 text-xs text-cream/30">
                          Also seen as: {customer.nameVariants.filter((n) => n !== customer.name).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">{customer.bookingsCount}</td>
                    <td className="px-4 py-3">{customer.ordersCount}</td>
                    <td className="px-4 py-3">{formatPence(customer.lifetimeSpendPence)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(customer.lastActivityAt)}</td>
                  </tr>
                  {isOpen && (
                    <tr key={`${customer.email}-detail`} className="border-b border-cream/5 last:border-0 bg-cream/[0.03]">
                      <td colSpan={5} className="px-4 py-4">
                        <div className="grid gap-6 md:grid-cols-2">
                          <div>
                            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-cream/50">
                              Booking history
                            </h3>
                            {customerBookings.length === 0 ? (
                              <p className="text-xs text-cream/40">No bookings.</p>
                            ) : (
                              <ul className="space-y-2">
                                {customerBookings.map((b) => (
                                  <li key={b.id} className="flex items-center justify-between gap-3 text-xs">
                                    <span className="text-cream/70">
                                      {formatDate(b.appointmentStart)} · {b.serviceName}
                                    </span>
                                    <span className="flex items-center gap-2">
                                      <span className={`rounded-full px-2 py-0.5 ${BOOKING_STATUS_STYLE[b.status]}`}>
                                        {b.status}
                                      </span>
                                      <span className="text-cream/50">{formatPence(b.amountPence)}</span>
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <div>
                            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-cream/50">
                              Order history
                            </h3>
                            {customerOrders.length === 0 ? (
                              <p className="text-xs text-cream/40">No shop orders.</p>
                            ) : (
                              <ul className="space-y-2">
                                {customerOrders.map((o) => (
                                  <li key={o.id} className="text-xs">
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-cream/70">{formatDate(o.createdAt)}</span>
                                      <span className="flex items-center gap-2">
                                        <span className={`rounded-full px-2 py-0.5 ${ORDER_STATUS_STYLE[o.status]}`}>
                                          {o.status}
                                        </span>
                                        <span className="text-cream/50">{formatPence(o.subtotalPence)}</span>
                                      </span>
                                    </div>
                                    <div className="mt-0.5 text-cream/40">
                                      {o.items.map((item) => `${item.name} ×${item.quantity}`).join(', ')}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
