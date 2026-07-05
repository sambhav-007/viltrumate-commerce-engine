// Plugin manifest validation (Phase Ξ). A manifest must declare enough for the
// host to load the plugin safely and for the panel to surface it. Validation is
// strict: a bad manifest is reported and the plugin is skipped (never crashes
// the platform).
const SLUG = /^[a-z0-9-]+$/;
const SEMVER = /^\d+\.\d+\.\d+$/;
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const ARRAY_KEYS = ["permissions", "dependencies", "routes", "adminPages", "sidebarItems", "dashboardWidgets", "navigationItems", "featureFlags"];

function validateManifest(m) {
  const e = [];
  if (!m || typeof m !== "object" || Array.isArray(m)) return { ok: false, errors: ["manifest is not an object"] };

  if (!m.id || !SLUG.test(m.id)) e.push("id must be a lowercase slug (a-z, 0-9, dashes)");
  if (!m.name || typeof m.name !== "string") e.push("name is required");
  if (!m.version || !SEMVER.test(m.version)) e.push("version must be semver x.y.z");
  if (!m.description || typeof m.description !== "string") e.push("description is required");
  if (!m.author || typeof m.author !== "string") e.push("author is required");

  for (const k of ARRAY_KEYS) {
    if (m[k] !== undefined && !Array.isArray(m[k])) e.push(`${k} must be an array`);
  }

  (Array.isArray(m.routes) ? m.routes : []).forEach((r, i) => {
    if (!r || typeof r !== "object") return e.push(`routes[${i}] must be an object`);
    if (r.method && !METHODS.includes(String(r.method).toUpperCase())) e.push(`routes[${i}].method invalid`);
    if (typeof r.path !== "string" || r.path.startsWith("/") || r.path.includes("..")) {
      e.push(`routes[${i}].path must be a relative subpath (no leading "/" or "..")`);
    }
  });

  (Array.isArray(m.featureFlags) ? m.featureFlags : []).forEach((f, i) => {
    if (!f || typeof f !== "object" || !f.flag) e.push(`featureFlags[${i}] must be { flag, default? }`);
  });

  if (m.settings !== undefined) {
    if (typeof m.settings !== "object") e.push("settings must be an object");
    else if (m.settings.schema !== undefined && !Array.isArray(m.settings.schema)) e.push("settings.schema must be an array");
  }

  return { ok: e.length === 0, errors: e };
}

module.exports = { validateManifest, SLUG, SEMVER, METHODS };
