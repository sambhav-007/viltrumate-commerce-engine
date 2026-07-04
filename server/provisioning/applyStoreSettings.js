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

  // Branding (colors = palette; tokens/fonts/motion = 3B personality)
  const t = b.theme || {};
  doc.theme = {
    colors: t.colors || {},
    tokens: t.tokens || {},
    fonts: {
      body: (t.fonts && t.fonts.body) || "",
      display: (t.fonts && t.fonts.display) || "",
      googleFamilies: (t.fonts && t.fonts.googleFamilies) || [],
    },
    motion: t.motion === "reduced" ? "reduced" : "full",
    logoUrl: b.logoUrl || "",
  };
  doc.layout = { home: (b.layout && b.layout.home) || "editorial" };
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

  // Storefront copy overrides. Manifest supplies an object {key: string};
  // stored as [{k,v}] pairs (dots aren't allowed in DB field names). Merge so a
  // re-brand can update individual slots without wiping the rest.
  const content = manifest.store && manifest.store.content;
  if (content && Object.keys(content).length) {
    const merged = {};
    (doc.content || []).forEach((e) => {
      if (e && e.k) merged[e.k] = e.v;
    });
    Object.assign(merged, content);
    doc.content = Object.entries(merged).map(([k, v]) => ({ k, v }));
  }

  await doc.save();
  return doc;
}

module.exports = { applyStoreSettings };
