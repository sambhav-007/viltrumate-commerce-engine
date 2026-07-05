// Stripe provider — architecture stub. Conforms to the PaymentProvider
// contract so it can be enabled later without touching checkout logic.
// Implement checkout() (create Checkout Session, redirect) and flip isEnabled
// when configured.
const stripe = {
  id: "stripe",
  label: "Card (Stripe)",
  featureFlag: null,
  isEnabled: () => false, // not configured in VCE Alpha
  async checkout() {
    return { ok: false, error: "Stripe is not configured yet." };
  },
};

export default stripe;
