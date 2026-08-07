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
          <Link href="/admin/blocked-dates" className="text-sm text-cream/70 hover:text-gold">
            Blocked Dates
          </Link>
          <Link href="/admin/services" className="text-sm text-cream/70 hover:text-gold">
            Services
          </Link>
          <Link href="/admin/bundles" className="text-sm text-cream/70 hover:text-gold">
            Bundle Stock
          </Link>
          <Link href="/admin/consumables" className="text-sm text-cream/70 hover:text-gold">
            Consumables
          </Link>
        </div>
        <SignOutButton />
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
