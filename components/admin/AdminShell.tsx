'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SignOutButton from '@/components/admin/SignOutButton';
import { MANAGE_LINKS, MANAGE_GROUPS } from '@/lib/admin/nav';

/**
 * Acuity-style admin shell. Light mode by default.
 *  - Mobile / iPad (< lg): fixed bottom tab bar (Calendar · Checkout ·
 *    Availability · Clients · Menu) + a top header with the page title. The
 *    "Menu" tab opens the hub (/admin/menu) that links to everything else.
 *  - Desktop (lg+): a fixed left sidebar with the same primary sections plus
 *    the full "Manage" list, so nothing is more than one click away.
 */

type IconProps = { className?: string };

const CalendarIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9h18M8 3v3M16 3v3" />
  </svg>
);
const CartIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M3 4h2l2.4 12.2a1 1 0 0 0 1 .8h8.7a1 1 0 0 0 1-.8L21 8H6" /><circle cx="9" cy="20" r="1.3" /><circle cx="18" cy="20" r="1.3" />
  </svg>
);
const ClockIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" />
  </svg>
);
const UserIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
  </svg>
);
const MenuIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

type PrimaryItem = { href: string; label: string; Icon: (p: IconProps) => JSX.Element };

const PRIMARY: PrimaryItem[] = [
  { href: '/admin/bookings', label: 'Calendar', Icon: CalendarIcon },
  { href: '/admin/checkout', label: 'Checkout', Icon: CartIcon },
  { href: '/admin/availability', label: 'Availability', Icon: ClockIcon },
  { href: '/admin/customers', label: 'Clients', Icon: UserIcon },
  { href: '/admin/menu', label: 'Menu', Icon: MenuIcon },
];

const MANAGE_HREFS = MANAGE_LINKS.map((l) => l.href);

function titleFor(pathname: string): string {
  const all = [...PRIMARY, ...MANAGE_LINKS];
  const match = all
    .filter((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? 'Admin';
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  // The Menu tab is "active" whenever you're on the hub or any tool it links to.
  const isPrimaryActive = (item: PrimaryItem) =>
    item.href === '/admin/menu'
      ? isActive('/admin/menu') || MANAGE_HREFS.some((h) => isActive(h))
      : isActive(item.href);

  return (
    <div className="min-h-screen bg-cream-soft text-charcoal">
      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-charcoal/10 bg-white lg:flex">
        <div className="border-b border-charcoal/10 px-6 py-5">
          <Link href="/admin/bookings" className="font-serif text-xl font-light tracking-tight">
            MIRILUXE
          </Link>
          <p className="mt-0.5 text-[0.65rem] uppercase tracking-luxe text-charcoal/45">Studio Admin</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {PRIMARY.filter((p) => p.href !== '/admin/menu').map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  isActive(href) ? 'bg-gold/15 font-medium text-gold' : 'text-charcoal/70 hover:bg-charcoal/[0.04]'
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            ))}
          </div>
          <SidebarGroupedLinks isActive={isActive} />
        </nav>
        <div className="border-t border-charcoal/10 px-5 py-4">
          <SignOutButton />
        </div>
      </aside>

      {/* ── Mobile / iPad top header ────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-charcoal/10 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <span className="font-serif text-lg font-light">{titleFor(pathname)}</span>
        <SignOutButton />
      </header>

      {/* ── Main content ────────────────────────────────────────────── */}
      <main className="px-4 pb-24 pt-5 sm:px-6 lg:ml-64 lg:px-10 lg:pb-12 lg:pt-8">{children}</main>

      {/* ── Mobile / iPad bottom tab bar ────────────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-charcoal/10 bg-white/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
          {PRIMARY.map((item) => {
            const active = isPrimaryActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.62rem] font-medium transition-colors ${
                  active ? 'text-gold' : 'text-charcoal/55'
                }`}
              >
                <item.Icon className="h-[22px] w-[22px]" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function SidebarGroupedLinks({ isActive }: { isActive: (href: string) => boolean }) {
  return (
    <div className="mt-6 space-y-5">
      {MANAGE_GROUPS.map((group) => (
        <div key={group}>
          <p className="px-3 pb-1.5 text-[0.6rem] font-semibold uppercase tracking-luxe text-charcoal/40">{group}</p>
          <div className="space-y-0.5">
            {MANAGE_LINKS.filter((l) => l.group === group).map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive(href) ? 'bg-gold/15 font-medium text-gold' : 'text-charcoal/65 hover:bg-charcoal/[0.04]'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
