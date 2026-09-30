'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import CartDrawer from '@/components/CartDrawer';

/**
 * The public marketing nav is `fixed inset-x-0 top-0 z-50` (see Nav.tsx) —
 * it overlays whatever renders first in normal document flow rather than
 * pushing it down. On /admin/* routes, that "whatever" is the admin
 * layout's own nav bar, which was rendering correctly but sitting directly
 * underneath the fixed public nav, completely hidden. Excluding the public
 * chrome from admin routes entirely, rather than trying to offset around a
 * fixed overlay, since admin has its own nav/sign-out and no use for the
 * public marketing nav, footer, or shop cart drawer.
 */
export default function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) {
    return <>{children}</>;
  }

  return (
    <>
      <Nav />
      <main>{children}</main>
      <Footer />
      <CartDrawer />
    </>
  );
}
