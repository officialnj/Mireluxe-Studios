'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NAV_LINKS } from '@/lib/site';
import { ButtonLink } from '@/components/ui/Button';
import ThemeToggle from '@/components/ThemeToggle';

function Icon({ name }: { name: 'search' | 'account' | 'cart' }) {
  const paths: Record<string, JSX.Element> = {
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </>
    ),
    account: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    cart: (
      <>
        <path d="M6 6h15l-1.5 9h-12z" />
        <path d="M6 6 5 3H2" />
        <circle cx="9" cy="20" r="1" />
        <circle cx="18" cy="20" r="1" />
      </>
    ),
  };
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function Wordmark({ light }: { light?: boolean }) {
  return (
    <Link href="/" className="flex flex-col leading-none">
      <span
        className={`font-serif text-xl font-light uppercase tracking-[0.32em] sm:text-2xl ${
          light ? 'text-cream' : 'text-charcoal dark:text-cream'
        }`}
      >
        Miriluxe
      </span>
      <span
        className={`mt-1 font-serif text-[0.62rem] italic tracking-[0.35em] ${
          light ? 'text-cream/70' : 'text-gold'
        }`}
      >
        Braid Studio
      </span>
    </Link>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const overHero = pathname === '/';
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  const transparent = overHero && !scrolled;
  const solidText = 'text-charcoal dark:text-cream';
  const textColor = transparent ? 'text-cream' : solidText;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-luxe ${
        transparent
          ? 'bg-transparent py-5'
          : 'border-b border-charcoal/10 bg-cream/85 py-3 backdrop-blur-md dark:border-cream/10 dark:bg-charcoal/85'
      }`}
    >
      <nav className="container-luxe flex items-center justify-between gap-6">
        <Wordmark light={transparent} />

        {/* Desktop links */}
        <ul className={`hidden items-center gap-8 lg:flex ${textColor}`}>
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`link-underline text-[0.78rem] font-medium uppercase tracking-[0.18em] transition-colors duration-300 hover:text-gold ${
                    active ? 'text-gold' : ''
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Right cluster */}
        <div className={`flex items-center gap-1 sm:gap-2 ${textColor}`}>
          <button aria-label="Search" className="hidden h-9 w-9 items-center justify-center rounded-full transition-colors hover:text-gold sm:flex">
            <Icon name="search" />
          </button>
          <button aria-label="Account" className="hidden h-9 w-9 items-center justify-center rounded-full transition-colors hover:text-gold sm:flex">
            <Icon name="account" />
          </button>
          <button aria-label="Cart" className="relative flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:text-gold">
            <Icon name="cart" />
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[0.55rem] font-semibold text-charcoal">
              0
            </span>
          </button>
          <ThemeToggle />
          <ButtonLink href="/book" variant="outline" size="sm" className="ml-2 hidden md:inline-flex">
            Book Now
          </ButtonLink>

          {/* Mobile hamburger */}
          <button
            aria-label="Menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="ml-1 flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:text-gold lg:hidden"
          >
            <div className="flex w-5 flex-col gap-[5px]">
              <span className={`h-px w-full bg-current transition-all duration-300 ${menuOpen ? 'translate-y-[6px] rotate-45' : ''}`} />
              <span className={`h-px w-full bg-current transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`h-px w-full bg-current transition-all duration-300 ${menuOpen ? '-translate-y-[6px] -rotate-45' : ''}`} />
            </div>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-charcoal/10 bg-cream/95 backdrop-blur-md dark:border-cream/10 dark:bg-charcoal/95 lg:hidden"
          >
            <ul className="container-luxe flex flex-col gap-1 py-6 text-charcoal dark:text-cream">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block py-3 text-sm font-medium uppercase tracking-[0.18em] transition-colors hover:text-gold"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li className="pt-4">
                <ButtonLink href="/book" variant="solid" size="md" className="w-full">
                  Book Now
                </ButtonLink>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
