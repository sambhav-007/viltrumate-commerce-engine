import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCart } from "../context/CartContext";

// Gentle "resume your cart" nudge: cart persists in localStorage, so a
// returning visitor with items sees one slim dismissible bar (per session)
// instead of silently forgetting their basket. Hidden on cart/checkout pages.
const KEY = "vce_cart_nudge_dismissed";

const ResumeCartBar = () => {
  const { items, count } = useCart();
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(KEY) === "1"
  );

  const hiddenHere =
    pathname.startsWith("/cart") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/thank-you") ||
    pathname.startsWith("/admin");
  if (dismissed || hiddenHere || !items.length) return null;

  return (
    <div
      className="hairline-b"
      style={{ background: "var(--sand)", padding: "0.6rem 0" }}
    >
      <div className="aura-container flex items-center justify-between gap-3 text-sm">
        <span>
          You have <b>{count}</b> item{count > 1 ? "s" : ""} waiting in your cart.
        </span>
        <span className="flex items-center gap-4 whitespace-nowrap">
          <Link to="/checkout" className="nav-link" style={{ paddingBottom: 0 }}>
            Checkout
          </Link>
          <button
            aria-label="Dismiss"
            className="text-muted"
            onClick={() => {
              sessionStorage.setItem(KEY, "1");
              setDismissed(true);
            }}
          >
            ✕
          </button>
        </span>
      </div>
    </div>
  );
};

export default ResumeCartBar;
