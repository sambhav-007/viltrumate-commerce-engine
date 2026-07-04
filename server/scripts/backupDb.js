/*
 * Per-store database backup (dependency-free — no mongodump needed).
 *   node scripts/backupDb.js [--db <name>] [--uri <mongo-uri>] [--out <dir>]
 *
 * URI resolution: --uri wins; else --db + PROVISION_CLUSTER_URI; else env
 * DATABASE (this store's own db). Every collection is dumped as JSON lines
 * (one document per line, Mongo Extended JSON) into
 *   <out>/<dbName>/<timestamp>/<collection>.jsonl
 * Restore with scripts/restoreDb.js.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { createConnection } = require("../config/db");
const { buildDatabaseUri } = require("../provisioning/generateEnv");
const ejson = require("../config/ejson");

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

function resolveUri() {
  if (arg("uri")) return arg("uri");
  if (arg("db")) return buildDatabaseUri(arg("db"));
  if (process.env.DATABASE) return process.env.DATABASE;
  throw new Error("Provide --uri, or --db with PROVISION_CLUSTER_URI, or set DATABASE");
}

async function run() {
  const uri = resolveUri();
  const outRoot = arg("out") || path.resolve(__dirname, "..", "..", "backups");
  const conn = await createConnection(uri);
  const db = conn.db;
  const dbName = db.databaseName;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(outRoot, dbName, stamp);
  fs.mkdirSync(dir, { recursive: true });

  const collections = (await db.listCollections().toArray()).map((c) => c.name);
  let total = 0;
  for (const name of collections) {
    const docs = await db.collection(name).find({}).toArray();
    const file = path.join(dir, `${name}.jsonl`);
    // One doc per line, Extended JSON (ObjectId/Date preserved for restore).
    fs.writeFileSync(file, docs.map((d) => ejson.stringify(d)).join("\n") + "\n");
    console.log(`  ${name.padEnd(20)} ${docs.length} docs`);
    total += docs.length;
  }
  await conn.close();
  console.log(`\nBackup complete: ${dir} (${collections.length} collections, ${total} docs)`);
}

run().catch((e) => {
  console.error("Backup failed:", e.message);
  process.exit(1);
});
