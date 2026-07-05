// ============================================================================
// Store Templates (Phase Μ) — build a reusable config snapshot FROM a store, and
// apply a template's config INTO a (fresh) store. These functions run against
// the CURRENTLY-CONNECTED store database (the panel wraps calls in withStoreDb),
// so they require the store models directly — same pattern as seedCatalog /
// applyStoreSettings.
//
// A template captures ONLY reusable configuration. It never touches orders,
// customers, users, reviews, coupons, analytics, activity or admin passwords.
// ============================================================================
const StoreSettings = require("../models/storeSettings");
const Category = require("../models/categories");
const { baseSlug } = require("../config/slug");

// Which reusable sections a template can include.
const INCLUDE_KEYS = ["theme", "layout", "content", "stats", "features", "payment", "seo", "categories"];

// Read the current store's reusable config into a plain, secret-free object.
async function buildTemplateConfig(include = {}) {
  const doc = await StoreSettings.findOne({});
  const s = doc ? doc.toObject({ flattenMaps: true }) : {};
  const config = { variantLabel: s.variantLabel || "" };

  if (include.theme) config.theme = s.theme || {};
  if (include.layout) config.layout = s.layout || {};
  if (include.content) {
    config.content = s.content || [];
    config.heroHeading = s.heroHeading || "";
    config.heroSubheading = s.heroSubheading || "";
  }
  if (include.stats) config.stats = s.stats || [];
  if (include.features) config.features = s.features || {};
  if (include.payment) {
    // Payment config WITHOUT secrets (secrets live in the store env, never here).
    config.payment = {
      enabledProviders: (s.payment && s.payment.enabledProviders) || ["whatsapp"],
      defaultProvider: (s.payment && s.payment.defaultProvider) || "whatsapp",
    };
  }
  if (include.seo) config.seo = s.seo || {};
  if (include.categories) {
    const cats = await Category.find({}).sort({ order: 1 }).lean();
    config.categories = cats.map((c) => ({
      name: c.name,
      slug: c.slug,
      description: c.description || "",
      status: c.status || "Active",
      order: c.order || 0,
    }));
    config.navigation = config.categories.map((c) => c.name);
  }
  // Product attributes = the purchasable-unit vocabulary (no product data).
  config.productAttributes = { variantLabel: s.variantLabel || "" };
  return config;
}

// Apply a template's config into the current (fresh) store database.
async function applyTemplateConfig(config = {}, { categories = true } = {}) {
  let doc = await StoreSettings.findOne({});
  if (!doc) doc = new StoreSettings({});

  if (config.theme) doc.theme = config.theme;
  if (config.layout) doc.layout = config.layout;
  if (config.content !== undefined) doc.content = config.content;
  if (config.heroHeading !== undefined) doc.heroHeading = config.heroHeading;
  if (config.heroSubheading !== undefined) doc.heroSubheading = config.heroSubheading;
  if (config.stats !== undefined) doc.stats = config.stats;
  if (config.features) doc.features = config.features;
  if (config.payment) {
    doc.payment = {
      enabledProviders: config.payment.enabledProviders || ["whatsapp"],
      defaultProvider: config.payment.defaultProvider || "whatsapp",
    };
  }
  if (config.seo) doc.seo = config.seo;
  if (config.variantLabel) doc.variantLabel = config.variantLabel;
  await doc.save();

  let created = 0;
  if (categories && Array.isArray(config.categories)) {
    let order = 0;
    for (const c of config.categories) {
      const slug = c.slug || baseSlug(c.name);
      if (await Category.findOne({ slug })) continue;
      await Category.create({
        name: c.name,
        slug,
        description: c.description || "",
        status: c.status || "Active",
        order: c.order != null ? c.order : order++,
      });
      created++;
    }
  }
  return { categoriesCreated: created };
}

// Validate an imported template object before it is stored. Rejects structural
// problems AND any merchant-data leakage.
function validateImport(obj) {
  const errors = [];
  if (!obj || typeof obj !== "object") {
    return { ok: false, errors: ["template is not an object"] };
  }
  if (!obj.name || typeof obj.name !== "string") errors.push("missing or invalid name");
  if (!obj.config || typeof obj.config !== "object") errors.push("missing config object");
  const c = obj.config || {};
  if (c.categories && !Array.isArray(c.categories)) errors.push("config.categories must be an array");
  if (c.payment && c.payment.enabledProviders && !Array.isArray(c.payment.enabledProviders)) {
    errors.push("config.payment.enabledProviders must be an array");
  }
  // No merchant data may ride in on an import.
  for (const bad of ["orders", "customers", "users", "reviews", "analytics", "activity", "passwords", "products"]) {
    if (c[bad] !== undefined) errors.push(`config must not contain "${bad}"`);
  }
  return { ok: errors.length === 0, errors };
}

// A renderable, secret-free preview of a template (for the panel preview panel).
function previewOf(t) {
  const c = (t && t.config) || {};
  return {
    name: t.name,
    industry: t.industry || "",
    version: t.version,
    theme: {
      colors: (c.theme && c.theme.colors) || {},
      fonts: (c.theme && c.theme.fonts) || {},
      motion: (c.theme && c.theme.motion) || "full",
    },
    layout: (c.layout && c.layout.home) || "editorial",
    navigation: c.navigation || (c.categories || []).map((x) => x.name),
    features: c.features || {},
    hero: { heading: c.heroHeading || "", subheading: c.heroSubheading || "" },
    stats: c.stats || [],
    payment: c.payment || {},
  };
}

module.exports = { INCLUDE_KEYS, buildTemplateConfig, applyTemplateConfig, validateImport, previewOf };
