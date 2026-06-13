import React, { useState } from "react";
import { Link, useHistory } from "react-router-dom";
import Layout from "../Layout";
import { useCart } from "../../context/CartContext";
import { useSettings } from "../../context/SettingsContext";
import { money } from "../format";

const Checkout = () => {
  const { items, total, clear } = useCart();
  const settings = useSettings();
  const history = useHistory();
  const [f, setF] = useState({ name: "", phone: "", address: "" });
  const [err, setErr] = useState("");

  const buildMessage = () => {
    const store = settings.storeName || "Aura Rare";
    let m = `🛍️ *New Order — ${store}*\n`;
    m += `━━━━━━━━━━━━━━━\n\n`;
    m += `*Customer:* ${f.name}\n`;
    m += `*Phone:* ${f.phone}\n`;
    m += `*Address:* ${f.address}\n\n`;
    m += `*Order Details:*\n\n`;
    items.forEach((it, i) => {
      m += `${i + 1}. *${it.productName}*\n`;
      m += `    Shade: ${it.shadeName}\n`;
      m += `    Qty: ${it.qty} × ${money(it.price)} = ${money(it.price * it.qty)}\n\n`;
    });
    m += `━━━━━━━━━━━━━━━\n`;
    m += `*Total: ${money(total)}*`;
    return m;
  };

  const placeOrder = (e) => {
    e.preventDefault();
    if (!f.name.trim() || !f.phone.trim() || !f.address.trim())
      return setErr("Please fill in all fields.");
    const number = (settings.whatsappNumber || "").replace(/\D/g, "");
    if (!number) return setErr("Store WhatsApp number is not configured.");
    const url = `https://wa.me/${number}?text=${encodeURIComponent(buildMessage())}`;
    window.open(url, "_blank");
    clear();
    history.push("/thank-you");
  };

  if (items.length === 0)
    return (
      <Layout>
        <div className="aura-container py-24 text-center">
          <p className="text-muted mb-6">Your cart is empty.</p>
          <Link to="/category" className="btn-accent">Browse Collections</Link>
        </div>
      </Layout>
    );

  return (
    <Layout>
      <div className="aura-container py-16 grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div>
          <div className="eyebrow mb-3">Almost There</div>
          <h1 className="display-1 mb-10">Checkout</h1>
          <form onSubmit={placeOrder}>
            <label className="block mb-4">
              <span className="text-sm text-muted">Name</span>
              <input
                className="lux-input mt-1"
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
            </label>
            <label className="block mb-4">
              <span className="text-sm text-muted">Phone</span>
              <input
                className="lux-input mt-1"
                value={f.phone}
                onChange={(e) => setF({ ...f, phone: e.target.value })}
              />
            </label>
            <label className="block mb-6">
              <span className="text-sm text-muted">Address</span>
              <textarea
                rows="3"
                className="lux-input mt-1"
                value={f.address}
                onChange={(e) => setF({ ...f, address: e.target.value })}
              />
            </label>
            {err && <p className="text-sm text-red-600 mb-4">{err}</p>}
            <button className="btn-accent w-full">Place Order via WhatsApp</button>
            <p className="text-xs text-muted mt-3 text-center">
              You'll be redirected to WhatsApp to confirm your order. No online payment.
            </p>
          </form>
        </div>

        <div className="lux-card p-8 rounded h-fit">
          <h2 className="font-display text-2xl mb-5">Order Summary</h2>
          {items.map((it) => (
            <div key={it.shadeId} className="flex justify-between text-sm py-2 hairline-b">
              <span>
                {it.productName} — {it.shadeName} × {it.qty}
              </span>
              <span>{money(it.price * it.qty)}</span>
            </div>
          ))}
          <div className="flex justify-between mt-4 font-medium">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Checkout;
