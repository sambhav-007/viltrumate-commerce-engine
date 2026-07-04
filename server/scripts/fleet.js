/*
 * Fleet operations across all client stores from one place.
 *   node scripts/fleet.js list                       show registered stores
 *   node scripts/fleet.js health                     ping every store's /api/health
 *   node scripts/fleet.js backup [--out <dir>]       backup every store's database
 *   node scripts/fleet.js reapply                    re-apply each store's manifest
 *                                                    (StoreSettings re-brand, idempotent)
 *
 * Registry: server/provisioning/fleet.json — an array of store entries:
 *   [{ "name": "Acme Glow", "manifest": "../stores/acme-glow.json" }]
 * Manifest paths are relative to the fleet.json location. The registry is
 * secret-free (like manifests); cluster credentials come from the operator env.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { execFileSync } = require("child_process");
const { load } = require("../provisioning/loadManifest");
const { applyIndustry } = require("../provisioning/applyIndustry");

const FLEET_FILE = path.join(__dirname, "..", "provisioning", "fleet.json");
const cmd = process.argv[2];
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

function loadFleet() {
  if (!fs.existsSync(FLEET_FILE)) {
    console.error(`No fleet registry at ${FLEET_FILE}.`);
    console.error('Create it: [{ "name": "Store", "manifest": "../stores/store.json" }]');
    process.exit(1);
  }
  const entries = JSON.parse(fs.readFileSync(FLEET_FILE, "utf8"));
  return entries.map((e) => {
    const manifestPath = path.resolve(path.dirname(FLEET_FILE), e.manifest);
    const { manifest } = load(manifestPath);
    applyIndustry(manifest); // same normalization provisioning applies
    return { entry: e, manifest, manifestPath };
  });
}

const ping = (url) =>
  new Promise((resolve) => {
    try {
      const u = new URL(`${url.replace(/\/+$/, "")}/api/health`);
      const mod = u.protocol === "http:" ? http : https;
      const req = mod.get(u, { timeout: 7000 }, (res) => {
        res.resume();
        resolve(res.statusCode === 200 ? "OK" : `HTTP ${res.statusCode}`);
      });
      req.on("error", (e) => resolve(`DOWN (${e.code || e.message})`));
      req.on("timeout", () => {
        req.destroy();
        resolve("TIMEOUT");
      });
    } catch (e) {
      resolve("BAD URL");
    }
  });

async function run() {
  const stores = loadFleet();

  if (cmd === "list") {
    for (const s of stores) {
      const i = s.manifest.infrastructure;
      console.log(
        `${(s.manifest.store.identity.storeName || s.entry.name).padEnd(24)}` +
          ` db=${i.database.name.padEnd(20)} api=${i.api.url}`
      );
    }
    return;
  }

  if (cmd === "health") {
    for (const s of stores) {
      const name = s.manifest.store.identity.storeName || s.entry.name;
      const status = await ping(s.manifest.infrastructure.api.url);
      console.log(`${name.padEnd(24)} ${status}`);
    }
    return;
  }

  if (cmd === "backup") {
    const out = arg("out");
    for (const s of stores) {
      const db = s.manifest.infrastructure.database.name;
      console.log(`\n=== ${db} ===`);
      const args = [path.join(__dirname, "backupDb.js"), "--db", db];
      if (out) args.push("--out", out);
      execFileSync(process.execPath, args, { stdio: "inherit" });
    }
    return;
  }

  if (cmd === "reapply") {
    // Re-applies StoreSettings from each manifest (branding/theme/features/
    // payment) — the fleet-wide "rebrand/upgrade settings" pass. Catalog and
    // env files are NOT touched (that's provision.js per store).
    const mongoose = require("mongoose");
    const { buildDatabaseUri } = require("../provisioning/generateEnv");
    const { connect } = require("../config/db");
    const { applyStoreSettings } = require("../provisioning/applyStoreSettings");
    for (const s of stores) {
      const db = s.manifest.infrastructure.database.name;
      process.stdout.write(`${db.padEnd(24)} `);
      await connect(buildDatabaseUri(db));
      await applyStoreSettings(s.manifest);
      await mongoose.disconnect();
      console.log("settings re-applied");
    }
    return;
  }

  console.error("Usage: node scripts/fleet.js <list|health|backup|reapply>");
  process.exit(1);
}

run().catch((e) => {
  console.error("Fleet command failed:", e.message);
  process.exit(1);
});
