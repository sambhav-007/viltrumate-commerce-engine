// Default payment configuration. Phase C's payment registry consumes
// `enabledProviders` / `defaultProvider` (provider ids from src/payments).
// Phase D lets admins override these via StoreSettings.payment. Provider
// availability is also gated by feature flags (e.g. cod, whatsappCheckout).
export const PAYMENT_DEFAULTS = {
  enabledProviders: ["whatsapp"],
  defaultProvider: "whatsapp",
};

export default PAYMENT_DEFAULTS;
