const mongoose = require("mongoose");
const { imageSchema } = require("./_image");

// Theme tokens. `colors` is a Map so any CSS variable can be themed without a
// schema change (keys mirror styles/aura.css :root, e.g. accent, ink, cream).
const themeSchema = new mongoose.Schema(
  {
    colors: { type: Map, of: String, default: {} },
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
  },
  { timestamps: true }
);

module.exports = mongoose.model("storeSettings", storeSettingsSchema);
