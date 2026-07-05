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
    // VCE version tracking (Phase Λ). currentVersion is the VCE engine version
    // the store runs (set to the platform version at provision, advanced by the
    // Update Manager as migrations apply). Deployment package build versions live
    // on the Deployment records, not here.
    currentVersion: { type: String, default: "" },
    previousVersion: { type: String, default: "" },
    lastUpdated: { type: Date, default: null },
    pendingMigrations: { type: [String], default: [] },
    lastUpdateStatus: { type: String, enum: ["", "success", "failed"], default: "" },
    versionHistory: {
      type: [new mongoose.Schema({ version: String, at: Date }, { _id: false })],
      default: [],
    },
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

// A recorded deployment of a store's code. The Deployment Engine (Phase Κ)
// generates a self-contained deployment PACKAGE per version; this is the ledger
// of what/when/who/how, plus enough non-secret metadata to support rollback
// later (databaseName, commit, version, packagePath). Secrets NEVER live here —
// they go only into the generated .env files inside the (gitignored) package.
const deploymentSchema = new mongoose.Schema(
  {
    storeId: { type: String, required: true, index: true },
    provider: { type: String, default: "local" }, // which DeploymentProvider produced it
    version: { type: String, default: "" }, // package build semver, assigned at generation
    vceVersion: { type: String, default: "" }, // the VCE engine version this deployment ships (Phase Λ)
    gitCommit: { type: String, default: "" },
    environment: { type: String, default: "production" },
    status: {
      type: String,
      enum: ["generated", "started", "completed", "failed", "rolled_back"],
      default: "generated",
    },
    packagePath: { type: String, default: "" }, // where the package was written (relative to server/)
    healthcheck: { type: mongoose.Schema.Types.Mixed, default: {} },
    secretsChecklist: { type: mongoose.Schema.Types.Mixed, default: [] },
    rollback: { type: mongoose.Schema.Types.Mixed, default: {} }, // non-secret metadata to enable future rollback
    deployedAt: { type: Date, default: null }, // set when a deploy is marked completed
    deployedBy: { type: String, default: "panel" },
    notes: { type: String, default: "" },
  },
  { timestamps: true } // createdAt = when the record/package was generated
);

// Migration ledger (Phase Λ). One entry per migration attempt during a store
// update — the audit trail of what ran, how long it took, and whether it worked.
const migrationLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now, index: true },
  operator: { type: String, default: "panel" },
  storeId: { type: String, default: null, index: true },
  migration: { type: String, required: true }, // migration version, e.g. "1.1.0"
  description: { type: String, default: "" },
  fromVersion: { type: String, default: "" },
  toVersion: { type: String, default: "" },
  duration: { type: Number, default: 0 }, // milliseconds
  result: { type: String, enum: ["success", "failed", "skipped"], default: "success" },
  error: { type: String, default: "" },
});

// Store Template (Phase Μ) — a reusable blueprint of a store's REUSABLE
// CONFIGURATION only (theme/layout/content/stats/features/payment-without-secrets
// /seo/categories/navigation). Never merchant data (orders, customers, reviews,
// coupons, analytics, admin passwords, activity). `config` holds the snapshot;
// `sourceStoreId` records the store it was captured from (if any).
const templateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: "" },
    industry: { type: String, default: "" },
    thumbnail: { type: String, default: "" },
    tags: { type: [String], default: [] },
    createdBy: { type: String, default: "panel" },
    version: { type: String, default: "1.0.0" },
    visibility: { type: String, enum: ["private", "shared", "public"], default: "private" },
    sourceStoreId: { type: String, default: "" },
    usageCount: { type: Number, default: 0 },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    versionHistory: {
      type: [new mongoose.Schema({ version: String, at: Date, by: String, note: String }, { _id: false })],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = {
  storeSchema,
  operatorSchema,
  activityLogSchema,
  deploymentSchema,
  migrationLogSchema,
  templateSchema,
};
