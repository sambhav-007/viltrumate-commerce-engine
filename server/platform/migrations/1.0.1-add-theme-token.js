// 1.0.1 — ensure StoreSettings.theme.tokens exists (3B design tokens).
// Backfills stores provisioned before the theme token map was introduced. On
// current stores the field already exists, so run() is a no-op.
module.exports = {
  version: "1.0.1",
  description: "Ensure theme.tokens (design-token map) exists on StoreSettings",

  async run({ StoreSettings }) {
    let doc = await StoreSettings.findOne({});
    if (!doc) doc = new StoreSettings({});
    if (!doc.theme) doc.theme = {};
    if (doc.theme.tokens == null) {
      doc.theme.tokens = {};
      doc.markModified("theme");
    }
    await doc.save();
    return { ok: true };
  },

  async verification({ StoreSettings }) {
    const doc = await StoreSettings.findOne({});
    return !!(doc && doc.theme && doc.theme.tokens !== undefined);
  },

  async rollback() {
    throw new Error("rollback not implemented (Phase Λ tracks metadata only)");
  },
};
