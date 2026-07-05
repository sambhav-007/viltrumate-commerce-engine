// Build-time store identity defaults. CRA inlines REACT_APP_* at build time.
// These are only fallbacks: the runtime StoreSettings document (fetched from the
// API) overrides identity fields wherever it provides a value. Changing a
// store's identity must never require editing business logic — only env/config.
const env = process.env;

export const STORE_NAME = env.REACT_APP_STORE_NAME || "Store";
export const CURRENCY_SYMBOL = env.REACT_APP_CURRENCY_SYMBOL || "₹";
export const LOCALE = env.REACT_APP_LOCALE || "en-IN";
// Display label for the purchasable unit (the "Variant"). A cosmetics store
// sets this to "Shade", fashion to "Size", electronics to "Model", etc.
// Runtime StoreSettings.variantLabel overrides this default (Phase D).
export const VARIANT_LABEL = env.REACT_APP_VARIANT_LABEL || "Variant";

const storeConfig = {
  name: STORE_NAME,
  currencySymbol: CURRENCY_SYMBOL,
  locale: LOCALE,
  variantLabel: VARIANT_LABEL,
};

export default storeConfig;
