/*
 * One-command store provisioning.
 *   node scripts/provision.js <manifest.json> [--force]
 *
 * Operator environment (secrets — never in the manifest):
 *   PROVISION_CLUSTER_URI=mongodb+srv://user:pass@cluster.mongodb.net
 *   CLOUDINARY_CLOUD_NAME= CLOUDINARY_API_KEY= CLOUDINARY_API_SECRET=
 *
 * Steps: load+validate manifest -> generate server/.env + client/.env ->
 * connect to the store's database -> apply StoreSettings (branding) ->
 * create admin -> seed catalog preset. Idempotent; --force overwrites .env.
 */
require("dotenv").config();
const crypto = require("crypto");
const readline = require("readline");
const mongoose = require("mongoose");
const { connect } = require("../config/db");
const { load, save, set } = require("../provisioning/loadManifest");
const { generateEnv, buildDatabaseUri } = require("../provisioning/generateEnv");
const { applyStoreSettings } = require("../provisioning/applyStoreSettings");
const { createAdminUser } = require("../provisioning/createAdminUser");
const { seedCatalog } = require("../provisioning/seedCatalog");

const argv = process.argv.slice(2);
const force = argv.includes("--force");
const file = argv.find((a) => !a.startsWith("--"));

const ask = (q) =>
  new Promise((res) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, (a) => {
      rl.close();
      res(a.trim());
    });
  });

async function run() {
  if (!file) {
    console.error("Usage: node scripts/provision.js <manifest.json> [--force]");
    process.exit(1);
  }

  let { manifest, missing } = load(file);

  // Interactive prompts ONLY fill missing required values, then write back to
  // the manifest (manifest stays the source of truth). Non-interactive runs
  // fail fast instead of hanging.
  if (missing.length) {
    if (!process.stdin.isTTY) {
      console.error("Missing required fields (no TTY to prompt): " + missing.join(", "));
      process.exit(1);
    }
    for (const key of missing) set(manifest, key, await ask(`Enter ${key}: `));
    save(file, manifest);
    ({ manifest } = load(file)); // reload to re-derive id-based defaults
  }

  // Admin password is a SECRET — generated if absent, shown once, NEVER written
  // to the manifest.
  let password = manifest.admin.password;
  let generated = false;
  if (!password) {
    password =
      crypto.randomBytes(12).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 14) + "9z";
    generated = true;
  }
  delete manifest.admin.password;

  const presetName = (manifest.store.catalog && manifest.store.catalog.preset) || "empty";
  if (!/^[a-z0-9-]+$/.test(presetName)) throw new Error(`Invalid catalog preset: ${presetName}`);

  // 1) Generate env files (server secrets + client REACT_APP_*).
  const envOut = generateEnv(manifest, { force });

  // 2) Connect to the store's own database.
  await connect(buildDatabaseUri(manifest.infrastructure.database.name));

  // 3) Branding/config, 4) admin, 5) catalog.
  await applyStoreSettings(manifest);
  const { created } = await createAdminUser({
    email: manifest.admin.email,
    password,
    name: manifest.admin.name,
  });
  const preset = require(`../provisioning/presets/${presetName}.json`);
  const counts = await seedCatalog(preset);

  await mongoose.disconnect();

  console.log("\n=== Store provisioned ===");
  console.log("Store      :", manifest.store.identity.storeName);
  console.log("Database   :", manifest.infrastructure.database.name);
  console.log("Cloudinary :", manifest.infrastructure.cloudinary.folder);
  console.log("Catalog    :", presetName, JSON.stringify(counts));
  console.log("Admin      :", manifest.admin.email, created ? "(created)" : "(updated)");
  if (generated) console.log("Admin password (shown once — save it):", password);
  console.log("Env files  :", envOut.serverPath);
  console.log("           :", envOut.clientPath);
  console.log("\nNext: start the API (npm run start:dev) and client (npm start).");
}

run().catch((e) => {
  console.error("Provisioning failed:", e.message);
  process.exit(1);
});
