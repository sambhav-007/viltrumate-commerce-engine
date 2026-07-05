const fs = require("fs");
const path = require("path");

// ============================================================================
// Migration framework (Phase Λ). The set of migration files defines the VCE
// platform version: the highest migration version IS the current VCE version.
// Each migration is one file `<version>-<slug>.js` exporting:
//   { version, description, run(ctx), verification(ctx), rollback(ctx) }
// ctx = { StoreSettings, mongoose, connection, store, log } — run against the
// TARGET store's own database (the panel opens it via withStoreDb).
//
// RULE: never edit a shipped migration; always add a new one. Migrations are
// idempotent backfills — safe to re-run, and no-ops on stores already current.
// rollback() is a placeholder; rollback is intentionally not implemented (the
// platform stores enough metadata to add it later).
// ============================================================================

const DIR = __dirname;
const FILE_RE = /^(\d+\.\d+\.\d+)-.*\.js$/;

// Compare two semvers: <0, 0, >0.
function cmp(a, b) {
  const pa = String(a || "0.0.0").split(".").map(Number);
  const pb = String(b || "0.0.0").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

// All migrations, ascending by version.
function list() {
  return fs
    .readdirSync(DIR)
    .filter((f) => FILE_RE.test(f))
    .map((f) => {
      const mod = require(path.join(DIR, f));
      return { ...mod, version: mod.version || f.match(FILE_RE)[1], file: f };
    })
    .sort((a, b) => cmp(a.version, b.version));
}

function latestVersion() {
  const l = list();
  return l.length ? l[l.length - 1].version : "1.0.0";
}

// Migrations a store on `current` still needs (version strictly greater).
function pendingFor(current) {
  const base = current && /^\d+\.\d+\.\d+$/.test(current) ? current : "0.0.0";
  return list().filter((m) => cmp(m.version, base) > 0);
}

// The current VCE platform version = the newest migration.
const CURRENT_VCE_VERSION = latestVersion();

module.exports = { list, latestVersion, pendingFor, cmp, CURRENT_VCE_VERSION };
