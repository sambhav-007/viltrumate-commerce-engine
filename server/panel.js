/*
 * VCE Panel — the agency control plane. One UI to create client stores and
 * manage every store's theme, typography, layout, payment, features, trust
 * stats and section locks — across all fleet databases, without touching any
 * client's admin panel.
 *
 *   cd server && npm run panel          # http://localhost:8100
 *
 * Operator environment:
 *   PLATFORM_DATABASE=mongodb+srv://user:pass@cluster.mongodb.net/vce_platform
 *                       agency metadata (stores, operators, deployments, audit)
 *   PROVISION_CLUSTER_URI=mongodb+srv://user:pass@cluster.mongodb.net
 *                       cluster root — used ONLY to reach individual store dbs
 *   PANEL_KEY=...        access key (auto-generated + printed if unset)
 *   PANEL_PORT=8100      optional
 *
 * Source of truth for the fleet is the PLATFORM DATABASE (Store collection).
 * The legacy fleet registry (provisioning/fleet.json + manifests under
 * provisioning/stores/) is retained as a fallback: a store missing from the
 * platform db is resolved from the registry, so existing deployments keep
 * working with or without PLATFORM_DATABASE set.
 *
 * Settings writes go straight into the target store's OWN database via the
 * default mongoose connection, one store at a time (an ops tool, not a
 * high-concurrency API). Merchant data (products/orders/customers) NEVER
 * touches the platform database — only agency metadata does.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");
const bcrypt = require("bcryptjs");
const express = require("express");
const mongoose = require("mongoose");
const { connect } = require("./config/db");
const { buildDatabaseUri } = require("./provisioning/generateEnv");
const { withDefaults } = require("./provisioning/loadManifest");
const { applyIndustry, listIndustries } = require("./provisioning/applyIndustry");
const { applyStoreSettings } = require("./provisioning/applyStoreSettings");
const { createAdminUser } = require("./provisioning/createAdminUser");
const { seedCatalog } = require("./provisioning/seedCatalog");
const StoreSettings = require("./models/storeSettings");
const { platform, configured: platformConfigured, logActivity, upsertStore } = require("./platform");
const { getProvider, listProviders } = require("./platform/deploy/registry");
const { validateDeployment } = require("./platform/deploy/validateSecrets");
const { bumpVersion } = require("./platform/deploy/version");
const { zipSync } = require("./platform/deploy/zip");
const { list: listMigrations, pendingFor, cmp, CURRENT_VCE_VERSION } = require("./platform/migrations");
const { checkCompatibility } = require("./platform/migrations/compatibility");
const templates = require("./platform/templates");
const { snapshotStore, writeClone } = require("./platform/clone");
const { baseSlug } = require("./config/slug");
const { logInfo, logError } = require("./config/logger");
const pluginLoader = require("./pluginHost/loader");
const { createSdk } = require("./pluginHost/sdk");
const { runtimeModel } = require("./pluginHost/runtime");

const APP_VERSION = require("./package.json").version;

// Never let a stray rejection/exception take the panel down silently.
process.on("unhandledRejection", (reason) => logError("panel", reason, {}));
process.on("uncaughtException", (err) => logError("panel", err, {}));

// The VCE update state of a platform Store doc, from its VCE version.
function updateStateFor(doc) {
  if (!doc || !doc.currentVersion) return "unknown";
  if (doc.lastUpdateStatus === "failed") return "update-failed";
  return pendingFor(doc.currentVersion).length ? "migration-required" : "up-to-date";
}

const PORT = Number(process.env.PANEL_PORT) || 8100;
const KEY = process.env.PANEL_KEY || crypto.randomBytes(18).toString("base64url");
const FLEET_FILE = path.join(__dirname, "provisioning", "fleet.json");
const STORES_DIR = path.join(__dirname, "provisioning", "stores");
const DEPLOY_DIR = path.join(__dirname, "deployments"); // generated packages (gitignored)
const REPO_ROOT = path.join(__dirname, "..");

// Current repo short commit (best-effort; empty on failure).
const gitCommit = () => {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: REPO_ROOT }).toString().trim();
  } catch (e) {
    return "";
  }
};

/* ---------- fleet registry (legacy fallback source) ---------- */
const readFleet = () =>
  fs.existsSync(FLEET_FILE) ? JSON.parse(fs.readFileSync(FLEET_FILE, "utf8")) : [];
const writeFleet = (entries) =>
  fs.writeFileSync(FLEET_FILE, JSON.stringify(entries, null, 2) + "\n");

const loadStore = (id) => {
  const entry = readFleet().find((e) => e.id === id);
  if (!entry) return null;
  const manifestPath = path.resolve(path.dirname(FLEET_FILE), entry.manifest);
  const manifest = withDefaults(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
  return { entry, manifest, manifestPath };
};

/* ---------- store resolution: platform first, fleet fallback ----------
 * The database name is the authoritative field. If the store is registered in
 * the platform database, use its databaseName; otherwise fall back to the
 * fleet manifest. Returns a normalized { source, id, dbName, meta } (+ the raw
 * platformDoc / manifest) or null.                                          */
async function resolveStore(id) {
  const p = platform();
  if (p) {
    const doc = await p.Store.findOne({ storeId: id });
    if (doc) {
      return {
        source: "platform",
        id,
        dbName: doc.databaseName,
        platformDoc: doc,
        meta: {
          id,
          name: doc.name,
          industry: doc.industry || "",
          db: doc.databaseName,
          domain: doc.domain || "",
          clientUrl: doc.domain || "",
          status: doc.status,
          currentVersion: doc.currentVersion || "",
          previousVersion: doc.previousVersion || "",
          lastUpdated: doc.lastUpdated,
          pendingMigrations: pendingFor(doc.currentVersion).map((m) => m.version),
          lastUpdateStatus: doc.lastUpdateStatus || "",
          versionHistory: doc.versionHistory || [],
          updateState: updateStateFor(doc),
          notes: doc.notes || "",
          lockedSections: doc.lockedSections || [],
          createdAt: doc.createdAt,
          source: "platform",
        },
      };
    }
  }
  const fleet = loadStore(id);
  if (fleet) {
    const m = fleet.manifest;
    return {
      source: "fleet",
      id,
      dbName: m.infrastructure.database.name,
      manifest: m,
      meta: {
        id,
        name: m.store.identity.storeName,
        industry: m.store.industry || "",
        db: m.infrastructure.database.name,
        domain: (m.infrastructure.client || {}).url || "",
        clientUrl: (m.infrastructure.client || {}).url || "",
        apiUrl: (m.infrastructure.api || {}).url || "",
        status: "active",
        source: "fleet",
      },
    };
  }
  return null;
}

/* ---------- one-store-at-a-time DB access ----------
 * The store operations run on the DEFAULT mongoose connection. We close only
 * that connection between stores (NOT mongoose.disconnect(), which would also
 * tear down the persistent platform connection).                            */
let queue = Promise.resolve();
const withStoreDb = (dbName, fn) => {
  const run = queue.then(async () => {
    await connect(buildDatabaseUri(dbName));
    try {
      return await fn();
    } finally {
      await mongoose.connection.close();
    }
  });
  queue = run.catch(() => {}); // keep the queue alive after failures
  return run;
};

const operatorOf = (req) => req.headers["x-panel-operator"] || "panel";

// A value usable as an _id match (real ObjectId if valid, else a non-matching
// placeholder) so a slug-or-id $or lookup never throws a CastError.
const safeId = (v) => (mongoose.Types.ObjectId.isValid(v) ? v : "000000000000000000000000");

/* ---------- app ---------- */
const app = express();
app.use(express.json({ limit: "1mb" }));

// Attach a request id (from the caller or generated) for correlated logging.
app.use((req, res, next) => {
  req.id = req.headers["x-request-id"] || crypto.randomUUID();
  res.setHeader("x-request-id", req.id);
  next();
});

// Monitoring endpoints — UNAUTHENTICATED, structured JSON. /health is liveness
// (process up); /ready is readiness (platform DB reachable when configured).
app.get("/health", (req, res) =>
  res.json({ status: "ok", service: "vce-panel", version: APP_VERSION, uptime: process.uptime(), ts: new Date().toISOString() })
);
app.get("/ready", async (req, res) => {
  const out = { status: "ready", platformConfigured: platformConfigured(), ts: new Date().toISOString() };
  try {
    if (platformConfigured()) {
      const p = platform();
      out.platformDb = p.connection.readyState === 1 ? "connected" : "connecting";
      if (p.connection.readyState !== 1) { out.status = "not-ready"; return res.status(503).json(out); }
    } else {
      out.platformDb = "unconfigured";
    }
    res.json(out);
  } catch (err) {
    logError("panel", err, { requestId: req.id });
    res.status(503).json({ status: "not-ready", error: "readiness check failed", ts: new Date().toISOString() });
  }
});

// UI (no auth — it holds no data; every API call carries the key).
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "panel", "ui.html")));

app.use("/api", (req, res, next) => {
  if (req.headers["x-panel-key"] === KEY) return next();
  return res.status(401).json({ error: "Invalid panel key" });
});

// GET /api/industries -> available industry presets
app.get("/api/industries", (req, res) => res.json({ industries: listIndustries() }));

// GET /api/git-commit -> current short commit (best-effort; used to prefill the
// Operations tab's deployment form).
app.get("/api/git-commit", (req, res) => res.json({ commit: gitCommit() }));

// GET /api/deploy/providers -> registered deployment providers
app.get("/api/deploy/providers", (req, res) => res.json({ providers: listProviders() }));

// GET /api/platform -> current VCE platform version + migration catalog
app.get("/api/platform", (req, res) =>
  res.json({
    version: CURRENT_VCE_VERSION,
    migrations: listMigrations().map((m) => ({ version: m.version, description: m.description })),
  })
);

// GET /api/diagnostics -> read-only system diagnostics for the panel.
app.get("/api/diagnostics", async (req, res) => {
  const env = process.env;
  const diag = {
    application: { vceVersion: CURRENT_VCE_VERSION, appVersion: APP_VERSION, node: process.version, uptime: process.uptime() },
    platformDatabase: { configured: platformConfigured(), status: "unknown" },
    storeDatabase: { clusterConfigured: !!env.PROVISION_CLUSTER_URI, status: "unknown", stores: 0 },
    cloudinary: {
      configured: !!(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
      cloudName: env.CLOUDINARY_CLOUD_NAME || "",
    },
    payments: {
      razorpay: !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
      razorpayWebhook: !!env.RAZORPAY_WEBHOOK_SECRET,
      keyId: env.RAZORPAY_KEY_ID ? env.RAZORPAY_KEY_ID.slice(0, 8) + "…" : "",
    },
    deployment: { providers: listProviders() },
    migrations: { current: CURRENT_VCE_VERSION, count: listMigrations().length, storesNeedingUpdate: 0 },
    plugins: { discovered: 0, valid: 0, invalid: [], installed: 0, enabled: 0, items: [] },
  };
  const cat = pluginCatalog();
  diag.plugins.discovered = cat.length;
  diag.plugins.valid = cat.filter((c) => c.valid).length;
  diag.plugins.invalid = cat.filter((c) => !c.valid).map((c) => ({ id: c.id, errors: c.errors }));
  diag.plugins.items = cat.map((c) => ({ id: c.id, name: c.name, version: c.version, valid: c.valid, health: c.valid ? "ok" : "invalid" }));
  try {
    if (platformConfigured()) {
      const p = platform();
      const rs = p.connection.readyState; // 1 = connected
      diag.platformDatabase.status = rs === 1 ? "connected" : rs === 2 ? "connecting" : "disconnected";
      if (rs === 1) {
        // Cluster reachability doubles as store-database reachability (same cluster).
        await p.connection.db.admin().ping();
        diag.storeDatabase.status = "reachable";
        const stores = await p.Store.find({}, { currentVersion: 1 });
        diag.storeDatabase.stores = stores.length;
        diag.migrations.storesNeedingUpdate = stores.filter((s) => pendingFor(s.currentVersion).length).length;
        const ps = await p.PluginState.find({});
        diag.plugins.installed = ps.filter((s) => s.installed).length;
        diag.plugins.enabled = ps.filter((s) => s.enabled).length;
      }
    }
  } catch (err) {
    logError("panel", err, { requestId: req.id });
    diag.platformDatabase.status = "error";
    diag.storeDatabase.status = "unreachable";
  }
  res.json({ diagnostics: diag });
});

// GET /api/dashboard -> agency overview (platform db; fleet-count fallback)
app.get("/api/dashboard", async (req, res) => {
  try {
    const p = platform();
    if (!p) {
      const fleet = readFleet();
      const byIndustry = {};
      fleet.forEach((e) => {
        try {
          const ind = loadStore(e.id).manifest.store.industry || "unspecified";
          byIndustry[ind] = (byIndustry[ind] || 0) + 1;
        } catch (_) {}
      });
      return res.json({
        platform: false,
        totalStores: fleet.length,
        activeStores: fleet.length,
        byIndustry,
        recentActivity: [],
        latestDeployments: [],
        platformVersion: CURRENT_VCE_VERSION,
        storesNeedingUpdate: [],
        migrationHistory: [],
        failedUpdates: [],
      });
    }
    const [stores, recentActivity, latestDeployments, migrationHistory] = await Promise.all([
      p.Store.find({}),
      p.ActivityLog.find({}).sort({ timestamp: -1 }).limit(12),
      p.Deployment.find({}).sort({ createdAt: -1 }).limit(6),
      p.MigrationLog.find({}).sort({ timestamp: -1 }).limit(8),
    ]);
    const byIndustry = {};
    let active = 0;
    const needingUpdate = [];
    stores.forEach((s) => {
      if (s.status === "active") active++;
      const ind = s.industry || "unspecified";
      byIndustry[ind] = (byIndustry[ind] || 0) + 1;
      const state = updateStateFor(s);
      if (state === "migration-required" || state === "update-failed") {
        needingUpdate.push({
          id: s.storeId,
          name: s.name,
          currentVersion: s.currentVersion || "",
          pending: pendingFor(s.currentVersion).length,
          state,
        });
      }
    });
    const failedUpdates = migrationHistory.filter((m) => m.result === "failed");
    res.json({
      platform: true,
      totalStores: stores.length,
      activeStores: active,
      byIndustry,
      recentActivity,
      latestDeployments,
      platformVersion: CURRENT_VCE_VERSION,
      storesNeedingUpdate: needingUpdate,
      migrationHistory,
      failedUpdates,
    });
  } catch (err) {
    res.status(500).json({ error: `Dashboard failed: ${err.message}` });
  }
});

// GET /api/activity -> audit log (optionally ?storeId=)
app.get("/api/activity", async (req, res) => {
  const p = platform();
  if (!p) return res.json({ activity: [] });
  const q = req.query.storeId ? { storeId: req.query.storeId } : {};
  const activity = await p.ActivityLog.find(q)
    .sort({ timestamp: -1 })
    .limit(Number(req.query.limit) || 30);
  res.json({ activity });
});

// GET /api/operators -> agency users (never returns password hashes)
app.get("/api/operators", async (req, res) => {
  const p = platform();
  if (!p) return res.json({ operators: [] });
  const operators = await p.Operator.find({}, { password: 0 }).sort({ createdAt: -1 });
  res.json({ operators });
});

// POST /api/operators -> create an agency user
app.post("/api/operators", async (req, res) => {
  const p = platform();
  if (!p) return res.status(400).json({ error: "Platform database not configured" });
  const { name, email, password, role, permissions } = req.body;
  if (!name || !email || !password || password.length < 8) {
    return res.status(400).json({ error: "name, email and password (8+ chars) are required" });
  }
  try {
    if (await p.Operator.findOne({ email: email.toLowerCase() })) {
      return res.status(409).json({ error: "An operator with that email already exists" });
    }
    const op = await p.Operator.create({
      name,
      email,
      password: bcrypt.hashSync(password, 10),
      role: role || "operator",
      permissions: permissions || [],
    });
    await logActivity({
      operator: operatorOf(req),
      action: "Operator created",
      metadata: { email: op.email, role: op.role },
    });
    const safe = op.toObject();
    delete safe.password;
    res.json({ success: "Operator created", operator: safe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stores -> fleet list (platform db, merged with fleet-only entries)
app.get("/api/stores", async (req, res) => {
  try {
    const p = platform();
    const seen = new Set();
    const stores = [];
    if (p) {
      const docs = await p.Store.find({}).sort({ createdAt: -1 });
      docs.forEach((d) => {
        seen.add(d.storeId);
        stores.push({
          id: d.storeId,
          name: d.name,
          industry: d.industry || "",
          db: d.databaseName,
          domain: d.domain || "",
          clientUrl: d.domain || "",
          status: d.status,
          currentVersion: d.currentVersion || "",
          updateState: updateStateFor(d),
          source: "platform",
        });
      });
    }
    // Registry entries not yet in the platform db (backwards compatibility).
    readFleet().forEach((e) => {
      if (seen.has(e.id)) return;
      try {
        const { manifest } = loadStore(e.id);
        stores.push({
          id: e.id,
          name: manifest.store.identity.storeName,
          industry: manifest.store.industry || "",
          db: manifest.infrastructure.database.name,
          apiUrl: manifest.infrastructure.api.url,
          clientUrl: manifest.infrastructure.client.url,
          status: "active",
          source: "fleet",
        });
      } catch (err) {
        stores.push({ id: e.id, name: e.name || e.id, error: "manifest unreadable", source: "fleet" });
      }
    });
    res.json({ stores });
  } catch (err) {
    res.status(500).json({ error: `Failed to list stores: ${err.message}` });
  }
});

// POST /api/stores -> create + provision a new store.
//   1. provision the store's own database (settings, admin, catalog),
//   2. register it in the platform database (source of truth), and
//   3. keep updating the fleet registry (backwards compatibility).
// body: { id, storeName, industry?, adminEmail, whatsappNumber?, dbName? }
app.post("/api/stores", async (req, res) => {
  try {
    const { id, storeName, industry, adminEmail } = req.body;
    if (!id || !/^[a-z0-9-]+$/.test(id)) {
      return res.status(400).json({ error: "id is required (lowercase letters, digits, dashes)" });
    }
    if (!storeName || !adminEmail) {
      return res.status(400).json({ error: "storeName and adminEmail are required" });
    }
    // A store already known (platform or fleet) can be re-run with retry:true
    // (all DB steps are idempotent); otherwise duplicates are an error.
    const known = (await resolveStore(id)) !== null;
    if (known && !req.body.retry) {
      return res.status(409).json({
        error: `Store "${id}" already exists — pass retry:true to re-run provisioning`,
      });
    }

    // Provision mode: "blank" (default), "industry" preset, or "template".
    let template = null;
    if (req.body.template) {
      const p = platform();
      if (!p) return res.status(400).json({ error: "Templates require PLATFORM_DATABASE" });
      template = await p.Template.findOne({ $or: [{ slug: req.body.template }, { _id: safeId(req.body.template) }] });
      if (!template) return res.status(404).json({ error: `Template "${req.body.template}" not found` });
    }

    const manifest = withDefaults({
      version: 1,
      store: {
        id,
        industry: industry || undefined,
        identity: {
          storeName,
          whatsappNumber: req.body.whatsappNumber || "",
          contactEmail: adminEmail,
        },
      },
      admin: { email: adminEmail, name: `${storeName} Admin` },
      infrastructure: req.body.dbName ? { database: { name: req.body.dbName } } : {},
    });
    const { categories } = applyIndustry(manifest);
    const dbName = manifest.infrastructure.database.name;
    const domain = (manifest.infrastructure.client || {}).url || "";

    // Persist manifest + register (fleet + platform) BEFORE touching the store
    // DB, so a failed provision is visible and re-runnable (steps are idempotent).
    fs.mkdirSync(STORES_DIR, { recursive: true });
    const manifestPath = path.join(STORES_DIR, `${id}.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    const existingFleet = readFleet().some((e) => e.id === id);
    if (!existingFleet) {
      writeFleet([...readFleet(), { id, name: storeName, manifest: `./stores/${id}.json` }]);
    }
    await upsertStore({
      storeId: id,
      name: storeName,
      slug: id,
      industry: industry || "",
      databaseName: dbName,
      domain,
      status: "provisioning",
    });
    await logActivity({
      operator: operatorOf(req),
      storeId: id,
      action: "Store created",
      metadata: { storeName, industry: industry || "", db: dbName },
    });

    const password =
      crypto.randomBytes(12).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 14) + "9z";

    let result;
    try {
      result = await withStoreDb(dbName, async () => {
        await applyStoreSettings(manifest);
        const { created } = await createAdminUser({
          email: adminEmail,
          password,
          name: manifest.admin.name,
        });
        let counts;
        if (template) {
          // Template mode: import the blueprint's config + categories on top of
          // the identity that applyStoreSettings just wrote.
          const empty = JSON.parse(
            fs.readFileSync(path.join(__dirname, "provisioning", "presets", "empty.json"), "utf8")
          );
          await seedCatalog(empty); // start from an empty catalog
          const applied = await templates.applyTemplateConfig(template.config || {}, { categories: true });
          counts = { categories: applied.categoriesCreated, products: 0, variants: 0 };
        } else {
          const preset = JSON.parse(
            fs.readFileSync(path.join(__dirname, "provisioning", "presets", "empty.json"), "utf8")
          );
          if (categories.length) preset.categories = categories;
          counts = await seedCatalog(preset);
        }
        return { created, counts };
      });
    } catch (dbErr) {
      await upsertStore({ storeId: id, name: storeName, databaseName: dbName, status: "error" });
      await logActivity({
        operator: operatorOf(req),
        storeId: id,
        action: "Store provisioning failed",
        metadata: { error: dbErr.message },
      });
      throw dbErr;
    }

    // Mark active + record the successful provision. A fresh store is built
    // with the latest schema, so it starts at the current VCE version with no
    // pending migrations.
    await upsertStore({
      storeId: id,
      name: storeName,
      slug: id,
      industry: industry || "",
      databaseName: dbName,
      domain,
      status: "active",
      currentVersion: CURRENT_VCE_VERSION,
      previousVersion: "",
      lastUpdated: new Date(),
      pendingMigrations: [],
      lastUpdateStatus: "success",
    });
    await logActivity({
      operator: operatorOf(req),
      storeId: id,
      action: "Store provisioned",
      metadata: { db: dbName, admin: adminEmail, catalog: result.counts, template: template ? template.slug : undefined },
    });
    if (template) {
      const p = platform();
      await p.Template.updateOne({ _id: template._id }, { $inc: { usageCount: 1 } });
      await logActivity({
        operator: operatorOf(req),
        storeId: id,
        action: "Template used",
        metadata: { template: template.slug, version: template.version },
      });
    }

    return res.json({
      success: `Store "${storeName}" provisioned`,
      id,
      db: dbName,
      admin: { email: adminEmail, password, created: result.created },
      catalog: result.counts,
      note: "Save the admin password now — it is not stored anywhere.",
    });
  } catch (err) {
    return res.status(500).json({ error: `Provision failed: ${err.message}` });
  }
});

// GET /api/stores/:id/settings -> the store's live StoreSettings document
app.get("/api/stores/:id/settings", async (req, res) => {
  try {
    const store = await resolveStore(req.params.id);
    if (!store) return res.status(404).json({ error: "Unknown store" });
    const settings = await withStoreDb(store.dbName, async () => {
      let doc = await StoreSettings.findOne({});
      if (!doc) doc = await StoreSettings.create({});
      return doc.toObject({ flattenMaps: true });
    });
    return res.json({ store: store.meta, settings });
  } catch (err) {
    return res.status(500).json({ error: `Failed to load settings: ${err.message}` });
  }
});

// PUT /api/stores/:id/settings -> write straight into the store's DB.
// body: any subset of the whitelisted StoreSettings fields (incl.
// lockedSections). The panel bypasses the store API's section locks — that's
// the point: only the agency can change locked sections.
const FLAT = [
  "storeName", "whatsappNumber", "address", "aboutUs", "contactEmail",
  "contactPhone", "instagramUrl", "facebookUrl", "heroHeading",
  "heroSubheading", "variantLabel",
];
const OBJECTS = ["theme", "layout", "payment", "seo", "features", "stats", "lockedSections"];

// Derive human-readable audit actions from a before/after settings snapshot.
function settingsActions(before, after) {
  const acts = [];
  const j = (x) => JSON.stringify(x == null ? null : x);
  const bt = before.theme || {}, at = after.theme || {};
  if (j(bt.colors) !== j(at.colors) || j(bt.tokens) !== j(at.tokens) || bt.motion !== at.motion) {
    acts.push({ action: "Theme updated" });
  }
  if (j(bt.fonts || {}) !== j(at.fonts || {})) acts.push({ action: "Typography changed" });
  if (j(before.payment) !== j(after.payment)) {
    acts.push({ action: "Payment modified", metadata: after.payment });
  }
  if (j(before.layout || {}) !== j(after.layout || {})) {
    acts.push({ action: "Layout changed", metadata: after.layout });
  }
  const bf = before.features || {}, af = after.features || {};
  const enabled = [], disabled = [];
  new Set([...Object.keys(bf), ...Object.keys(af)]).forEach((k) => {
    if (!!bf[k] === !!af[k]) return;
    (af[k] ? enabled : disabled).push(k);
  });
  if (enabled.length) acts.push({ action: "Feature enabled", metadata: { features: enabled } });
  if (disabled.length) acts.push({ action: "Feature disabled", metadata: { features: disabled } });
  if (j(before.lockedSections) !== j(after.lockedSections)) {
    acts.push({ action: "Agency locks updated", metadata: { lockedSections: after.lockedSections } });
  }
  const idFields = ["storeName", "variantLabel", "whatsappNumber", "contactEmail",
    "heroHeading", "heroSubheading", "address", "aboutUs", "contactPhone",
    "instagramUrl", "facebookUrl"];
  if (idFields.some((k) => (before[k] || "") !== (after[k] || ""))) {
    acts.push({ action: "Content updated" });
  }
  if (!acts.length) acts.push({ action: "Settings saved" });
  return acts;
}

app.put("/api/stores/:id/settings", async (req, res) => {
  try {
    const store = await resolveStore(req.params.id);
    if (!store) return res.status(404).json({ error: "Unknown store" });
    let before = {};
    const settings = await withStoreDb(store.dbName, async () => {
      let doc = await StoreSettings.findOne({});
      if (!doc) doc = new StoreSettings({});
      before = doc.toObject({ flattenMaps: true });
      FLAT.forEach((k) => {
        if (req.body[k] !== undefined) doc[k] = req.body[k];
      });
      OBJECTS.forEach((k) => {
        if (req.body[k] !== undefined) doc[k] = req.body[k];
      });
      await doc.save();
      return doc.toObject({ flattenMaps: true });
    });

    // Sync platform metadata (name/locks) and append audit events.
    const p = platform();
    if (p && store.source === "platform") {
      await p.Store.updateOne(
        { storeId: store.id },
        { $set: { name: settings.storeName || store.meta.name, lockedSections: settings.lockedSections || [] } }
      );
    }
    const operator = operatorOf(req);
    for (const a of settingsActions(before, settings)) {
      await logActivity({ operator, storeId: store.id, action: a.action, metadata: a.metadata });
    }

    return res.json({ success: "Settings updated", settings });
  } catch (err) {
    return res.status(500).json({ error: `Failed to update: ${err.message}` });
  }
});

// GET /api/stores/:id/deployments -> deployment history (newest first)
app.get("/api/stores/:id/deployments", async (req, res) => {
  const p = platform();
  if (!p) return res.json({ deployments: [] });
  const deployments = await p.Deployment.find({ storeId: req.params.id })
    .sort({ createdAt: -1 })
    .limit(50);
  res.json({ deployments });
});

// Assemble the deployment context (store metadata + manifest + live settings)
// used by both validation and package generation. Never duplicates values —
// each field flows from its authoritative source.
async function deploymentContext(id) {
  const resolved = await resolveStore(id);
  if (!resolved) return null;
  const fleet = loadStore(id); // manifest carries infra (api/client urls, cloudinary folder, currency)
  const manifest = fleet ? fleet.manifest : resolved.manifest || null;
  const settings = await withStoreDb(resolved.dbName, async () => {
    let doc = await StoreSettings.findOne({});
    if (!doc) doc = await StoreSettings.create({});
    return doc.toObject({ flattenMaps: true });
  });
  const store = {
    storeId: id,
    name: resolved.meta.name,
    databaseName: resolved.dbName,
    domain: resolved.meta.clientUrl || resolved.meta.domain || "",
    industry: resolved.meta.industry || "",
    currentVersion: (resolved.platformDoc && resolved.platformDoc.currentVersion) || "",
  };
  return { resolved, manifest, settings, store };
}

// GET /api/stores/:id/deploy/validate -> pre-flight secrets/compat validation
app.get("/api/stores/:id/deploy/validate", async (req, res) => {
  try {
    const ctx = await deploymentContext(req.params.id);
    if (!ctx) return res.status(404).json({ error: "Unknown store" });
    res.json({ validation: validateDeployment({ store: ctx.store, settings: ctx.settings, manifest: ctx.manifest }) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stores/:id/deployments/package -> validate + generate a deployment
// package (a new version). Refuses to generate on blocking validation gaps.
// body: { provider?="local", bump?="patch"|"minor"|"major", environment?, notes?, gitCommit? }
app.post("/api/stores/:id/deployments/package", async (req, res) => {
  const p = platform();
  if (!p) {
    return res.status(400).json({ error: "Platform database not configured — deployments require PLATFORM_DATABASE" });
  }
  try {
    const ctx = await deploymentContext(req.params.id);
    if (!ctx) return res.status(404).json({ error: "Unknown store" });
    const id = ctx.store.storeId;

    // Never generate an invalid deployment.
    const validation = validateDeployment({ store: ctx.store, settings: ctx.settings, manifest: ctx.manifest });
    if (!validation.ok) {
      return res.status(422).json({ error: "Deployment validation failed — fix the missing values", validation });
    }

    // Package build version: an independent semver bumped from the latest
    // package (NOT the store's VCE version). The VCE version the package ships
    // is recorded separately as vceVersion.
    const latest = await p.Deployment.findOne({ storeId: id }).sort({ createdAt: -1 });
    const base = (latest && latest.version) || "0.0.0";
    const version = bumpVersion(base, req.body.bump || "patch");
    const vceVersion = ctx.store.currentVersion || CURRENT_VCE_VERSION;
    const commit = req.body.gitCommit || gitCommit();
    const environment = req.body.environment || "production";
    const providerName = req.body.provider || "local";

    const provider = getProvider(providerName, {
      store: ctx.store,
      settings: ctx.settings,
      manifest: ctx.manifest,
      version,
      vceVersion,
      gitCommit: commit,
      environment,
      env: process.env,
      baseDir: DEPLOY_DIR,
    });
    const result = await provider.deploy();

    const deployment = await p.Deployment.create({
      storeId: id,
      provider: providerName,
      version,
      vceVersion,
      gitCommit: commit,
      environment,
      status: "generated",
      packagePath: result.packagePath,
      healthcheck: result.healthcheck,
      secretsChecklist: result.secretsChecklist,
      rollback: result.rollback,
      deployedBy: operatorOf(req),
      notes: req.body.notes || "",
    });
    await logActivity({
      operator: operatorOf(req),
      storeId: id,
      action: "Deployment package generated",
      metadata: { version, vceVersion, provider: providerName, packagePath: result.packagePath, environment },
    });

    res.json({ success: `Package v${version} generated`, deployment, version, validation, files: result.files });
  } catch (err) {
    res.status(500).json({ error: `Package generation failed: ${err.message}` });
  }
});

// GET /api/stores/:id/deployments/:depId/package -> download the package (zip)
app.get("/api/stores/:id/deployments/:depId/package", async (req, res) => {
  const p = platform();
  if (!p) return res.status(400).json({ error: "Platform database not configured" });
  try {
    const dep = await p.Deployment.findOne({ _id: req.params.depId, storeId: req.params.id });
    if (!dep || !dep.packagePath) return res.status(404).json({ error: "No package for this deployment" });
    const dir = path.join(__dirname, dep.packagePath);
    if (!fs.existsSync(dir)) return res.status(410).json({ error: "Package files are no longer on disk" });
    const entries = fs
      .readdirSync(dir)
      .filter((f) => fs.statSync(path.join(dir, f)).isFile())
      .map((f) => ({ name: f, content: fs.readFileSync(path.join(dir, f)) }));
    const zip = zipSync(entries);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${req.params.id}-v${dep.version}.zip"`);
    res.send(zip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stores/:id/deployments/:depId/status -> advance a deployment through
// the timeline (started/completed/failed/rolled_back), logging each transition.
const STATUS_ACTION = {
  started: "Deployment started",
  completed: "Deployment completed",
  failed: "Deployment failed",
  rolled_back: "Deployment rolled back",
};
app.post("/api/stores/:id/deployments/:depId/status", async (req, res) => {
  const p = platform();
  if (!p) return res.status(400).json({ error: "Platform database not configured" });
  const { status, notes } = req.body;
  if (!STATUS_ACTION[status]) {
    return res.status(400).json({ error: `status must be one of: ${Object.keys(STATUS_ACTION).join(", ")}` });
  }
  try {
    const dep = await p.Deployment.findOne({ _id: req.params.depId, storeId: req.params.id });
    if (!dep) return res.status(404).json({ error: "Unknown deployment" });
    dep.status = status;
    if (notes) dep.notes = notes;
    if (status === "completed") dep.deployedAt = new Date();
    await dep.save();
    await logActivity({
      operator: operatorOf(req),
      storeId: req.params.id,
      action: STATUS_ACTION[status],
      metadata: { version: dep.version, provider: dep.provider },
    });
    res.json({ success: STATUS_ACTION[status], deployment: dep });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stores/:id/deployments -> record a MANUAL deployment (backwards
// compatible; no package generated). status defaults to completed.
app.post("/api/stores/:id/deployments", async (req, res) => {
  const p = platform();
  if (!p) {
    return res.status(400).json({ error: "Platform database not configured — deployments require PLATFORM_DATABASE" });
  }
  try {
    const store = await resolveStore(req.params.id);
    if (!store) return res.status(404).json({ error: "Unknown store" });
    const { gitCommit: commit = "", version = "", environment = "production", notes = "" } = req.body;
    const deployment = await p.Deployment.create({
      storeId: store.id,
      provider: "manual",
      gitCommit: commit,
      version,
      vceVersion: (store.platformDoc && store.platformDoc.currentVersion) || CURRENT_VCE_VERSION,
      environment,
      status: "completed",
      deployedAt: new Date(),
      notes,
      deployedBy: operatorOf(req),
    });
    await logActivity({
      operator: operatorOf(req),
      storeId: store.id,
      action: "Deployment completed",
      metadata: { version, gitCommit: commit, environment, manual: true },
    });
    res.json({ success: "Deployment recorded", deployment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==================== Store Templates & Cloning (Phase Μ) ==================== */

async function uniqueTemplateSlug(base) {
  const p = platform();
  const root = baseSlug(base) || "template";
  let slug = root, n = 1;
  while (await p.Template.findOne({ slug })) slug = `${root}-${++n}`;
  return slug;
}

// GET /api/templates -> gallery list (summary fields, no full config)
app.get("/api/templates", async (req, res) => {
  const p = platform();
  if (!p) return res.json({ templates: [] });
  const docs = await p.Template.find({}, { config: 0 }).sort({ updatedAt: -1 });
  res.json({ templates: docs });
});

// POST /api/templates/import -> validate + store an imported template JSON
app.post("/api/templates/import", async (req, res) => {
  const p = platform();
  if (!p) return res.status(400).json({ error: "Templates require PLATFORM_DATABASE" });
  const obj = req.body && req.body.template ? req.body.template : req.body;
  const validation = templates.validateImport(obj);
  if (!validation.ok) return res.status(422).json({ error: "Invalid template", validation });
  try {
    const slug = await uniqueTemplateSlug(obj.slug || obj.name);
    const doc = await p.Template.create({
      name: obj.name,
      slug,
      description: obj.description || "",
      industry: obj.industry || "",
      thumbnail: obj.thumbnail || "",
      tags: Array.isArray(obj.tags) ? obj.tags : [],
      createdBy: operatorOf(req),
      version: obj.version || "1.0.0",
      visibility: ["private", "shared", "public"].includes(obj.visibility) ? obj.visibility : "private",
      sourceStoreId: "",
      config: obj.config || {},
      versionHistory: [{ version: obj.version || "1.0.0", at: new Date(), by: operatorOf(req), note: "imported" }],
    });
    await logActivity({ operator: operatorOf(req), action: "Template imported", metadata: { template: doc.slug } });
    res.json({ success: `Template "${doc.name}" imported`, template: { id: doc._id, slug: doc.slug, name: doc.name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/templates/:tid -> full template (config included)
app.get("/api/templates/:tid", async (req, res) => {
  const p = platform();
  if (!p) return res.status(400).json({ error: "Platform database not configured" });
  const t = await p.Template.findOne({ $or: [{ slug: req.params.tid }, { _id: safeId(req.params.tid) }] });
  if (!t) return res.status(404).json({ error: "Unknown template" });
  res.json({ template: t });
});

// GET /api/templates/:tid/preview -> renderable preview (no provisioning)
app.get("/api/templates/:tid/preview", async (req, res) => {
  const p = platform();
  if (!p) return res.status(400).json({ error: "Platform database not configured" });
  const t = await p.Template.findOne({ $or: [{ slug: req.params.tid }, { _id: safeId(req.params.tid) }] });
  if (!t) return res.status(404).json({ error: "Unknown template" });
  res.json({ preview: templates.previewOf(t) });
});

// GET /api/templates/:tid/export -> download the template as JSON
app.get("/api/templates/:tid/export", async (req, res) => {
  const p = platform();
  if (!p) return res.status(400).json({ error: "Platform database not configured" });
  const t = await p.Template.findOne({ $or: [{ slug: req.params.tid }, { _id: safeId(req.params.tid) }] });
  if (!t) return res.status(404).json({ error: "Unknown template" });
  const out = {
    name: t.name, slug: t.slug, description: t.description, industry: t.industry,
    thumbnail: t.thumbnail, tags: t.tags, version: t.version, visibility: t.visibility,
    config: t.config, exportedAt: new Date().toISOString(), vceTemplate: 1,
  };
  await logActivity({ operator: operatorOf(req), action: "Template exported", metadata: { template: t.slug } });
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="${t.slug}-template.json"`);
  res.send(JSON.stringify(out, null, 2));
});

// PUT /api/templates/:tid -> edit; creates a new version entry (stores are NOT
// auto-updated — a template edit never touches a provisioned store).
app.put("/api/templates/:tid", async (req, res) => {
  const p = platform();
  if (!p) return res.status(400).json({ error: "Platform database not configured" });
  try {
    const t = await p.Template.findOne({ $or: [{ slug: req.params.tid }, { _id: safeId(req.params.tid) }] });
    if (!t) return res.status(404).json({ error: "Unknown template" });
    ["name", "description", "industry", "thumbnail", "visibility"].forEach((k) => {
      if (req.body[k] !== undefined) t[k] = req.body[k];
    });
    if (Array.isArray(req.body.tags)) t.tags = req.body.tags;
    if (req.body.config && typeof req.body.config === "object") t.config = req.body.config;
    t.version = bumpVersion(t.version, req.body.bump || "patch");
    t.versionHistory.push({ version: t.version, at: new Date(), by: operatorOf(req), note: req.body.note || "edited" });
    await t.save();
    await logActivity({ operator: operatorOf(req), action: "Template edited", metadata: { template: t.slug, version: t.version } });
    res.json({ success: `Template updated to v${t.version}`, template: t });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/templates/:tid
app.delete("/api/templates/:tid", async (req, res) => {
  const p = platform();
  if (!p) return res.status(400).json({ error: "Platform database not configured" });
  const t = await p.Template.findOne({ $or: [{ slug: req.params.tid }, { _id: safeId(req.params.tid) }] });
  if (!t) return res.status(404).json({ error: "Unknown template" });
  await p.Template.deleteOne({ _id: t._id });
  await logActivity({ operator: operatorOf(req), action: "Template deleted", metadata: { template: t.slug } });
  res.json({ success: `Template "${t.name}" deleted` });
});

// POST /api/stores/:id/template -> create a reusable template FROM a store.
// body: { name, description?, visibility?, tags?, thumbnail?, include? }
app.post("/api/stores/:id/template", async (req, res) => {
  const p = platform();
  if (!p) return res.status(400).json({ error: "Templates require PLATFORM_DATABASE" });
  try {
    const store = await resolveStore(req.params.id);
    if (!store) return res.status(404).json({ error: "Unknown store" });
    if (!req.body.name) return res.status(400).json({ error: "name is required" });
    // Default: include everything reusable.
    const include = req.body.include || templates.INCLUDE_KEYS.reduce((o, k) => ((o[k] = true), o), {});

    const config = await withStoreDb(store.dbName, () => templates.buildTemplateConfig(include));
    const slug = await uniqueTemplateSlug(req.body.name);
    const version = "1.0.0";
    const doc = await p.Template.create({
      name: req.body.name,
      slug,
      description: req.body.description || "",
      industry: store.meta.industry || "",
      thumbnail: req.body.thumbnail || "",
      tags: Array.isArray(req.body.tags) ? req.body.tags : [],
      createdBy: operatorOf(req),
      version,
      visibility: ["private", "shared", "public"].includes(req.body.visibility) ? req.body.visibility : "private",
      sourceStoreId: store.id,
      config,
      versionHistory: [{ version, at: new Date(), by: operatorOf(req), note: `created from ${store.id}` }],
    });
    await logActivity({
      operator: operatorOf(req), storeId: store.id, action: "Template created",
      metadata: { template: doc.slug, include: Object.keys(include).filter((k) => include[k]) },
    });
    res.json({ success: `Template "${doc.name}" created`, template: { id: doc._id, slug: doc.slug, name: doc.name, version } });
  } catch (err) {
    res.status(500).json({ error: `Create template failed: ${err.message}` });
  }
});

// POST /api/stores/:id/clone -> clone a store into a NEW database. Never clones
// merchant data; always provisions a fresh db + admin.
// body: { id, storeName, adminEmail, whatsappNumber?, dbName?, options?, retry? }
app.post("/api/stores/:id/clone", async (req, res) => {
  const p = platform();
  if (!p) return res.status(400).json({ error: "Cloning requires PLATFORM_DATABASE" });
  try {
    const source = await resolveStore(req.params.id);
    if (!source) return res.status(404).json({ error: "Unknown source store" });
    const { id, storeName, adminEmail } = req.body;
    if (!id || !/^[a-z0-9-]+$/.test(id)) {
      return res.status(400).json({ error: "id is required (lowercase letters, digits, dashes)" });
    }
    if (!storeName || !adminEmail) return res.status(400).json({ error: "storeName and adminEmail are required" });
    if ((await resolveStore(id)) && !req.body.retry) {
      return res.status(409).json({ error: `Store "${id}" already exists — pass retry:true to re-run` });
    }
    const options = req.body.options || {
      appearance: true, settings: true, content: true, categories: true, products: true, pages: true, navigation: true,
    };

    // 1. Snapshot the source store (its own db session).
    const snapshot = await withStoreDb(source.dbName, () => snapshotStore(options));

    // 2. Build + register the new store.
    const manifest = withDefaults({
      version: 1,
      store: {
        id,
        industry: source.meta.industry || undefined,
        identity: { storeName, whatsappNumber: req.body.whatsappNumber || "", contactEmail: adminEmail },
      },
      admin: { email: adminEmail, name: `${storeName} Admin` },
      infrastructure: req.body.dbName ? { database: { name: req.body.dbName } } : {},
    });
    const dbName = manifest.infrastructure.database.name;
    const domain = (manifest.infrastructure.client || {}).url || "";
    fs.mkdirSync(STORES_DIR, { recursive: true });
    fs.writeFileSync(path.join(STORES_DIR, `${id}.json`), JSON.stringify(manifest, null, 2) + "\n");
    if (!readFleet().some((e) => e.id === id)) {
      writeFleet([...readFleet(), { id, name: storeName, manifest: `./stores/${id}.json` }]);
    }
    await upsertStore({ storeId: id, name: storeName, slug: id, industry: source.meta.industry || "", databaseName: dbName, domain, status: "provisioning" });
    await logActivity({ operator: operatorOf(req), storeId: id, action: "Store created", metadata: { storeName, clonedFrom: source.id } });

    const password = crypto.randomBytes(12).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 14) + "9z";

    // 3. Write the clone into the fresh db (+ fresh admin).
    let counts;
    try {
      counts = await withStoreDb(dbName, async () => {
        await applyStoreSettings(manifest); // base identity
        const written = await writeClone(snapshot, options);
        await createAdminUser({ email: adminEmail, password, name: manifest.admin.name });
        return written;
      });
    } catch (dbErr) {
      await upsertStore({ storeId: id, name: storeName, databaseName: dbName, status: "error" });
      await logActivity({ operator: operatorOf(req), storeId: id, action: "Store provisioning failed", metadata: { error: dbErr.message } });
      throw dbErr;
    }

    await upsertStore({
      storeId: id, name: storeName, slug: id, industry: source.meta.industry || "", databaseName: dbName, domain,
      status: "active", currentVersion: CURRENT_VCE_VERSION, previousVersion: "", lastUpdated: new Date(),
      pendingMigrations: [], lastUpdateStatus: "success",
    });
    await logActivity({ operator: operatorOf(req), storeId: id, action: "Store cloned", metadata: { from: source.id, counts, options: Object.keys(options).filter((k) => options[k]) } });

    res.json({
      success: `Store "${storeName}" cloned from "${source.id}"`,
      id, db: dbName, clonedFrom: source.id, counts,
      admin: { email: adminEmail, password },
      note: "Save the admin password now — it is not stored anywhere.",
    });
  } catch (err) {
    res.status(500).json({ error: `Clone failed: ${err.message}` });
  }
});

/* ==================== Plugins & Extensions (Phase Ξ) ==================== */

const pluginCatalog = () =>
  pluginLoader.discover().map((d) => ({
    id: d.id,
    valid: d.valid,
    errors: d.errors || [],
    name: (d.manifest && d.manifest.name) || d.id,
    version: (d.manifest && d.manifest.version) || "",
    description: (d.manifest && d.manifest.description) || "",
    author: (d.manifest && d.manifest.author) || "",
    permissions: (d.manifest && d.manifest.permissions) || [],
    settingsSchema: (d.manifest && d.manifest.settings && d.manifest.settings.schema) || [],
    featureFlags: (d.manifest && d.manifest.featureFlags) || [],
    hasMigrations: !!(d.manifest && d.manifest.migrations),
  }));

const findPlugin = (pid) => pluginLoader.discover().find((d) => d.id === pid);

const defaultSettings = (d) => {
  const out = {};
  ((d.manifest && d.manifest.settings && d.manifest.settings.schema) || []).forEach((f) => {
    if (f && f.key !== undefined) out[f.key] = f.default;
  });
  return out;
};

// Mirror per-store plugin state into the store's own db (the commerce server
// reads this at boot). Runs on the serialized store-db queue.
const mirrorRuntime = (dbName, pluginId, patch) =>
  withStoreDb(dbName, () => runtimeModel().updateOne({ pluginId }, { $set: patch }, { upsert: true }));

// GET /api/plugins -> the plugin catalog on disk (with validity)
app.get("/api/plugins", (req, res) => res.json({ plugins: pluginCatalog() }));

// GET /api/stores/:id/plugins -> catalog merged with this store's plugin state
app.get("/api/stores/:id/plugins", async (req, res) => {
  try {
    const p = platform();
    const store = await resolveStore(req.params.id);
    if (!store) return res.status(404).json({ error: "Unknown store" });
    const states = p ? await p.PluginState.find({ storeId: store.id }) : [];
    const byId = {};
    states.forEach((s) => (byId[s.pluginId] = s));
    const plugins = pluginCatalog().map((c) => {
      const st = byId[c.id];
      return {
        ...c,
        state: st
          ? { installed: st.installed, enabled: st.enabled, settings: st.settings || {}, version: st.version, installedAt: st.installedAt }
          : { installed: false, enabled: false, settings: {} },
      };
    });
    res.json({ store: store.id, plugins });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stores/:id/plugins/:pid/install -> run migrations + register state
app.post("/api/stores/:id/plugins/:pid/install", async (req, res) => {
  const p = platform();
  if (!p) return res.status(400).json({ error: "Plugins require PLATFORM_DATABASE" });
  try {
    const store = await resolveStore(req.params.id);
    if (!store) return res.status(404).json({ error: "Unknown store" });
    const d = findPlugin(req.params.pid);
    if (!d) return res.status(404).json({ error: "Unknown plugin" });
    if (!d.valid) return res.status(422).json({ error: "Invalid plugin manifest", errors: d.errors });
    const operator = operatorOf(req);
    const migs = pluginLoader.pluginMigrations(d);
    const applied = [];

    await withStoreDb(store.dbName, async () => {
      const sdk = createSdk(d.manifest, { registry: pluginLoader.createRegistry(), mountRoutes: false });
      const ctx = { sdk, storage: (n) => sdk.storage(n), mongoose, connection: mongoose.connection };
      for (const m of migs) {
        const start = Date.now();
        let result = "success", error = "";
        try {
          await m.run(ctx);
          if (typeof m.verification === "function" && !(await m.verification(ctx))) { result = "failed"; error = "verification returned false"; }
        } catch (e) { result = "failed"; error = e.message; }
        applied.push({ version: m.version, result, error, duration: Date.now() - start });
      }
      await runtimeModel().updateOne(
        { pluginId: d.id },
        { $set: { installed: true, version: d.manifest.version }, $setOnInsert: { enabled: false, settings: defaultSettings(d) } },
        { upsert: true }
      );
    });

    await p.PluginState.updateOne(
      { storeId: store.id, pluginId: d.id },
      { $set: { name: d.manifest.name, version: d.manifest.version, installed: true, installedAt: new Date() }, $setOnInsert: { enabled: false, settings: defaultSettings(d) } },
      { upsert: true }
    );
    for (const a of applied) {
      await p.MigrationLog.create({ operator, storeId: store.id, migration: `plugin:${d.id}:${a.version}`, description: `${d.manifest.name} migration`, toVersion: a.version, duration: a.duration, result: a.result, error: a.error });
    }
    await logActivity({ operator, storeId: store.id, action: "Plugin installed", metadata: { plugin: d.id, version: d.manifest.version } });
    res.json({ success: `Plugin "${d.manifest.name}" installed`, migrations: applied });
  } catch (err) {
    res.status(500).json({ error: `Install failed: ${err.message}` });
  }
});

// POST /api/stores/:id/plugins/:pid/enable | /disable
async function setPluginEnabled(req, res, enabled) {
  const p = platform();
  if (!p) return res.status(400).json({ error: "Plugins require PLATFORM_DATABASE" });
  try {
    const store = await resolveStore(req.params.id);
    if (!store) return res.status(404).json({ error: "Unknown store" });
    const d = findPlugin(req.params.pid);
    if (!d) return res.status(404).json({ error: "Unknown plugin" });
    const st = await p.PluginState.findOne({ storeId: store.id, pluginId: d.id });
    if (enabled && (!st || !st.installed)) return res.status(400).json({ error: "Plugin must be installed before it can be enabled" });
    await p.PluginState.updateOne({ storeId: store.id, pluginId: d.id }, { $set: { enabled } }, { upsert: true });
    await mirrorRuntime(store.dbName, d.id, { enabled });
    await logActivity({ operator: operatorOf(req), storeId: store.id, action: enabled ? "Plugin enabled" : "Plugin disabled", metadata: { plugin: d.id } });
    res.json({ success: `Plugin "${d.manifest.name}" ${enabled ? "enabled" : "disabled"}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
app.post("/api/stores/:id/plugins/:pid/enable", (req, res) => setPluginEnabled(req, res, true));
app.post("/api/stores/:id/plugins/:pid/disable", (req, res) => setPluginEnabled(req, res, false));

// PUT /api/stores/:id/plugins/:pid/settings -> update plugin settings
app.put("/api/stores/:id/plugins/:pid/settings", async (req, res) => {
  const p = platform();
  if (!p) return res.status(400).json({ error: "Plugins require PLATFORM_DATABASE" });
  try {
    const store = await resolveStore(req.params.id);
    if (!store) return res.status(404).json({ error: "Unknown store" });
    const d = findPlugin(req.params.pid);
    if (!d) return res.status(404).json({ error: "Unknown plugin" });
    const settings = req.body && req.body.settings;
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) return res.status(400).json({ error: "settings object is required" });
    await p.PluginState.updateOne({ storeId: store.id, pluginId: d.id }, { $set: { settings } }, { upsert: true });
    await mirrorRuntime(store.dbName, d.id, { settings });
    await logActivity({ operator: operatorOf(req), storeId: store.id, action: "Plugin settings updated", metadata: { plugin: d.id } });
    res.json({ success: "Plugin settings updated", settings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stores/:id/plugins/:pid/uninstall -> mark not-installed. Validates
// whether data would be orphaned and NEVER deletes plugin data automatically.
app.post("/api/stores/:id/plugins/:pid/uninstall", async (req, res) => {
  const p = platform();
  if (!p) return res.status(400).json({ error: "Plugins require PLATFORM_DATABASE" });
  try {
    const store = await resolveStore(req.params.id);
    if (!store) return res.status(404).json({ error: "Unknown store" });
    const d = findPlugin(req.params.pid);
    if (!d) return res.status(404).json({ error: "Unknown plugin" });
    const { orphaned, collections } = await withStoreDb(store.dbName, async () => {
      const colls = await mongoose.connection.db.listCollections().toArray();
      const mine = colls.map((c) => c.name).filter((n) => n.startsWith(`plugin_${d.id}_`));
      let total = 0;
      for (const n of mine) total += await mongoose.connection.db.collection(n).countDocuments();
      return { orphaned: total, collections: mine };
    });
    if (orphaned > 0 && req.body.force !== true) {
      return res.status(409).json({
        error: `Uninstall would leave ${orphaned} record(s) in ${collections.length} collection(s). Data is retained, not deleted. Pass force:true to uninstall anyway.`,
        orphaned, collections,
      });
    }
    await p.PluginState.updateOne({ storeId: store.id, pluginId: d.id }, { $set: { installed: false, enabled: false } }, { upsert: true });
    await mirrorRuntime(store.dbName, d.id, { installed: false, enabled: false });
    await logActivity({ operator: operatorOf(req), storeId: store.id, action: "Plugin uninstalled", metadata: { plugin: d.id, retainedRecords: orphaned } });
    res.json({ success: `Plugin "${d.manifest.name}" uninstalled (data retained)`, retainedRecords: orphaned });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ======================= Update Manager (Phase Λ) ======================= */

// GET /api/stores/:id/update/check -> version status + pending migrations + compat
app.get("/api/stores/:id/update/check", async (req, res) => {
  try {
    const ctx = await deploymentContext(req.params.id);
    if (!ctx) return res.status(404).json({ error: "Unknown store" });
    const current = ctx.store.currentVersion || "";
    const pending = pendingFor(current).map((m) => ({ version: m.version, description: m.description }));
    const compatibility = checkCompatibility({ store: ctx.store, settings: ctx.settings });
    res.json({
      source: ctx.resolved.source,
      currentVersion: current || null,
      latestVersion: CURRENT_VCE_VERSION,
      upToDate: current === CURRENT_VCE_VERSION,
      pending,
      compatibility,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stores/:id/migrations -> the store's migration audit history
app.get("/api/stores/:id/migrations", async (req, res) => {
  const p = platform();
  if (!p) return res.json({ migrations: [] });
  const migrations = await p.MigrationLog.find({ storeId: req.params.id })
    .sort({ timestamp: -1 })
    .limit(50);
  res.json({ migrations });
});

// POST /api/stores/:id/update -> run pending migrations (the Update Wizard's
// "Run" step). Requires explicit confirm:true (never one-click). Aborts safely
// if the compatibility check fails; on a migration failure it stops, advances
// currentVersion only to the last successfully-applied migration, and records
// the failure. Rollback is intentionally NOT performed.
// body: { confirm:true, targetVersion? }
app.post("/api/stores/:id/update", async (req, res) => {
  const p = platform();
  if (!p) return res.status(400).json({ error: "Platform database not configured" });
  if (req.body.confirm !== true) {
    return res.status(400).json({ error: "Explicit confirmation required (confirm:true)" });
  }
  const operator = operatorOf(req);
  try {
    const ctx = await deploymentContext(req.params.id);
    if (!ctx) return res.status(404).json({ error: "Unknown store" });
    if (ctx.resolved.source !== "platform") {
      return res.status(400).json({ error: "Store is not registered in the platform database — updates require a platform store" });
    }
    const id = ctx.store.storeId;
    const startVersion = ctx.store.currentVersion || "0.0.0";
    const target = req.body.targetVersion || CURRENT_VCE_VERSION;
    // Pending migrations up to and including the target version.
    const toRun = pendingFor(startVersion).filter((m) => cmp(m.version, target) <= 0);
    if (!toRun.length) {
      return res.json({ success: "Already up to date", currentVersion: startVersion, applied: [] });
    }

    // Compatibility gate — abort safely without running anything.
    const compatibility = checkCompatibility({ store: ctx.store, settings: ctx.settings });
    if (!compatibility.ok) {
      await logActivity({ operator, storeId: id, action: "Store update aborted", metadata: { reason: "compatibility", failed: compatibility.failed } });
      return res.status(422).json({ error: "Compatibility check failed — update aborted", compatibility });
    }

    // Run all pending (in one store session), stopping at the first failure.
    const applied = [];
    let failure = null;
    await withStoreDb(ctx.resolved.dbName, async () => {
      const migCtx = { StoreSettings, mongoose, connection: mongoose.connection, store: ctx.store, log: () => {} };
      for (const mig of toRun) {
        const start = Date.now();
        let result = "success", error = "";
        try {
          await mig.run(migCtx);
          const ok = await mig.verification(migCtx);
          if (!ok) { result = "failed"; error = "verification returned false"; }
        } catch (e) {
          result = "failed";
          error = e.message;
        }
        applied.push({ version: mig.version, description: mig.description, result, error, duration: Date.now() - start });
        if (result === "failed") { failure = { version: mig.version, error }; break; }
      }
    });

    // Persist migration logs + activity, tracking the last good version.
    let lastGood = startVersion;
    for (const a of applied) {
      await p.MigrationLog.create({
        operator, storeId: id, migration: a.version, description: a.description,
        fromVersion: lastGood, toVersion: a.version, duration: a.duration,
        result: a.result, error: a.error,
      });
      await logActivity({
        operator, storeId: id,
        action: a.result === "success" ? "Migration completed" : "Migration failed",
        metadata: { migration: a.version, duration: a.duration, result: a.result, error: a.error },
      });
      if (a.result === "success") lastGood = a.version;
    }

    const now = new Date();
    const status = failure ? "failed" : "success";
    await p.Store.updateOne(
      { storeId: id },
      {
        $set: {
          currentVersion: lastGood,
          previousVersion: startVersion,
          lastUpdated: now,
          pendingMigrations: pendingFor(lastGood).map((m) => m.version),
          lastUpdateStatus: status,
        },
        $push: { versionHistory: { version: startVersion, at: now } },
      }
    );
    await logActivity({
      operator, storeId: id,
      action: failure ? "Store update failed" : "Store updated",
      metadata: { from: startVersion, to: lastGood },
    });

    return res.status(failure ? 500 : 200).json({
      [failure ? "error" : "success"]: failure
        ? `Update failed at migration ${failure.version}: ${failure.error}`
        : `Store updated ${startVersion} → ${lastGood}`,
      from: startVersion,
      to: lastGood,
      applied,
      compatibility,
    });
  } catch (err) {
    res.status(500).json({ error: `Update failed: ${err.message}` });
  }
});

// Unknown /api route -> consistent 404 JSON (not the HTML UI fallthrough).
app.use("/api", (req, res) => res.status(404).json({ error: `Unknown endpoint: ${req.method} ${req.path}` }));

// Final safety net — any error that escapes a handler is logged (secret-redacted,
// stack in dev only) and returned as consistent JSON. Guarantees graceful failure.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logError("panel", err, { requestId: req && req.id });
  if (res.headersSent) return;
  res.status(err.status || 500).json({ error: "Internal error", requestId: req && req.id });
});

app.listen(PORT, () => {
  console.log(`\nVCE Panel  →  http://localhost:${PORT}`);
  if (!process.env.PANEL_KEY) {
    console.log(`Panel key (set PANEL_KEY to make it permanent): ${KEY}`);
  }
  if (platformConfigured()) {
    platform(); // open the platform connection eagerly
    console.log("Platform database: connected (source of truth for the fleet)");
  } else {
    console.log("⚠ PLATFORM_DATABASE is not set — using the fleet registry (provisioning/fleet.json) as the store source.");
  }
  if (!process.env.PROVISION_CLUSTER_URI) {
    console.log("⚠ PROVISION_CLUSTER_URI is not set — store operations will fail.");
  }
});
