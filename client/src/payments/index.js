import whatsapp from "./whatsapp";
import cod from "./cod";
import razorpay from "./razorpay";
import stripe from "./stripe.stub";
import { PAYMENT_DEFAULTS } from "../config/payment.config";

// Provider registry. Add a provider here + a feature flag and checkout can use
// it with no further changes.
const ALL = { whatsapp, cod, razorpay, stripe };

// Resolve which providers a store can use right now: configured order
// (settings.payment.enabledProviders, else defaults) ∩ each provider's
// isEnabled(settings) gate (feature flags + configuration).
export const getEnabledProviders = (settings = {}) => {
  const ids =
    (settings.payment && settings.payment.enabledProviders) ||
    PAYMENT_DEFAULTS.enabledProviders;
  return ids
    .map((id) => ALL[id])
    .filter((p) => p && p.isEnabled(settings));
};

export const getProvider = (id) => ALL[id];

export default ALL;
