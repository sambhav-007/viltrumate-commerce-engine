// Generic, extensible feature-flag engine.
//
// Defaults live here. Runtime overrides (admin-editable StoreSettings.features)
// are injected via setFeatureOverrides() once the settings singleton is loaded
// or updated (wired in Phase D). Adding a flag is a one-line change here + on
// the client mirror (client/src/config/features.config.js).
const DEFAULT_FEATURES = {
  reviews: true,
  wishlist: false,
  coupons: false,
  inventory: false,
  cod: false,
  whatsappCheckout: true,
};

let overrides = {};

const getFeatures = () => ({ ...DEFAULT_FEATURES, ...overrides });

const isFeatureEnabled = (flag) => getFeatures()[flag] === true;

// Replace the active override set (e.g. after loading/updating StoreSettings).
const setFeatureOverrides = (next) => {
  overrides = next && typeof next === "object" ? next : {};
};

// Express guard: 403s when a feature is disabled. Mount on feature-gated routes.
const requireFeature = (flag) => (req, res, next) =>
  isFeatureEnabled(flag)
    ? next()
    : res.status(403).json({ error: `Feature "${flag}" is disabled` });

module.exports = {
  DEFAULT_FEATURES,
  getFeatures,
  isFeatureEnabled,
  setFeatureOverrides,
  requireFeature,
};
