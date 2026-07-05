// The plugin registry accumulates everything plugins register during load. It is
// the single read-model the host (routes), the panel (admin pages / sidebar /
// widgets / settings) and the update manager (migrations) consult. Nothing here
// touches core state directly.
function createRegistry() {
  return {
    plugins: {}, // pluginId -> manifest
    routes: [], // { pluginId, method, full, subpath }
    migrations: {}, // pluginId -> [migration]
    featureFlags: [], // { pluginId, flag, default }
    adminPages: [], // { pluginId, ... }
    sidebarItems: [],
    dashboardWidgets: [],
    navigationItems: [],
    settings: {}, // pluginId -> settings schema
  };
}

module.exports = { createRegistry };
