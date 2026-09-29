'use client';

import { useState } from 'react';
import PageHero from '@/components/ui/PageHero';
import { Button } from '@/components/ui/Button';
import PaymentStep from '@/components/booking/PaymentStep';
import { useCart } from '@/components/CartProvider';
import { formatPence } from '@/lib/booking/pricing';

const field =
  'w-full rounded-xl border border-charcoal/20 bg-transparent px-4 py-3 text-sm outline-none transition-colors placeholder:text-charcoal/40 focus:border-gold dark:border-cream/20 dark:placeholder:text-cream/40 dark:[color-scheme:dark]';
const label = 'mb-2 block text-[0.7rem] font-medium uppercase tracking-luxe text-charcoal/60 dark:text-cream/60';

type Step = 'details' | 'payment' | 'success';

export default function ShopCheckoutPage() {
  const cart = useCart();
  const [step, setStep] = useState<Step>('details');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');

  const subtotal = cart.productSubtotalPence;

  async function handleSubmitDetails(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/shop/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.productLines.map((l) => ({ slug: l.slug, quantity: l.quantity })),
          customerName,
          customerEmail,
          customerPhone: customerPhone || undefined,
          shipping: { line1, line2: line2 || undefined, city, postcode, country: 'GB' },
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage('Something went wrong creating your order. Please try again.');
        return;
      }

      setClientSecret(data.clientSecret);
      setStep('payment');
    } catch {
      setErrorMessage('Network error — please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (cart.productLines.length === 0 && step !== 'success') {
    return (
      <>
        <PageHero eyebrow="Checkout" title="Your bag is empty" intro="Add something from the shop first." />
        <div className="container-luxe pb-24 text-center lg:pb-32">
          <Button type="button" size="md" onClick={() => (window.location.href = '/shop')}>
            Back to shop
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHero eyebrow="Checkout" title="Complete your order" intro="Full payment is taken now — items ship once confirmed." />
      <div className="container-luxe max-w-2xl pb-24 lg:pb-32">
        {errorMessage && (
          <p className="mb-6 rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {errorMessage}
          </p>
        )}

        {step === 'details' && (
          <>
            <div className="mb-8 rounded-2xl border border-charcoal/12 p-6 dark:border-cream/12">
              {cart.productLines.map((line) => (
                <div key={line.lineId} className="flex justify-between py-1 text-sm">
                  <span>
                    {line.quantity}× {line.name}
                  </span>
                  <span>{formatPence(line.pricePence * line.quantity)}</span>
                </div>
              ))}
              <div className="mt-3 flex justify-between border-t border-charcoal/12 pt-3 text-sm font-medium dark:border-cream/12">
                <span>Total</span>
                <span>{formatPence(subtotal)}</span>
              </div>
            </div>

            <form onSubmit={handleSubmitDetails} className="space-y-5">
              <div>
                <label className={label} htmlFor="name">
                  Full name
                </label>
                <input id="name" required className={field} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div>
                <label className={label} htmlFor="email">
                  Email
                </label>
                <input id="email" type="email" required className={field} value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
              </div>
              <div>
                <label className={label} htmlFor="phone">
                  Phone (optional)
                </label>
                <input id="phone" type="tel" className={field} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              </div>
              <div>
                <label className={label} htmlFor="line1">
                  Address line 1
                </label>
                <input id="line1" required className={field} value={line1} onChange={(e) => setLine1(e.target.value)} />
              </div>
              <div>
                <label className={label} htmlFor="line2">
                  Address line 2 (optional)
                </label>
                <input id="line2" className={field} value={line2} onChange={(e) => setLine2(e.target.value)} />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className={label} htmlFor="city">
                    City
                  </label>
                  <input id="city" required className={field} value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className="flex-1">
                  <label className={label} htmlFor="postcode">
                    Postcode
                  </label>
                  <input id="postcode" required className={field} value={postcode} onChange={(e) => setPostcode(e.target.value)} />
                </div>
              </div>
              <Button type="submit" size="md" className="w-full" disabled={submitting}>
                {submitting ? 'Please wait…' : 'Continue to payment'}
              </Button>
            </form>
          </>
        )}

        {step === 'payment' && clientSecret && (
          <PaymentStep
            clientSecret={clientSecret}
            buttonLabel="Pay & place order"
            onSuccess={() => {
              cart.clearProductLines();
              setStep('success');
            }}
            onError={(message) => setErrorMessage(message)}
          />
        )}

        {step === 'success' && (
          <div className="rounded-3xl border border-gold/40 bg-gold/5 p-10 text-center">
            <p className="font-serif text-2xl font-light">Order placed ✦</p>
            <p className="mt-2 text-sm text-charcoal/65 dark:text-cream/65">
              A confirmation email is on its way to {customerEmail}.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
