const mongoose = require("mongoose");

// ============================================================================
// Platform Database schemas — AGENCY METADATA ONLY.
//
// These collections live in the dedicated `vce_platform` database (PLATFORM_
// DATABASE), never in a store's own database. They describe the fleet from the
// agency's point of view: which stores exist, who operates the panel, what was
// deployed, and what actions were taken. Merchant data (products, orders,
// customers) MUST NEVER be written here — that stays in each store's database.
//
// Schemas are connection-agnostic; platform/index.js binds them to the platform
// connection via conn.model(). This keeps them off the default (store) mongoose
// connection the panel swaps per store.
// ============================================================================

// A store, from the agency's perspective. `databaseName` is the AUTHORITATIVE
// source for which MongoDB database a store lives in (superseding the fleet
// manifest once a store is registered here).
const storeSchema = new mongoose.Schema(
  {
    storeId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    slug: { type: String, default: "" },
    industry: { type: String, default: "" },
    databaseName: { type: String, required: true },
    domain: { type: String, default: "" },
    status: {
      type: String,
      enum: ["active", "inactive", "provisioning", "archived", "error"],
      default: "active",
    },
    currentVersion: { type: String, default: "" },
    lockedSections: { type: [String], default: [] },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

// An agency user of the VCE Panel. Password is bcrypt-hashed. The panel today
// still gates on PANEL_KEY; operators are recorded metadata (who did what) and
// a forward hook for real operator auth.
const operatorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["owner", "admin", "operator", "viewer"],
      default: "operator",
    },
    permissions: { type: [String], default: [] },
    active: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null },
  },
  { timestamps: true }
);

// Audit trail. Every panel action appends one event. `storeId` is null for
// fleet-wide actions; `metadata` is free-form context (changed fields, etc.).
const activityLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now, index: true },
  operator: { type: String, default: "panel" },
  storeId: { type: String, default: null, index: true },
  action: { type: String, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
});

// A recorded deployment of a store's code (the code ships out-of-band via
// docs/DEPLOYMENT.md; this is the ledger of what/when/who).
const deploymentSchema = new mongoose.Schema(
  {
    storeId: { type: String, required: true, index: true },
    gitCommit: { type: String, default: "" },
    version: { type: String, default: "" },
    deployedAt: { type: Date, default: Date.now },
    deployedBy: { type: String, default: "panel" },
    environment: { type: String, default: "production" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = { storeSchema, operatorSchema, activityLogSchema, deploymentSchema };
