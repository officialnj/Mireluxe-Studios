import type { ReactNode } from 'react';
import Link from 'next/link';
import { requireAdminPage } from '@/lib/supabase/admin-auth';
import SignOutButton from '@/components/admin/SignOutButton';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminPage();

  return (
    <div className="min-h-screen bg-charcoal text-cream">
      <nav className="flex items-center justify-between border-b border-cream/10 px-6 py-4">
        <div className="flex items-center gap-6">
          <span className="font-serif text-lg font-light">MIRILUXE Admin</span>
          <Link href="/admin/bookings" className="text-sm text-cream/70 hover:text-gold">
            Bookings
          </Link>
          <Link href="/admin/customers" className="text-sm text-cream/70 hover:text-gold">
            Customers
          </Link>
          <Link href="/admin/availability" className="text-sm text-cream/70 hover:text-gold">
            Availability
          </Link>
          <Link href="/admin/blocked-dates" className="text-sm text-cream/70 hover:text-gold">
            Blocked Dates
          </Link>
          <Link href="/admin/service-categories" className="text-sm text-cream/70 hover:text-gold">
            Service Categories
          </Link>
          <Link href="/admin/services" className="text-sm text-cream/70 hover:text-gold">
            Services
          </Link>
          <Link href="/admin/trending-deals" className="text-sm text-cream/70 hover:text-gold">
            Trending Deals
          </Link>
          <Link href="/admin/bundles" className="text-sm text-cream/70 hover:text-gold">
            Products
          </Link>
          <Link href="/admin/orders" className="text-sm text-cream/70 hover:text-gold">
            Orders
          </Link>
          <Link href="/admin/discounts" className="text-sm text-cream/70 hover:text-gold">
            Discounts
          </Link>
          <Link href="/admin/consumables" className="text-sm text-cream/70 hover:text-gold">
            Consumables
          </Link>
          <Link href="/admin/settings" className="text-sm text-cream/70 hover:text-gold">
            Settings
          </Link>
        </div>
        <SignOutButton />
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
