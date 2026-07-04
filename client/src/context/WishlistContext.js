import React, { createContext, useContext, useEffect, useState } from "react";

// Wishlist v1 (feature-flagged "wishlist"): device-local, no account needed.
// Stores lightweight product snapshots so the wishlist page renders without a
// fetch-per-item; the PDP link is the source of truth for live data.
const KEY = "vce_wishlist";
const WishlistContext = createContext(null);

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch (e) {
    return [];
  }
};

export const WishlistProvider = ({ children }) => {
  const [items, setItems] = useState(read);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const has = (slug) => items.some((p) => p.slug === slug);
  const toggle = (product) =>
    setItems((prev) =>
      prev.some((p) => p.slug === product.slug)
        ? prev.filter((p) => p.slug !== product.slug)
        : [
            ...prev,
            {
              slug: product.slug,
              name: product.name,
              minPrice: product.minPrice != null ? product.minPrice : null,
              coverImage: product.coverImage || null,
              shadeCount: product.shadeCount || 0,
              rating: product.rating || null,
            },
          ]
    );
  const remove = (slug) => setItems((prev) => prev.filter((p) => p.slug !== slug));

  return (
    <WishlistContext.Provider value={{ items, has, toggle, remove }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => useContext(WishlistContext);
