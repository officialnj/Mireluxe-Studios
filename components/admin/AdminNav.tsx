'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SignOutButton from '@/components/admin/SignOutButton';

const LINKS = [
  { href: '/admin/bookings', label: 'Bookings' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/availability', label: 'Availability' },
  { href: '/admin/blocked-dates', label: 'Blocked Dates' },
  { href: '/admin/service-categories', label: 'Service Categories' },
  { href: '/admin/services', label: 'Services' },
  { href: '/admin/addons', label: 'Add-ons' },
  { href: '/admin/trending-deals', label: 'Trending Deals' },
  { href: '/admin/bundles', label: 'Products' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/discounts', label: 'Discounts' },
  { href: '/admin/consumables', label: 'Consumables' },
  { href: '/admin/settings', label: 'Settings' },
];

export default function AdminNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname?.startsWith(`${href}/`);
  }

  return (
    <nav className="sticky top-0 z-40 border-b border-cream/10 bg-charcoal">
      <div className="flex items-center justify-between px-4 py-4 md:px-6">
        <span className="font-serif text-lg font-light">MIRILUXE Admin</span>

        {/* Desktop nav */}
        <div className="hidden flex-wrap items-center gap-x-5 gap-y-2 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors ${
                isActive(link.href) ? 'text-gold' : 'text-cream/70 hover:text-gold'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <SignOutButton />
        </div>

        {/* Mobile hamburger toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          className="flex h-10 w-10 items-center justify-center text-cream md:hidden"
        >
          {open ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-6 w-6">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-6 w-6">
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="border-t border-cream/10 px-4 pb-4 md:hidden">
          <div className="flex flex-col gap-1 pt-2">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive(link.href) ? 'bg-gold/10 text-gold' : 'text-cream/70 hover:bg-cream/5 hover:text-gold'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 border-t border-cream/10 px-3 pt-3">
              <SignOutButton />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
