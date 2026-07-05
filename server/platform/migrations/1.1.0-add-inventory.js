// 1.1.0 — ensure the inventory feature flag exists on StoreSettings.features.
// Backfills stores provisioned before merchant inventory (Ζ). Defaults the flag
// OFF (opt-in), matching config/features.js. No-op where already present.
module.exports = {
  version: "1.1.0",
  description: "Ensure features.inventory flag exists (default off)",

  async run({ StoreSettings }) {
    let doc = await StoreSettings.findOne({});
    if (!doc) doc = new StoreSettings({});
    if (!doc.features) doc.features = {};
    if (doc.features.inventory == null) {
      doc.features.inventory = false;
      doc.markModified("features");
    }
    await doc.save();
    return { ok: true };
  },

  async verification({ StoreSettings }) {
    const doc = await StoreSettings.findOne({});
    return !!(doc && doc.features && typeof doc.features.inventory === "boolean");
  },

  async rollback() {
    throw new Error("rollback not implemented (Phase Λ tracks metadata only)");
  },
};
