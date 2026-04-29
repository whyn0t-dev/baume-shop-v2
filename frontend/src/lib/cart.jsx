import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

const CartContext = createContext(null);
const STORAGE_KEY = "baume_cart_v1";

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) { /* ignore */ }
  }, [items]);

  const addItem = useCallback((product, options = {}) => {
    const key = `${product.id}::${options.size || ""}::${options.color || ""}`;
    setItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) => (i.key === key ? { ...i, quantity: i.quantity + (options.quantity || 1) } : i));
      }
      return [
        ...prev,
        {
          key,
          product_id: product.id,
          slug: product.slug,
          name: product.name,
          price: product.price,
          image: product.image,
          size: options.size || null,
          color: options.color || null,
          quantity: options.quantity || 1,
        },
      ];
    });
    setOpen(true);
  }, []);

  const removeItem = useCallback((key) => setItems((prev) => prev.filter((i) => i.key !== key)), []);

  const updateQty = useCallback(
    (key, qty) =>
      setItems((prev) =>
        prev
          .map((i) => (i.key === key ? { ...i, quantity: Math.max(1, qty) } : i))
          .filter((i) => i.quantity > 0),
      ),
    [],
  );

  const clear = useCallback(() => setItems([]), []);

  const subtotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const count = items.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, subtotal, count, open, setOpen, addItem, removeItem, updateQty, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
