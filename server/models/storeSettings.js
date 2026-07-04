const mongoose = require("mongoose");
const { imageSchema } = require("./_image");

// Theme. `colors` and `tokens` are Maps so any CSS variable can be themed
// without a schema change (keys mirror styles/aura.css :root, sans the --
// prefix: colors e.g. accent/ink/cream; tokens e.g. radius-btn/track-luxe/
// section-y). `fonts` + `motion` complete the store's visual personality
// (3B): fonts are applied by FontLoader (googleFamilies are css2 family
// specs), motion "reduced" zeroes animation durations via useMotion.
const fontsSchema = new mongoose.Schema(
  {
    body: { type: String, default: "" }, // CSS font-family stack
    display: { type: String, default: "" },
    googleFamilies: { type: [String], default: [] }, // e.g. "Sora:wght@400;600"
  },
  { _id: false }
);

const themeSchema = new mongoose.Schema(
  {
    colors: { type: Map, of: String, default: {} },
    tokens: { type: Map, of: String, default: {} },
    fonts: { type: fontsSchema, default: () => ({}) },
    motion: { type: String, enum: ["full", "reduced"], default: "full" },
    logoUrl: { type: String, default: "" },
  },
  { _id: false }
);

// Payment configuration consumed by the client payment registry.
const paymentSchema = new mongoose.Schema(
  {
    enabledProviders: { type: [String], default: ["whatsapp"] },
    defaultProvider: { type: String, default: "whatsapp" },
  },
  { _id: false }
);

// Per-store SEO. Applied at runtime by SeoHead (CRA index.html is static).
const seoSchema = new mongoose.Schema(
  {
    metaTitle: { type: String, default: "" },
    metaDescription: { type: String, default: "" },
    ogImage: { type: String, default: "" },
  },
  { _id: false }
);

// Feature flags (mirror config/features.js defaults). Toggleable per store.
const featuresSchema = new mongoose.Schema(
  {
    reviews: { type: Boolean, default: true },
    wishlist: { type: Boolean, default: false },
    coupons: { type: Boolean, default: false },
    inventory: { type: Boolean, default: false },
    cod: { type: Boolean, default: false },
    whatsappCheckout: { type: Boolean, default: true },
  },
  { _id: false }
);

// Storefront copy override: one slot key -> string. Stored as an array of pairs
// (not a Map/object) because slot keys contain dots (e.g. "home.hero.eyebrow")
// and MongoDB forbids dots in field names. The client normalizes this back to a
// lookup object.
const contentEntrySchema = new mongoose.Schema(
  { k: { type: String }, v: { type: String, default: "" } },
  { _id: false }
);

// Singleton document holding all global, admin-editable store configuration:
// identity, theme, payment, SEO and feature flags. Nothing here is hardcoded.
const storeSettingsSchema = new mongoose.Schema(
  {
    // Identity
    storeName: { type: String, default: "" },
    whatsappNumber: { type: String, default: "" }, // digits incl. country code
    address: { type: String, default: "" },
    aboutUs: { type: String, default: "" },
    contactEmail: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    instagramUrl: { type: String, default: "" },
    facebookUrl: { type: String, default: "" },
    heroHeading: { type: String, default: "" },
    heroSubheading: { type: String, default: "" },
    heroImage: { type: imageSchema, default: null },
    // Display label for the purchasable unit ("" -> client VARIANT_LABEL default)
    variantLabel: { type: String, default: "" },
    // Nested configuration
    theme: { type: themeSchema, default: () => ({}) },
    payment: { type: paymentSchema, default: () => ({}) },
    seo: { type: seoSchema, default: () => ({}) },
    features: { type: featuresSchema, default: () => ({}) },
    // Per-store storefront copy overrides ([{k,v}] pairs). Empty falls back to
    // the generic defaults in client/src/config/content.js.
    content: { type: [contentEntrySchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("storeSettings", storeSettingsSchema);
