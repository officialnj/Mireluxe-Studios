import Link from 'next/link';
import { MANAGE_LINKS, MANAGE_GROUPS } from '@/lib/admin/nav';

export const dynamic = 'force-dynamic';

/** The "Menu" hub (bottom-nav tab on mobile/iPad). Lists every secondary tool
 *  grouped like Acuity's Menu. On desktop these also live in the sidebar. */
export default function AdminMenuPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 font-serif text-2xl font-light">Menu</h1>
      <p className="mb-8 text-sm text-charcoal/55">Everything else you can manage.</p>

      <div className="space-y-8">
        {MANAGE_GROUPS.map((group) => (
          <section key={group}>
            <h2 className="mb-3 text-[0.68rem] font-semibold uppercase tracking-luxe text-charcoal/45">{group}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {MANAGE_LINKS.filter((l) => l.group === group).map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex items-center justify-between rounded-2xl border border-charcoal/10 bg-white p-4 transition-colors hover:border-gold/40"
                >
                  <span>
                    <span className="block text-sm font-medium text-charcoal">{link.label}</span>
                    <span className="mt-0.5 block text-xs text-charcoal/50">{link.description}</span>
                  </span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5 shrink-0 text-charcoal/30 transition-colors group-hover:text-gold" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
