'use client';

import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useCart } from '@/components/CartProvider';
import { formatPence } from '@/lib/booking/pricing';
import { Button } from '@/components/ui/Button';

export default function CartDrawer() {
  const cart = useCart();
  const router = useRouter();

  const hasBundles = cart.bundleLines.length > 0;
  const hasProducts = cart.productLines.length > 0;

  function goToBooking() {
    cart.closeCart();
    router.push('/book');
  }

  function goToShopCheckout() {
    cart.closeCart();
    router.push('/shop/checkout');
  }

  return (
    <AnimatePresence>
      {cart.isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={cart.closeCart}
            className="fixed inset-0 z-[110] bg-charcoal/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-y-0 right-0 z-[120] flex w-full max-w-sm flex-col bg-cream shadow-2xl dark:bg-charcoal"
          >
            <div className="flex items-center justify-between border-b border-charcoal/10 px-6 py-5 dark:border-cream/10">
              <h2 className="font-serif text-xl font-light">Your Cart</h2>
              <button
                aria-label="Close cart"
                onClick={cart.closeCart}
                className="flex h-9 w-9 items-center justify-center rounded-full text-charcoal/60 transition-colors hover:text-gold dark:text-cream/60"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {!hasBundles && !hasProducts && (
                <p className="text-sm text-charcoal/50 dark:text-cream/50">Your cart is empty.</p>
              )}

              {hasBundles && (
                <div className="mb-8">
                  <h3 className="mb-3 text-[0.7rem] font-medium uppercase tracking-luxe text-charcoal/60 dark:text-cream/60">
                    Your Appointment Add-Ons
                  </h3>
                  <ul className="space-y-2">
                    {cart.bundleLines.map((line) => (
                      <li
                        key={line.variantId}
                        className="flex items-center justify-between rounded-lg border border-charcoal/12 px-4 py-2.5 text-sm dark:border-cream/12"
                      >
                        <span>
                          {line.quantity}× {line.inches}&quot; bundle ({line.colour})
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-right text-sm text-charcoal/70 dark:text-cream/70">
                    Subtotal: {formatPence(cart.bundleSubtotalPence)}
                  </p>
                </div>
              )}

              {hasProducts && (
                <div>
                  <h3 className="mb-3 text-[0.7rem] font-medium uppercase tracking-luxe text-charcoal/60 dark:text-cream/60">
                    Shop Items
                  </h3>
                  <ul className="space-y-3">
                    {cart.productLines.map((line) => (
                      <li key={line.lineId} className="rounded-lg border border-charcoal/12 px-4 py-3 text-sm dark:border-cream/12">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{line.name}</span>
                          <button
                            onClick={() => cart.removeProductLine(line.lineId)}
                            className="text-xs text-charcoal/50 hover:text-red-500 dark:text-cream/50"
                          >
                            Remove
                          </button>
                        </div>
                        <p className="mt-0.5 text-xs text-charcoal/50 dark:text-cream/50">{line.spec}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => cart.updateProductQuantity(line.lineId, line.quantity - 1)}
                              className="flex h-6 w-6 items-center justify-center rounded-full border border-charcoal/20 text-xs dark:border-cream/20"
                            >
                              −
                            </button>
                            <span className="w-4 text-center text-xs">{line.quantity}</span>
                            <button
                              onClick={() => cart.updateProductQuantity(line.lineId, line.quantity + 1)}
                              className="flex h-6 w-6 items-center justify-center rounded-full border border-charcoal/20 text-xs dark:border-cream/20"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-gold">{formatPence(line.pricePence * line.quantity)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-right text-sm text-charcoal/70 dark:text-cream/70">
                    Subtotal: {formatPence(cart.productSubtotalPence)}
                  </p>
                </div>
              )}
            </div>

            {(hasBundles || hasProducts) && (
              <div className="space-y-3 border-t border-charcoal/10 px-6 py-5 dark:border-cream/10">
                {hasBundles && (
                  <Button type="button" size="md" className="w-full" onClick={goToBooking}>
                    Continue to Booking — {cart.bundleLines.length} add-on{cart.bundleLines.length === 1 ? '' : 's'}
                  </Button>
                )}
                {hasProducts && (
                  <Button type="button" variant={hasBundles ? 'outline' : 'solid'} size="md" className="w-full" onClick={goToShopCheckout}>
                    Checkout Shop Items — {formatPence(cart.productSubtotalPence)}
                  </Button>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
