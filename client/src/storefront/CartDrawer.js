import React from "react";
import { useHistory } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { money } from "./format";

const CartDrawer = () => {
  const { items, open, setOpen, setQty, remove, total } = useCart();
  const history = useHistory();

  const go = (path) => {
    setOpen(false);
    history.push(path);
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
          style={{
            background: "rgba(250, 247, 242, 0.25)",
            backdropFilter: "blur(8px) saturate(120%)",
            WebkitBackdropFilter: "blur(8px) saturate(120%)",
            transition: "backdrop-filter 0.3s ease",
          }}
        />
      )}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-cream z-50 shadow-2xl transform transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        } flex flex-col`}
      >
        <div className="flex items-center justify-between px-6 h-20 hairline-b">
          <span className="font-display text-xl">Your Cart</span>
          <button onClick={() => setOpen(false)} className="text-2xl text-muted">×</button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-4">
          {items.length === 0 ? (
            <p className="text-muted text-sm py-10 text-center">Your cart is empty.</p>
          ) : (
            items.map((it) => (
              <div key={it.shadeId} className="flex gap-3 py-4 hairline-b">
                <div
                  className="w-16 h-16 bg-sand rounded"
                  style={{
                    background: it.image
                      ? `url(${it.image}) center/cover`
                      : undefined,
                  }}
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">{it.productName}</div>
                  <div className="text-xs text-muted">{it.shadeName}</div>
                  <div className="text-sm mt-1">{money(it.price)}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      className="w-6 h-6 hairline-b border border-hairline rounded"
                      onClick={() => setQty(it.shadeId, it.qty - 1)}
                    >−</button>
                    <span className="text-sm w-6 text-center">{it.qty}</span>
                    <button
                      className="w-6 h-6 border border-hairline rounded"
                      onClick={() => setQty(it.shadeId, it.qty + 1)}
                    >+</button>
                    <button
                      className="ml-auto text-xs text-muted underline"
                      onClick={() => remove(it.shadeId)}
                    >Remove</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="px-6 py-5 hairline-t">
            <div className="flex justify-between mb-4">
              <span className="text-muted">Subtotal</span>
              <span className="font-medium">{money(total)}</span>
            </div>
            <button className="btn-accent w-full mb-2" onClick={() => go("/checkout")}>
              Checkout via WhatsApp
            </button>
            <button className="btn-outline w-full" onClick={() => go("/cart")}>
              View Cart
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

export default CartDrawer;
