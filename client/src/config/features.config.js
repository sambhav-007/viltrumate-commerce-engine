// Generic, extensible feature-flag system (client mirror of server/config/features.js).
// Add a flag here + on the server and it is instantly toggleable; no other code
// must change. Runtime StoreSettings.features (Phase D, admin-editable) overrides
// these defaults per store.
export const DEFAULT_FEATURES = {
  reviews: true, // customer reviews on products/variants
  wishlist: false, // forward-declared (feature lands in a later phase)
  coupons: false, // forward-declared
  inventory: false, // forward-declared (stock tracking)
  cod: false, // Cash-on-Delivery checkout provider
  whatsappCheckout: true, // WhatsApp checkout provider
};

// Resolve a flag for the current store: runtime settings override defaults.
export const isFeatureEnabled = (flag, settings) => {
  const overrides = (settings && settings.features) || {};
  return flag in overrides
    ? overrides[flag] === true
    : DEFAULT_FEATURES[flag] === true;
};

export default DEFAULT_FEATURES;
