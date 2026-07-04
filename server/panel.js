/*
 * VCE Panel — the agency control plane. One UI to create client stores and
 * manage every store's theme, typography, layout, payment, features, trust
 * stats and section locks — across all fleet databases, without touching any
 * client's admin panel.
 *
 *   cd server && npm run panel          # http://localhost:8100
 *
 * Operator environment (same as provisioning):
 *   PROVISION_CLUSTER_URI=mongodb+srv://user:pass@cluster.mongodb.net
 *   PANEL_KEY=...        access key (auto-generated + printed if unset)
 *   PANEL_PORT=8100      optional
 *
 * Stores live in the fleet registry (provisioning/fleet.json) with their
 * manifests under provisioning/stores/. Settings writes go straight into the
 * target store's own database via the default mongoose connection, one store
 * at a time (an ops tool, not a high-concurrency API).
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
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

const PORT = Number(process.env.PANEL_PORT) || 8100;
const KEY = process.env.PANEL_KEY || crypto.randomBytes(18).toString("base64url");
const FLEET_FILE = path.join(__dirname, "provisioning", "fleet.json");
const STORES_DIR = path.join(__dirname, "provisioning", "stores");

/* ---------- fleet registry ---------- */
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

/* ---------- one-store-at-a-time DB access ---------- */
let queue = Promise.resolve();
const withStoreDb = (dbName, fn) => {
  const run = queue.then(async () => {
    await connect(buildDatabaseUri(dbName));
    try {
      return await fn();
    } finally {
      await mongoose.disconnect();
    }
  });
  queue = run.catch(() => {}); // keep the queue alive after failures
  return run;
};

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

// GET /api/stores -> fleet registry (no DB round-trips; details are per-store)
app.get("/api/stores", (req, res) => {
  const stores = readFleet().map((e) => {
    try {
      const { manifest } = loadStore(e.id);
      return {
        id: e.id,
        name: manifest.store.identity.storeName,
        industry: manifest.store.industry || "",
        db: manifest.infrastructure.database.name,
        apiUrl: manifest.infrastructure.api.url,
        clientUrl: manifest.infrastructure.client.url,
      };
    } catch (err) {
      return { id: e.id, name: e.name || e.id, error: "manifest unreadable" };
    }
  });
  res.json({ stores });
});

// POST /api/stores -> create + provision a new store (DB side; env files and
// deployment are a separate step — see docs/DEPLOYMENT.md).
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
    // A store registered by a previously-failed provision can be re-run with
    // retry:true (all DB steps are idempotent); otherwise duplicates are an error.
    const existing = readFleet().some((e) => e.id === id);
    if (existing && !req.body.retry) {
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

    // Persist manifest + register in the fleet BEFORE touching the DB, so a
    // failed provision is visible and re-runnable (all steps are idempotent).
    fs.mkdirSync(STORES_DIR, { recursive: true });
    const manifestPath = path.join(STORES_DIR, `${id}.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    if (!existing) {
      writeFleet([...readFleet(), { id, name: storeName, manifest: `./stores/${id}.json` }]);
    }

    const password =
      crypto.randomBytes(12).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 14) + "9z";

    const result = await withStoreDb(manifest.infrastructure.database.name, async () => {
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

    return res.json({
      success: `Store "${storeName}" provisioned`,
      id,
      db: manifest.infrastructure.database.name,
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
    const store = loadStore(req.params.id);
    if (!store) return res.status(404).json({ error: "Unknown store" });
    const settings = await withStoreDb(
      store.manifest.infrastructure.database.name,
      async () => {
        let doc = await StoreSettings.findOne({});
        if (!doc) doc = await StoreSettings.create({});
        return doc.toObject({ flattenMaps: true });
      }
    );
    return res.json({ store: { id: store.entry.id }, settings });
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

app.put("/api/stores/:id/settings", async (req, res) => {
  try {
    const store = loadStore(req.params.id);
    if (!store) return res.status(404).json({ error: "Unknown store" });
    const settings = await withStoreDb(
      store.manifest.infrastructure.database.name,
      async () => {
        let doc = await StoreSettings.findOne({});
        if (!doc) doc = new StoreSettings({});
        FLAT.forEach((k) => {
          if (req.body[k] !== undefined) doc[k] = req.body[k];
        });
        OBJECTS.forEach((k) => {
          if (req.body[k] !== undefined) doc[k] = req.body[k];
        });
        await doc.save();
        return doc.toObject({ flattenMaps: true });
      }
    );
    return res.json({ success: "Settings updated", settings });
  } catch (err) {
    return res.status(500).json({ error: `Failed to update: ${err.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`\nVCE Panel  →  http://localhost:${PORT}`);
  if (!process.env.PANEL_KEY) {
    console.log(`Panel key (set PANEL_KEY to make it permanent): ${KEY}`);
  }
  if (!process.env.PROVISION_CLUSTER_URI) {
    console.log("⚠ PROVISION_CLUSTER_URI is not set — store operations will fail.");
  }
});
