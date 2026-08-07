'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/Button';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

type Props = {
  clientSecret: string;
  onSuccess: () => void;
  onError: (message: string) => void;
};

function PayButton({ onSuccess, onError }: Pick<Props, 'onSuccess' | 'onError'>) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    setSubmitting(false);

    if (error) {
      onError(error.message ?? 'Payment failed — please try again.');
      return;
    }
    if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
      onSuccess();
    } else {
      onError('Payment did not complete — please try again.');
    }
  };

  return (
    <Button type="button" size="md" className="w-full" disabled={!stripe || submitting} onClick={handleSubmit}>
      {submitting ? 'Processing…' : 'Pay deposit & confirm'}
    </Button>
  );
}

export default function PaymentStep({ clientSecret, onSuccess, onError }: Props) {
  if (!stripePromise) {
    return (
      <p className="rounded-xl bg-gold/10 px-4 py-3 text-sm text-charcoal/70 dark:text-cream/70">
        Online payment isn&apos;t available yet — please contact the studio directly to secure this slot.
      </p>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <div className="space-y-5">
        <PaymentElement />
        <PayButton onSuccess={onSuccess} onError={onError} />
      </div>
    </Elements>
  );
}
