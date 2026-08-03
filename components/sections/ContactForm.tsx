'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

const field =
  'w-full rounded-xl border border-charcoal/20 bg-transparent px-4 py-3 text-sm outline-none transition-colors placeholder:text-charcoal/40 focus:border-gold dark:border-cream/20 dark:placeholder:text-cream/40';
const label = 'mb-2 block text-[0.7rem] font-medium uppercase tracking-luxe text-charcoal/60 dark:text-cream/60';

export default function ContactForm() {
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="rounded-3xl border border-gold/40 bg-gold/5 p-10 text-center">
        <p className="font-serif text-2xl font-light">Message sent ✦</p>
        <p className="mt-3 text-sm text-charcoal/65 dark:text-cream/65">
          Thank you for reaching out. We’ll be in touch as soon as possible.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
      }}
      className="rounded-3xl border border-charcoal/10 bg-cream-soft/60 p-8 dark:border-cream/10 dark:bg-charcoal-soft/60"
    >
      <div className="space-y-5">
        <div>
          <label className={label} htmlFor="c-name">Name</label>
          <input id="c-name" required className={field} placeholder="Your name" />
        </div>
        <div>
          <label className={label} htmlFor="c-email">Email</label>
          <input id="c-email" type="email" required className={field} placeholder="you@email.com" />
        </div>
        <div>
          <label className={label} htmlFor="c-message">Message</label>
          <textarea id="c-message" rows={5} required className={field} placeholder="How can we help?" />
        </div>
        <Button type="submit" size="md" className="w-full">
          Send Message
        </Button>
      </div>
    </form>
  );
}
