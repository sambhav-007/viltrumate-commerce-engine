import React, { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext();
const KEY = "aura_cart";

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
};

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(load);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  // item: { shadeId, shadeName, productName, productSlug, price, image, qty }
  const add = (item, qty = 1) => {
    setItems((prev) => {
      const i = prev.findIndex((x) => x.shadeId === item.shadeId);
      if (i > -1) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + qty };
        return next;
      }
      return [...prev, { ...item, qty }];
    });
    setOpen(true);
  };
  const setQty = (shadeId, qty) =>
    setItems((prev) =>
      prev
        .map((x) => (x.shadeId === shadeId ? { ...x, qty: Math.max(1, qty) } : x))
        .filter((x) => x.qty > 0)
    );
  const remove = (shadeId) =>
    setItems((prev) => prev.filter((x) => x.shadeId !== shadeId));
  const clear = () => setItems([]);

  const count = items.reduce((n, x) => n + x.qty, 0);
  const total = items.reduce((n, x) => n + x.price * x.qty, 0);

  return (
    <CartContext.Provider
      value={{ items, add, setQty, remove, clear, count, total, open, setOpen }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
