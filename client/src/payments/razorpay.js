import { createRazorpayOrder, verifyRazorpayPayment } from "../api/shop";

// Load the Razorpay Checkout SDK once.
function loadSdk() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

// Razorpay provider. The VCE order is already created (pending) by the Checkout
// page; here we create the gateway order, open Checkout, and verify on success —
// the server flips the order to "confirmed". Conforms to the PaymentProvider
// contract, so checkout logic is unchanged.
const razorpay = {
  id: "razorpay",
  label: "Card / UPI / Netbanking (Razorpay)",
  featureFlag: null,
  // Gated by the store's enabled providers; server holds the keys.
  isEnabled: (settings) =>
    ((settings.payment && settings.payment.enabledProviders) || []).includes("razorpay"),

  async checkout({ customer, settings, orderId }) {
    const ready = await loadSdk();
    if (!ready) return { ok: false, error: "Could not load Razorpay. Check your connection." };

    const created = await createRazorpayOrder(orderId);
    if (!created || created.error)
      return { ok: false, error: (created && created.error) || "Could not start payment." };

    return new Promise((resolve) => {
      const rzp = new window.Razorpay({
        key: created.keyId,
        order_id: created.razorpayOrderId,
        amount: created.amount,
        currency: created.currency,
        name: settings.storeName || "Store",
        description: "Order payment",
        prefill: { name: customer.name, contact: customer.phone },
        theme: { color: "#000000" },
        handler: async (resp) => {
          const v = await verifyRazorpayPayment({
            orderId,
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
          });
          if (v && !v.error) resolve({ ok: true, message: "Payment successful" });
          else resolve({ ok: false, error: (v && v.error) || "Payment verification failed." });
        },
        modal: { ondismiss: () => resolve({ ok: false, error: "Payment cancelled." }) },
      });
      rzp.on("payment.failed", () =>
        resolve({ ok: false, error: "Payment failed. Please try again." })
      );
      rzp.open();
    });
  },
};

export default razorpay;
