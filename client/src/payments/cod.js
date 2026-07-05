import { isFeatureEnabled } from "../config/features.config";

// Cash on Delivery: the order is already persisted by the Checkout page before
// this runs, so the provider only needs to confirm.
const cod = {
  id: "cod",
  label: "Cash on Delivery",
  featureFlag: "cod",
  isEnabled: (settings) => isFeatureEnabled("cod", settings),
  async checkout() {
    return { ok: true, message: "Order placed. Pay on delivery." };
  },
};

export default cod;
