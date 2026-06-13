import React from "react";
import { Link, useHistory } from "react-router-dom";
import Layout from "../Layout";
import { useCart } from "../../context/CartContext";
import { money } from "../format";

const Cart = () => {
  const { items, setQty, remove, total } = useCart();
  const history = useHistory();

  return (
    <Layout>
      <div className="aura-container py-16 md:py-24">
        <div className="text-center mb-14">
          <div className="eyebrow mb-3">Bag</div>
          <h1 className="display-1">Your Cart</h1>
        </div>
        {items.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted mb-6">Your cart is empty.</p>
            <Link to="/category" className="btn-accent">Browse Collections</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2">
              {items.map((it) => (
                <div key={it.shadeId} className="flex gap-4 py-5 hairline-b">
                  <div
                    className="w-20 h-20 bg-sand rounded"
                    style={{
                      background: it.image ? `url(${it.image}) center/cover` : undefined,
                    }}
                  />
                  <div className="flex-1">
                    <div className="font-display text-lg">{it.productName}</div>
                    <div className="text-sm text-muted">{it.shadeName}</div>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center border border-hairline rounded">
                        <button className="px-2" onClick={() => setQty(it.shadeId, it.qty - 1)}>−</button>
                        <span className="px-3 text-sm">{it.qty}</span>
                        <button className="px-2" onClick={() => setQty(it.shadeId, it.qty + 1)}>+</button>
                      </div>
                      <button className="text-xs text-muted underline" onClick={() => remove(it.shadeId)}>
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="text-right">{money(it.price * it.qty)}</div>
                </div>
              ))}
            </div>

            <div className="lux-card p-8 rounded h-fit">
              <h2 className="font-display text-2xl mb-5">Summary</h2>
              <div className="flex justify-between mb-2 text-sm">
                <span className="text-muted">Subtotal</span>
                <span>{money(total)}</span>
              </div>
              <p className="text-xs text-muted mb-5">
                Final amount confirmed on WhatsApp. No online payment.
              </p>
              <button className="btn-accent w-full" onClick={() => history.push("/checkout")}>
                Proceed to Checkout
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Cart;
