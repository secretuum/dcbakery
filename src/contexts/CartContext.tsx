"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CartItem, Product } from "@/src/types";

type CartContextValue = {
  items: CartItem[];
  isReady: boolean;
  add: (product: Product, qty?: number) => void;
  remove: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  clear: () => void;
  totalItems: number;
  totalAmount: number;
};

const CART_STORAGE_KEY = "dc-bakery-cart";

const CartContext = createContext<CartContextValue | null>(null);

function normalizeQty(product: Product, qty: number) {
  if (!Number.isFinite(qty) || qty <= 0) {
    return 0;
  }

  const minQty = Math.max(product.min_qty, 1);
  const stepQty = Math.max(product.step_qty, 1);

  if (qty <= minQty) {
    return minQty;
  }

  return minQty + Math.ceil((qty - minQty) / stepQty) * stepQty;
}

function readStoredCart() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setItems(readStoredCart());
      setIsReady(true);
    }, 0);

    return () => window.clearTimeout(timerId);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [isReady, items]);

  const add = useCallback((product: Product, qty = product.min_qty) => {
    const nextQty = normalizeQty(product, qty);

    if (nextQty <= 0) {
      return;
    }

    setItems((currentItems) => {
      const existing = currentItems.find((item) => item.product.id === product.id);

      if (!existing) {
        return [...currentItems, { product, qty: nextQty }];
      }

      return currentItems.map((item) =>
        item.product.id === product.id
          ? { ...item, qty: normalizeQty(product, item.qty + nextQty) }
          : item,
      );
    });
  }, []);

  const remove = useCallback((productId: string) => {
    setItems((currentItems) => currentItems.filter((item) => item.product.id !== productId));
  }, []);

  const updateQty = useCallback((productId: string, qty: number) => {
    setItems((currentItems) =>
      currentItems.flatMap((item) => {
        if (item.product.id !== productId) {
          return [item];
        }

        const nextQty = normalizeQty(item.product, qty);
        return nextQty > 0 ? [{ ...item, qty: nextQty }] : [];
      }),
    );
  }, []);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const totalItems = items.reduce((sum, item) => sum + item.qty, 0);
    const totalAmount = items.reduce((sum, item) => sum + item.product.price * item.qty, 0);

    return {
      items,
      isReady,
      add,
      remove,
      updateQty,
      clear,
      totalItems,
      totalAmount,
    };
  }, [add, clear, isReady, items, remove, updateQty]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return context;
}
