// 1.2.0 — ensure the coupons feature flag exists on StoreSettings.features.
// Backfills stores provisioned before coupons (Ζ). Defaults OFF (opt-in). No-op
// where already present.
module.exports = {
  version: "1.2.0",
  description: "Ensure features.coupons flag exists (default off)",

  async run({ StoreSettings }) {
    let doc = await StoreSettings.findOne({});
    if (!doc) doc = new StoreSettings({});
    if (!doc.features) doc.features = {};
    if (doc.features.coupons == null) {
      doc.features.coupons = false;
      doc.markModified("features");
    }
    await doc.save();
    return { ok: true };
  },

  async verification({ StoreSettings }) {
    const doc = await StoreSettings.findOne({});
    return !!(doc && doc.features && typeof doc.features.coupons === "boolean");
  },

  async rollback() {
    throw new Error("rollback not implemented (Phase Λ tracks metadata only)");
  },
};
