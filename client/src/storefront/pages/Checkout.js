import React, { useState, useEffect } from "react";
import { Link, useHistory } from "react-router-dom";
import Layout from "../Layout";
import { useCart } from "../../context/CartContext";
import { useSettings, useFeature } from "../../context/SettingsContext";
import { money } from "../format";
import { createOrder, validateCoupon } from "../../api/shop";
import { getEnabledProviders } from "../../payments";
import { buildOrderPayload } from "../../payments/PaymentProvider";

const Checkout = () => {
  const { items, total, clear } = useCart();
  const settings = useSettings();
  const history = useHistory();
  const [f, setF] = useState({ name: "", phone: "", address: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Coupon (feature-flagged). The server re-validates on order create.
  const couponsOn = useFeature("coupons");
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState(null); // { code, discount }
  const [couponErr, setCouponErr] = useState("");
  const payable = Math.max(0, total - (coupon ? coupon.discount : 0));

  const applyCoupon = async () => {
    setCouponErr("");
    const code = couponInput.trim();
    if (!code) return;
    const res = await validateCoupon(code, total);
    if (!res || res.error || !res.valid) {
      setCoupon(null);
      return setCouponErr((res && res.error) || "This coupon can't be applied");
    }
    setCoupon({ code: res.code, discount: res.discount });
  };

  // Available checkout methods for this store (feature-flag + config gated).
  const providers = getEnabledProviders(settings);
  const [method, setMethod] = useState(
    providers.length ? providers[0].id : ""
  );
  // Settings load async: when providers arrive (or change), make sure `method`
  // points at a real one (fixes direct-navigation to /checkout selecting "").
  const providerIds = providers.map((p) => p.id).join(",");
  useEffect(() => {
    if (providers.length && !providers.find((p) => p.id === method)) {
      setMethod(providers[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerIds]);

  const placeOrder = async (e) => {
    e.preventDefault();
    setErr("");
    if (!f.name.trim() || !f.phone.trim() || !f.address.trim())
      return setErr("Please fill in all fields.");
    const provider = providers.find((p) => p.id === method);
    if (!provider) return setErr("No checkout method is available.");

    setBusy(true);
    // 1) Persist the order first, so every method is recorded.
    const payload = buildOrderPayload(items, payable, f, provider.id, coupon);
    const res = await createOrder(payload);
    if (!res || res.error) {
      setBusy(false);
      return setErr((res && res.error) || "Could not place the order.");
    }
    // 2) Hand off to the selected provider.
    const out = await provider.checkout({
      items,
      total: payable,
      customer: f,
      settings,
      orderId: res.order && res.order._id,
    });
    setBusy(false);
    if (!out.ok) return setErr(out.error || "Checkout failed.");
    if (out.redirectUrl) window.open(out.redirectUrl, "_blank");
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

            {/* Payment method (only shown when the store offers a choice) */}
            {providers.length > 1 && (
              <div className="mb-6">
                <span className="text-sm text-muted">Payment Method</span>
                <div className="mt-2 space-y-2">
                  {providers.map((p) => (
                    <label key={p.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="method"
                        checked={method === p.id}
                        onChange={() => setMethod(p.id)}
                      />
                      <span className="text-sm">{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {err && <p className="text-sm text-red-600 mb-4">{err}</p>}
            {providers.length === 0 ? (
              <p className="text-sm text-red-600">
                This store has no checkout method configured.
              </p>
            ) : (
              <button className="btn-accent w-full" disabled={busy}>
                {busy ? "Placing…" : "Place Order"}
              </button>
            )}
            <p className="text-xs text-muted mt-3 text-center">
              No online payment. Your order is confirmed by the store.
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

          {couponsOn && (
            <div className="mt-5">
              {coupon ? (
                <div className="flex justify-between items-center text-sm">
                  <span>
                    Coupon <b>{coupon.code}</b>{" "}
                    <button
                      type="button"
                      className="text-muted underline ml-1"
                      onClick={() => {
                        setCoupon(null);
                        setCouponInput("");
                      }}
                    >
                      remove
                    </button>
                  </span>
                  <span>−{money(coupon.discount)}</span>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    className="lux-input"
                    style={{ padding: "0.55rem 0.9rem" }}
                    placeholder="Coupon code"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                  />
                  <button type="button" className="btn-outline" style={{ padding: "0.55rem 1.2rem" }} onClick={applyCoupon}>
                    Apply
                  </button>
                </div>
              )}
              {couponErr && <p className="text-xs text-red-600 mt-2">{couponErr}</p>}
            </div>
          )}

          <div className="flex justify-between mt-4 font-medium">
            <span>Total</span>
            <span>{money(payable)}</span>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Checkout;
