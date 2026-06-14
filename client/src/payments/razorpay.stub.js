// Razorpay provider — architecture stub. Conforms to the PaymentProvider
// contract so it can be enabled later without touching checkout logic.
// Implement checkout() (create order on server, open Razorpay, verify signature)
// and flip isEnabled when configured.
const razorpay = {
  id: "razorpay",
  label: "Razorpay",
  featureFlag: null,
  isEnabled: () => false, // not configured in VCE Alpha
  async checkout() {
    return { ok: false, error: "Razorpay is not configured yet." };
  },
};

export default razorpay;
