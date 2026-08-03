'use client';

import Link from 'next/link';
import { useState } from 'react';
import { NAV_LINKS, CONTACT } from '@/lib/site';
import { Button } from '@/components/ui/Button';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [joined, setJoined] = useState(false);
  const year = 2026;

  return (
    <footer className="border-t border-charcoal/10 bg-cream-soft dark:border-cream/10 dark:bg-charcoal-soft">
      <div className="container-luxe grid grid-cols-1 gap-12 py-16 md:grid-cols-2 lg:grid-cols-4 lg:py-20">
        {/* Brand */}
        <div className="max-w-xs">
          <div className="flex flex-col leading-none">
            <span className="font-serif text-2xl font-light uppercase tracking-[0.32em]">
              Miriluxe
            </span>
            <span className="mt-1 font-serif text-[0.62rem] italic tracking-[0.35em] text-gold">
              Braid Studio
            </span>
          </div>
          <p className="mt-6 text-sm leading-relaxed text-charcoal/70 dark:text-cream/70">
            Where braiding is elevated into a luxury experience — detail-driven
            styles crafted in a private Wembley studio.
          </p>
        </div>

        {/* Explore */}
        <div>
          <h4 className="eyebrow mb-6">Explore</h4>
          <ul className="space-y-3">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="link-underline text-sm text-charcoal/75 transition-colors hover:text-gold dark:text-cream/75"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Visit & Contact */}
        <div>
          <h4 className="eyebrow mb-6">Visit &amp; Contact</h4>
          <ul className="space-y-3 text-sm text-charcoal/75 dark:text-cream/75">
            <li>{CONTACT.address}</li>
            <li>Opening hours: {CONTACT.openingHours}</li>
            <li>Phone line: {CONTACT.phoneHours}</li>
            <li>
              <a href={`tel:${CONTACT.phone.replace(/\s/g, '')}`} className="transition-colors hover:text-gold">
                {CONTACT.phone}
              </a>
            </li>
            <li>
              <a href={CONTACT.instagramUrl} target="_blank" rel="noreferrer" className="transition-colors hover:text-gold">
                {CONTACT.instagram}
              </a>
            </li>
          </ul>
        </div>

        {/* Newsletter */}
        <div>
          <h4 className="eyebrow mb-6">Newsletter</h4>
          <p className="mb-4 text-sm text-charcoal/70 dark:text-cream/70">
            New appointment slots release on the 20th of every month. Be the
            first to know.
          </p>
          {joined ? (
            <p className="text-sm text-gold">Thank you — you’re on the list.</p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (email.trim()) setJoined(true);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                className="w-full rounded-full border border-charcoal/20 bg-transparent px-4 py-3 text-sm outline-none transition-colors placeholder:text-charcoal/40 focus:border-gold dark:border-cream/20 dark:placeholder:text-cream/40"
              />
              <Button type="submit" size="sm" className="shrink-0">
                Join
              </Button>
            </form>
          )}
        </div>
      </div>

      <div className="border-t border-charcoal/10 dark:border-cream/10">
        <div className="container-luxe flex flex-col items-center justify-between gap-3 py-6 text-xs text-charcoal/60 dark:text-cream/60 sm:flex-row">
          <p>© {year} MIRILUXE Braid Studio. All rights reserved.</p>
          <p className="tracking-[0.2em] uppercase">Wembley · NW London</p>
        </div>
      </div>
    </footer>
  );
}
