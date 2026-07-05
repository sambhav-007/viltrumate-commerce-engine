const fs = require("fs");
const path = require("path");
const { validateManifest } = require("./validate");
const { createRegistry } = require("./registry");
const { createSdk } = require("./sdk");
const { logError } = require("../config/logger");

// Plugin packages live at the repo root /plugins.
const PLUGINS_DIR = path.join(__dirname, "..", "..", "plugins");

// Discover plugins on disk: parse + validate each manifest. Never throws.
function discover(dir = PLUGINS_DIR) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const pdir = path.join(dir, name);
    let stat;
    try { stat = fs.statSync(pdir); } catch (e) { continue; }
    if (!stat.isDirectory()) continue;
    const mfile = path.join(pdir, "manifest.json");
    if (!fs.existsSync(mfile)) {
      out.push({ id: name, dir: pdir, valid: false, errors: ["manifest.json missing"] });
      continue;
    }
    try {
      const manifest = JSON.parse(fs.readFileSync(mfile, "utf8"));
      const v = validateManifest(manifest);
      out.push({ id: manifest.id || name, dir: pdir, manifest, valid: v.ok, errors: v.errors });
    } catch (e) {
      out.push({ id: name, dir: pdir, valid: false, errors: ["invalid manifest.json: " + e.message] });
    }
  }
  return out;
}

// Load ENABLED, VALID plugins into an Express app. Each plugin is isolated:
// a failure is reported and skipped — it never aborts the load or the platform.
function load({ app, dir = PLUGINS_DIR, isEnabled = () => false, getSettings = () => ({}), registry = createRegistry(), mountRoutes = true, discovered } = {}) {
  const found = discovered || discover(dir);
  const report = { loaded: [], disabled: [], invalid: [], failed: [] };

  for (const d of found) {
    if (!d.valid) { report.invalid.push({ id: d.id, errors: d.errors }); continue; }
    registry.plugins[d.id] = d.manifest;
    if (!isEnabled(d.id)) { report.disabled.push(d.id); continue; }
    try {
      let mod = d.module;
      if (!mod) mod = require(d.entry || path.join(d.dir, "server", "index.js"));
      if (!mod || typeof mod.register !== "function") throw new Error("plugin must export register(sdk)");
      const sdk = createSdk(d.manifest, { app, registry, mountRoutes });
      sdk._settings = getSettings(d.id) || {};
      mod.register(sdk);
      report.loaded.push(d.id);
    } catch (err) {
      logError("pluginHost", err, {});
      report.failed.push({ id: d.id, error: err.message });
    }
  }
  return { registry, report };
}

// A plugin's migrations, from its migrations/ directory (sorted by filename).
function pluginMigrations(d) {
  const out = [];
  const mdir = path.join(d.dir, "migrations");
  if (!fs.existsSync(mdir)) return out;
  for (const f of fs.readdirSync(mdir).filter((f) => /\.js$/.test(f)).sort()) {
    try { out.push({ ...require(path.join(mdir, f)), file: f }); } catch (e) { /* skip broken */ }
  }
  return out;
}

module.exports = { discover, load, pluginMigrations, PLUGINS_DIR, createRegistry, createSdk };
