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

const PORT = Number(process.env.PANEL_PORT) || 8100;
const KEY = process.env.PANEL_KEY || crypto.randomBytes(18).toString("base64url");
const FLEET_FILE = path.join(__dirname, "provisioning", "fleet.json");
const STORES_DIR = path.join(__dirname, "provisioning", "stores");
const REPO_ROOT = path.join(__dirname, "..");

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

/* ---------- app ---------- */
const app = express();
app.use(express.json({ limit: "1mb" }));

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
app.get("/api/git-commit", (req, res) => {
  try {
    const commit = execSync("git rev-parse --short HEAD", { cwd: REPO_ROOT })
      .toString()
      .trim();
    res.json({ commit });
  } catch (e) {
    res.json({ commit: "" });
  }
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
      });
    }
    const [stores, recentActivity, latestDeployments] = await Promise.all([
      p.Store.find({}),
      p.ActivityLog.find({}).sort({ timestamp: -1 }).limit(12),
      p.Deployment.find({}).sort({ deployedAt: -1 }).limit(6),
    ]);
    const byIndustry = {};
    let active = 0;
    stores.forEach((s) => {
      if (s.status === "active") active++;
      const ind = s.industry || "unspecified";
      byIndustry[ind] = (byIndustry[ind] || 0) + 1;
    });
    res.json({
      platform: true,
      totalStores: stores.length,
      activeStores: active,
      byIndustry,
      recentActivity,
      latestDeployments,
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
        const preset = JSON.parse(
          fs.readFileSync(path.join(__dirname, "provisioning", "presets", "empty.json"), "utf8")
        );
        if (categories.length) preset.categories = categories;
        const counts = await seedCatalog(preset);
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

    // Mark active + record the successful provision.
    await upsertStore({
      storeId: id,
      name: storeName,
      slug: id,
      industry: industry || "",
      databaseName: dbName,
      domain,
      status: "active",
    });
    await logActivity({
      operator: operatorOf(req),
      storeId: id,
      action: "Store provisioned",
      metadata: { db: dbName, admin: adminEmail, catalog: result.counts },
    });

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

// GET /api/stores/:id/deployments -> deployment history
app.get("/api/stores/:id/deployments", async (req, res) => {
  const p = platform();
  if (!p) return res.json({ deployments: [] });
  const deployments = await p.Deployment.find({ storeId: req.params.id })
    .sort({ deployedAt: -1 })
    .limit(50);
  res.json({ deployments });
});

// POST /api/stores/:id/deployments -> record a deployment
// body: { gitCommit?, version?, environment?, notes? }
app.post("/api/stores/:id/deployments", async (req, res) => {
  const p = platform();
  if (!p) {
    return res.status(400).json({ error: "Platform database not configured — deployments require PLATFORM_DATABASE" });
  }
  try {
    const store = await resolveStore(req.params.id);
    if (!store) return res.status(404).json({ error: "Unknown store" });
    const { gitCommit = "", version = "", environment = "production", notes = "" } = req.body;
    const deployment = await p.Deployment.create({
      storeId: store.id,
      gitCommit,
      version,
      environment,
      notes,
      deployedBy: operatorOf(req),
    });
    if (version) {
      await p.Store.updateOne({ storeId: store.id }, { $set: { currentVersion: version } });
    }
    await logActivity({
      operator: operatorOf(req),
      storeId: store.id,
      action: "Deployment completed",
      metadata: { version, gitCommit, environment },
    });
    res.json({ success: "Deployment recorded", deployment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
