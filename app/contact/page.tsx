import type { Metadata } from 'next';
import { CONTACT } from '@/lib/site';
import Reveal from '@/components/Reveal';
import PageHero from '@/components/ui/PageHero';
import ContactForm from '@/components/sections/ContactForm';

export const metadata: Metadata = {
  title: 'Contact Us — MIRILUXE Studios',
  description:
    'Get in touch with MIRILUXE Studios in Wembley, North West London. Opening hours, phone line and social.',
};

function InfoIcon({ name }: { name: string }) {
  const paths: Record<string, JSX.Element> = {
    location: (
      <>
        <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    hours: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    phone: (
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
    ),
    social: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
      </>
    ),
  };
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export default function ContactPage() {
  const cards = [
    { icon: 'location', title: 'Studio', lines: [CONTACT.address] },
    { icon: 'hours', title: 'Opening Hours', lines: [CONTACT.openingHours, `Phone line ${CONTACT.phoneHours}`] },
    { icon: 'phone', title: 'Call', lines: [CONTACT.phone] },
    { icon: 'social', title: 'Instagram', lines: [CONTACT.instagram] },
  ];

  return (
    <>
      <PageHero
        eyebrow="Contact Us"
        title="Let’s talk about your crown"
        intro="Questions about a style, a booking or a collaboration? Send a message and we’ll get back to you."
      />

      <section className="container-luxe pb-24 lg:pb-32">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Info + form */}
          <div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {cards.map((card, i) => (
                <Reveal key={card.title} delay={i * 0.08}>
                  <div className="flex h-full flex-col rounded-2xl border border-charcoal/10 p-6 transition-colors duration-500 hover:border-gold/40 dark:border-cream/10">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold/10 text-gold">
                      <InfoIcon name={card.icon} />
                    </span>
                    <h3 className="mt-5 font-serif text-lg font-light tracking-tight">
                      {card.title}
                    </h3>
                    {card.lines.map((line) => (
                      <p key={line} className="mt-1 text-sm text-charcoal/65 dark:text-cream/65">
                        {line}
                      </p>
                    ))}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal delay={0.1}>
            <ContactForm />
          </Reveal>
        </div>

        {/* Map */}
        <Reveal className="mt-14">
          <div className="overflow-hidden rounded-3xl border border-charcoal/10 dark:border-cream/10">
            <iframe
              title="MIRILUXE Studios location"
              src="https://www.openstreetmap.org/export/embed.html?bbox=-0.3200%2C51.5480%2C-0.2650%2C51.5680&layer=mapnik&marker=51.5580%2C-0.2925"
              className="h-[380px] w-full grayscale-[0.3]"
              loading="lazy"
            />
          </div>
        </Reveal>
      </section>
    </>
  );
}
