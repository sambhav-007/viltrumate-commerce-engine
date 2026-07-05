// Shared helpers for DB-backed integration/API tests. Tests are ISOLATED and
// never touch production data: they derive throwaway database names from the
// operator cluster and drop them in teardown. When no cluster is configured
// (PROVISION_CLUSTER_URI unset, no DATABASE fallback) the tests SKIP.
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const mongoose = require("mongoose");

const SERVER = path.join(__dirname, "..", "..");
const FLEET_FILE = path.join(SERVER, "provisioning", "fleet.json");
const STORES_DIR = path.join(SERVER, "provisioning", "stores");
const DEPLOY_DIR = path.join(SERVER, "deployments");
const QS = "?retryWrites=true&w=majority";
const RID = Math.random().toString(36).slice(2, 7);

function clusterRoot() {
  if (process.env.PROVISION_CLUSTER_URI) return process.env.PROVISION_CLUSTER_URI.replace(/\/+$/, "").split("?")[0];
  const db = process.env.DATABASE;
  const m = db && db.match(/^(mongodb(?:\+srv)?:\/\/[^/]+)\//);
  return m ? m[1] : null;
}
const hasCluster = () => !!clusterRoot();
const platformUri = (dbName) => `${clusterRoot()}/${dbName}${QS}`;
const names = { platform: `vce_platform_itest_${RID}`, store: (s) => `vce-itest-${RID}-${s}` };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function dropDb(dbName) {
  try {
    const c = mongoose.createConnection(`${clusterRoot()}/${dbName}${QS}`, { useNewUrlParser: true, useUnifiedTopology: true });
    await new Promise((res, rej) => { c.once("open", res); c.once("error", rej); });
    await c.dropDatabase();
    await c.close();
  } catch (e) { /* best-effort */ }
}

// Snapshot mutable repo files so store provisioning done by tests can be undone.
function snapshotRepo() {
  const fleet = fs.existsSync(FLEET_FILE) ? fs.readFileSync(FLEET_FILE, "utf8") : null;
  const stores = fs.existsSync(STORES_DIR) ? new Set(fs.readdirSync(STORES_DIR)) : new Set();
  return { fleet, stores };
}
function restoreRepo(snap) {
  if (snap.fleet != null) fs.writeFileSync(FLEET_FILE, snap.fleet);
  if (fs.existsSync(STORES_DIR)) {
    for (const f of fs.readdirSync(STORES_DIR)) {
      if (!snap.stores.has(f)) { try { fs.unlinkSync(path.join(STORES_DIR, f)); } catch (e) {} }
    }
  }
}
function cleanupDeployDir(storeId) {
  const d = path.join(DEPLOY_DIR, storeId);
  try { if (fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true }); } catch (e) {}
}

// Spawn the panel on an isolated platform db + test port. Resolves once ready.
async function spawnPanel({ port, key }) {
  const proc = spawn("node", ["panel.js"], {
    cwd: SERVER,
    env: {
      ...process.env,
      PROVISION_CLUSTER_URI: clusterRoot(),
      PLATFORM_DATABASE: platformUri(names.platform),
      PANEL_KEY: key,
      PANEL_PORT: String(port),
    },
  });
  proc.stdout.on("data", () => {});
  proc.stderr.on("data", () => {});
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(base + "/health"); if (r.ok) return { proc, base }; } catch (e) {}
    await sleep(500);
  }
  throw new Error("panel did not become ready");
}

function apiClient(base, key, operator = "itest@agency") {
  return async (p, opts = {}) => {
    const r = await fetch(base + "/api" + p, {
      ...opts,
      headers: { "Content-Type": "application/json", "x-panel-key": key, "x-panel-operator": operator, ...(opts.headers || {}) },
    });
    const ct = r.headers.get("content-type") || "";
    const d = ct.includes("json") ? await r.json().catch(() => ({})) : await r.text();
    return { status: r.status, d };
  };
}

module.exports = {
  hasCluster, clusterRoot, platformUri, names, dropDb, snapshotRepo, restoreRepo,
  cleanupDeployDir, spawnPanel, apiClient, sleep, mongoose, QS, SERVER,
};
