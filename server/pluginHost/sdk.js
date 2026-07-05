// The Plugin SDK — the ONLY surface a plugin may use. It deliberately does NOT
// expose raw mongoose, core models, or the core app object. This is how the
// platform stays extensible without letting plugins patch the core:
//
//  - registerRoute() mounts ONLY under /api/plugins/<id>/… (a plugin can never
//    override a core route or another plugin's route; duplicates are rejected).
//  - storage() returns a model bound to a plugin-namespaced collection
//    (plugin_<id>_<name>) — plugins cannot mutate core collections.
//  - register{Migration,FeatureFlag,AdminPage,SidebarItem,DashboardWidget,
//    NavigationItem,SettingsSchema}() only record declarations in the registry.
//  - log is the standard secret-redacting logger, scoped to the plugin.
//
// Every method throws on misuse; the loader wraps register() in try/catch so a
// misbehaving plugin fails safely without taking the platform down.
const mongoose = require("mongoose");
const { logInfo, logWarn, logError } = require("../config/logger");

const SUBPATH_OK = /^[a-z0-9/_:.-]+$/i;

function createSdk(manifest, { app, registry, mountRoutes = true } = {}) {
  const id = manifest.id;
  const base = `/api/plugins/${id}`;
  const component = `plugin:${id}`;

  const sdk = {
    id,
    manifest,
    // Per-store settings, injected by the loader from the plugin's stored state.
    _settings: {},
    getSettings() {
      return sdk._settings || {};
    },
    log: {
      info: (m, meta) => logInfo(component, m, meta),
      warn: (m, meta) => logWarn(component, m, meta),
      error: (err, meta) => logError(component, err, meta),
    },

    // Mount an Express handler under the plugin's namespace only.
    registerRoute(method, subpath, ...handlers) {
      const verb = String(method || "GET").toUpperCase();
      const clean = String(subpath == null ? "" : subpath).replace(/^\/+/, "");
      if (clean.includes("..") || (clean && !SUBPATH_OK.test(clean))) {
        throw new Error(`Illegal route subpath "${subpath}"`);
      }
      const full = `${base}${clean ? "/" + clean : ""}`;
      if (registry.routes.some((r) => r.method === verb && r.full === full)) {
        throw new Error(`Route already registered: ${verb} ${full}`);
      }
      registry.routes.push({ pluginId: id, method: verb, full, subpath: clean });
      if (mountRoutes && app) app[verb.toLowerCase()](full, ...handlers);
      return sdk;
    },

    // A mongoose model scoped to a plugin-owned collection. This is the ONLY
    // approved data interface — plugins never receive core models.
    storage(name) {
      const coll = `plugin_${id}_${String(name || "data").toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
      if (mongoose.models[coll]) return mongoose.model(coll);
      const schema = new mongoose.Schema({}, { strict: false, timestamps: true, collection: coll });
      return mongoose.model(coll, schema);
    },

    registerMigration(mig) {
      if (!mig || typeof mig.run !== "function") throw new Error("migration must have a run()");
      (registry.migrations[id] = registry.migrations[id] || []).push(mig);
      return sdk;
    },
    registerFeatureFlag(flag, def = false) {
      registry.featureFlags.push({ pluginId: id, flag, default: !!def });
      return sdk;
    },
    registerAdminPage(page) {
      registry.adminPages.push({ pluginId: id, ...page });
      return sdk;
    },
    registerSidebarItem(item) {
      registry.sidebarItems.push({ pluginId: id, ...item });
      return sdk;
    },
    registerDashboardWidget(widget) {
      registry.dashboardWidgets.push({ pluginId: id, ...widget });
      return sdk;
    },
    registerNavigationItem(nav) {
      registry.navigationItems.push({ pluginId: id, ...nav });
      return sdk;
    },
    registerSettingsSchema(schema) {
      registry.settings[id] = schema;
      return sdk;
    },
  };

  return sdk;
}

module.exports = { createSdk };
