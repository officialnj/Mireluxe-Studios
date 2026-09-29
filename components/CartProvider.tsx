'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { BundleLine } from '@/components/booking/BundleUpsell';

export type ProductLine = {
  kind: 'product';
  lineId: string;
  slug: string;
  name: string;
  quantity: number;
  pricePence: number;
  spec: string;
  category: string;
};

export type CartBundleLine = {
  kind: 'bundle';
  lineId: string;
  variantId: string;
  inches: number;
  colour: string;
  quantity: number;
  pricePence: number;
};

type CartLine = ProductLine | CartBundleLine;

const STORAGE_KEY = 'mireluxe.cart.v1';

type PricedBundleLine = BundleLine & { pricePence: number };

type CartContextValue = {
  lines: CartLine[];
  bundleLines: BundleLine[];
  setBundleLines: (lines: PricedBundleLine[]) => void;
  clearBundleLines: () => void;
  productLines: ProductLine[];
  addProductLine: (product: { slug: string; name: string; pricePence: number; spec: string; category: string }, quantity?: number) => void;
  updateProductQuantity: (lineId: string, quantity: number) => void;
  removeProductLine: (lineId: string) => void;
  clearProductLines: () => void;
  itemCount: number;
  bundleSubtotalPence: number;
  productSubtotalPence: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setLines(parsed);
      }
    } catch {
      // Corrupt/old-shape cart — start fresh rather than crash.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines, hydrated]);

  const bundleLines: BundleLine[] = lines
    .filter((l): l is CartBundleLine => l.kind === 'bundle')
    .map((l) => ({ variantId: l.variantId, inches: l.inches, colour: l.colour, quantity: l.quantity }));

  function setBundleLines(newBundleLines: PricedBundleLine[]) {
    setLines((prev) => [
      ...prev.filter((l) => l.kind !== 'bundle'),
      ...newBundleLines.map((l) => ({
        kind: 'bundle' as const,
        lineId: l.variantId,
        variantId: l.variantId,
        inches: l.inches,
        colour: l.colour,
        quantity: l.quantity,
        pricePence: l.pricePence,
      })),
    ]);
  }

  function clearBundleLines() {
    setLines((prev) => prev.filter((l) => l.kind !== 'bundle'));
  }

  const productLines = lines.filter((l): l is ProductLine => l.kind === 'product');

  function addProductLine(product: { slug: string; name: string; pricePence: number; spec: string; category: string }, quantity = 1) {
    setLines((prev) => {
      const existing = prev.find((l) => l.kind === 'product' && l.slug === product.slug) as ProductLine | undefined;
      if (existing) {
        return prev.map((l) => (l === existing ? { ...existing, quantity: existing.quantity + quantity } : l));
      }
      return [...prev, { kind: 'product', lineId: uid(), quantity, ...product }];
    });
    setIsOpen(true);
  }

  function updateProductQuantity(lineId: string, quantity: number) {
    setLines((prev) =>
      prev.map((l) => (l.kind === 'product' && l.lineId === lineId ? { ...l, quantity: Math.max(1, quantity) } : l))
    );
  }

  function removeProductLine(lineId: string) {
    setLines((prev) => prev.filter((l) => !(l.kind === 'product' && l.lineId === lineId)));
  }

  function clearProductLines() {
    setLines((prev) => prev.filter((l) => l.kind !== 'product'));
  }

  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const bundleSubtotalPence = lines
    .filter((l): l is CartBundleLine => l.kind === 'bundle')
    .reduce((sum, l) => sum + l.pricePence * l.quantity, 0);
  const productSubtotalPence = productLines.reduce((sum, l) => sum + l.pricePence * l.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        lines,
        bundleLines,
        setBundleLines,
        clearBundleLines,
        productLines,
        addProductLine,
        updateProductQuantity,
        removeProductLine,
        clearProductLines,
        itemCount,
        bundleSubtotalPence,
        productSubtotalPence,
        isOpen,
        openCart: () => setIsOpen(true),
        closeCart: () => setIsOpen(false),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
