// Announcements 1.0.0 — initialize the plugin's storage. Ensures an index on the
// active flag for the storefront query. Idempotent: safe to re-run. Runs against
// the target store's database (ctx.storage is namespaced to this plugin).
module.exports = {
  version: "1.0.0",
  description: "Create the announcements collection index",

  async run(ctx) {
    const Items = ctx.storage("items");
    await Items.collection.createIndex({ active: 1, order: 1 });
    return { ok: true };
  },

  async verification(ctx) {
    const Items = ctx.storage("items");
    // The collection exists and is queryable.
    await Items.countDocuments({});
    return true;
  },

  async rollback() {
    throw new Error("rollback not implemented (plugin data is never auto-deleted)");
  },
};
