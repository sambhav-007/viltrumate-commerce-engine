// ============================================================================
// Platform Database access — the single source of truth for agency metadata.
//
// Connects to PLATFORM_DATABASE (the `vce_platform` db) on a DEDICATED mongoose
// connection, separate from the default connection the panel swaps per store.
// That separation is load-bearing: the panel opens/closes the default connection
// once per store operation, and this platform connection must survive those
// cycles. (The panel closes only mongoose.connection, never mongoose.disconnect,
// precisely so this stays alive.)
//
// The whole module degrades gracefully: if PLATFORM_DATABASE is unset, platform()
// returns null and callers fall back to the fleet registry (backwards compat).
// ============================================================================
const mongoose = require("mongoose");
const { applyDnsFix, suppressUriDeprecationLeak } = require("../config/db");
const schemas = require("./schemas");

let conn = null;
let models = null;

function configured() {
  return !!process.env.PLATFORM_DATABASE;
}

// Lazily open the platform connection and bind models. Returns null when the
// platform database is not configured (callers must fall back to the fleet).
function platform() {
  if (models) return models;
  if (!configured()) return null;

  applyDnsFix();
  suppressUriDeprecationLeak();
  conn = mongoose.createConnection(process.env.PLATFORM_DATABASE, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
  });
  conn.on("error", (err) => console.log("Platform DB error:", err.message));

  models = {
    connection: conn,
    Store: conn.model("Store", schemas.storeSchema),
    Operator: conn.model("Operator", schemas.operatorSchema),
    ActivityLog: conn.model("ActivityLog", schemas.activityLogSchema),
    Deployment: conn.model("Deployment", schemas.deploymentSchema),
    MigrationLog: conn.model("MigrationLog", schemas.migrationLogSchema),
  };
  return models;
}

// Append one audit event. Never throws — a failed log must not fail the action
// it records. No-op when the platform is not configured.
async function logActivity({ operator, storeId, action, metadata } = {}) {
  const p = platform();
  if (!p || !action) return null;
  try {
    return await p.ActivityLog.create({
      operator: operator || "panel",
      storeId: storeId || null,
      action,
      metadata: metadata || {},
    });
  } catch (err) {
    console.log("Activity log write failed:", err.message);
    return null;
  }
}

// Upsert a store's platform metadata. No-op (returns null) without a platform db.
async function upsertStore(fields) {
  const p = platform();
  if (!p || !fields || !fields.storeId) return null;
  return p.Store.findOneAndUpdate(
    { storeId: fields.storeId },
    { $set: fields },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

module.exports = { platform, configured, logActivity, upsertStore };
