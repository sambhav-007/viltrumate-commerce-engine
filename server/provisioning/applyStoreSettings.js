const StoreSettings = require("../models/storeSettings");

// Map a normalized manifest onto the StoreSettings singleton (the runtime config
// the storefront + admin read). Idempotent: upserts the single document and
// overwrites the managed fields. Reused at provision time AND for later
// re-branding — re-running with an updated manifest converges the store.
async function applyStoreSettings(manifest) {
  const id = (manifest.store && manifest.store.identity) || {};
  const b = (manifest.store && manifest.store.branding) || {};
  const c = (manifest.store && manifest.store.commerce) || {};

  let doc = await StoreSettings.findOne({});
  if (!doc) doc = new StoreSettings({});

  // Identity
  doc.storeName = id.storeName || "";
  doc.whatsappNumber = (id.whatsappNumber || "").replace(/\D/g, "");
  doc.address = id.address || "";
  doc.aboutUs = id.aboutUs || "";
  doc.contactEmail = id.contactEmail || "";
  doc.contactPhone = id.contactPhone || "";
  doc.instagramUrl = id.instagramUrl || "";
  doc.facebookUrl = id.facebookUrl || "";
  doc.heroHeading = id.heroHeading || "";
  doc.heroSubheading = id.heroSubheading || "";
  doc.variantLabel = id.variantLabel || "";

  // Branding
  doc.theme = { colors: (b.theme && b.theme.colors) || {}, logoUrl: b.logoUrl || "" };
  doc.seo = {
    metaTitle: (b.seo && b.seo.metaTitle) || "",
    metaDescription: (b.seo && b.seo.metaDescription) || "",
    ogImage: (b.seo && b.seo.ogImage) || "",
  };

  // Commerce
  doc.payment = {
    enabledProviders: (c.payment && c.payment.enabledProviders) || ["whatsapp"],
    defaultProvider: (c.payment && c.payment.defaultProvider) || "whatsapp",
  };
  if (c.features) {
    const current =
      doc.features && typeof doc.features.toObject === "function"
        ? doc.features.toObject()
        : {};
    doc.features = { ...current, ...c.features }; // unspecified flags keep schema defaults
  }

  // Storefront copy overrides (slot key -> string). Merge so a re-brand can
  // update individual slots without wiping the rest.
  const content = manifest.store && manifest.store.content;
  if (content && Object.keys(content).length) {
    const current =
      doc.content && typeof doc.content.toObject === "function"
        ? doc.content.toObject()
        : doc.content || {};
    doc.content = { ...current, ...content };
  }

  await doc.save();
  return doc;
}

module.exports = { applyStoreSettings };
