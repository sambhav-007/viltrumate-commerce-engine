/*
 * Announcements — the reference VCE plugin. Intentionally small: it exists to
 * demonstrate every SDK surface.
 *
 * Data lives ONLY in the plugin's namespaced collection via sdk.storage()
 * (plugin_announcements_items) — the plugin never touches core collections.
 * Routes mount ONLY under /api/plugins/announcements/… via sdk.registerRoute().
 */
module.exports.register = function register(sdk) {
  const Items = sdk.storage("items");

  // Declare extension points (surfaced by the panel).
  sdk.registerFeatureFlag("announcementBar", true);
  sdk.registerSettingsSchema(sdk.manifest.settings && sdk.manifest.settings.schema);
  sdk.registerAdminPage({ id: "announcements", title: "Announcements", path: "/admin/plugins/announcements" });
  sdk.registerSidebarItem({ label: "Announcements", target: "announcements" });
  sdk.registerDashboardWidget({ id: "announcements-count", title: "Active announcements" });

  // Register the plugin's migration (also discovered from migrations/, but this
  // demonstrates the programmatic API).
  sdk.registerMigration(require("../migrations/1.0.0-init.js"));

  const json = (res, code, body) => res.status(code).json(body);

  // Public: active announcements for the storefront bar (+ style from settings).
  sdk.registerRoute("GET", "active", async (req, res) => {
    try {
      const items = await Items.find({ active: true }).sort({ order: 1, createdAt: -1 }).lean();
      const s = sdk.getSettings();
      json(res, 200, { announcements: items, style: { barColor: s.barColor || "#111827", textColor: s.textColor || "#ffffff", dismissible: s.dismissible !== false } });
    } catch (e) { sdk.log.error(e); json(res, 500, { error: "failed to load announcements" }); }
  });

  // Admin CRUD.
  sdk.registerRoute("GET", "items", async (req, res) => {
    const items = await Items.find({}).sort({ order: 1, createdAt: -1 }).lean();
    json(res, 200, { items });
  });

  sdk.registerRoute("POST", "items", async (req, res) => {
    const { message, link = "", active = true, order = 0 } = req.body || {};
    if (!message || typeof message !== "string") return json(res, 400, { error: "message is required" });
    const doc = await Items.create({ message, link, active: !!active, order: Number(order) || 0 });
    sdk.log.info("announcement created");
    json(res, 200, { success: "created", item: doc });
  });

  sdk.registerRoute("PUT", "items/:id", async (req, res) => {
    const patch = {};
    ["message", "link", "active", "order"].forEach((k) => { if (req.body && req.body[k] !== undefined) patch[k] = req.body[k]; });
    const doc = await Items.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true });
    if (!doc) return json(res, 404, { error: "not found" });
    json(res, 200, { success: "updated", item: doc });
  });

  sdk.registerRoute("DELETE", "items/:id", async (req, res) => {
    const doc = await Items.findByIdAndDelete(req.params.id);
    if (!doc) return json(res, 404, { error: "not found" });
    json(res, 200, { success: "deleted" });
  });
};
