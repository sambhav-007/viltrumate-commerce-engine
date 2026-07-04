/*
 * Restore a backup made by scripts/backupDb.js.
 *   node scripts/restoreDb.js <backup-dir> [--db <name> | --uri <mongo-uri>] [--wipe]
 *
 * <backup-dir> is a timestamp directory containing <collection>.jsonl files.
 * Without --wipe, documents are inserted alongside existing ones (duplicate
 * _ids are skipped). With --wipe, each collection present in the backup is
 * emptied first — full point-in-time restore.
 *
 * SAFETY: refuses to run without an explicit --db/--uri so a backup can never
 * be restored into an unintended database by a stale env file.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { createConnection } = require("../config/db");
const { buildDatabaseUri } = require("../provisioning/generateEnv");
const ejson = require("../config/ejson");

const argv = process.argv.slice(2);
const wipe = argv.includes("--wipe");
const arg = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i > -1 ? argv[i + 1] : undefined;
};
const dir = argv.find((a) => !a.startsWith("--") && a !== arg("db") && a !== arg("uri"));

async function run() {
  if (!dir || !fs.existsSync(dir)) throw new Error("Backup directory not found");
  const uri = arg("uri") || (arg("db") && buildDatabaseUri(arg("db")));
  if (!uri) throw new Error("Explicit --db or --uri is required (safety guard)");

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  if (!files.length) throw new Error("No .jsonl files in that directory");

  const conn = await createConnection(uri);
  const db = conn.db;
  console.log(`Restoring into "${db.databaseName}" (${wipe ? "wipe" : "merge"})…`);

  for (const file of files) {
    const name = file.replace(/\.jsonl$/, "");
    const lines = fs
      .readFileSync(path.join(dir, file), "utf8")
      .split("\n")
      .filter(Boolean);
    const docs = lines.map((l) => ejson.parse(l));
    const coll = db.collection(name);
    if (wipe) await coll.deleteMany({});
    let inserted = 0;
    if (docs.length) {
      try {
        const r = await coll.insertMany(docs, { ordered: false });
        inserted = r.insertedCount;
      } catch (e) {
        inserted = (e.result && e.result.nInserted) || 0; // dup _ids skipped
      }
    }
    console.log(`  ${name.padEnd(20)} ${inserted}/${docs.length} docs`);
  }
  await conn.close();
  console.log("\nRestore complete.");
}

run().catch((e) => {
  console.error("Restore failed:", e.message);
  process.exit(1);
});
