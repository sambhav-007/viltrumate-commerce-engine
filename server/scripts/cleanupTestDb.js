/*
 * One-time cleanup: remove Aura Rare collections that were mistakenly created
 * in the shared `test` database (when the connection string had no DB name).
 * Only drops OUR collections — never touches other projects' data.
 * Run: node scripts/cleanupTestDb.js
 */
require("dotenv").config();
const mongoose = require("mongoose");

// Collections this app owns.
const OURS = [
  "categories",
  "products",
  "shades",
  "reviews",
  "banners",
  "storesettings",
  "customizes",
  "orders",
  "users",
];

// Build the `test` URI from the configured base (strip any db name/query).
function testUri() {
  const raw = process.env.DATABASE;
  const base = raw.split("?")[0].replace(/\/[^/]*$/, "");
  return `${base}/test`;
}

async function run() {
  const uri = testUri();
  console.log("Connecting to:", uri.replace(/:[^:@]*@/, ":****@"));
  const conn = await mongoose.createConnection(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const existing = (await conn.db.listCollections().toArray()).map((c) => c.name);
  console.log("Found in test:", existing.join(", ") || "(none)");

  for (const name of OURS) {
    if (existing.includes(name)) {
      await conn.db.dropCollection(name);
      console.log(`  dropped test.${name}`);
    }
  }
  console.log("Cleanup complete. Other projects' collections were left untouched.");
  await conn.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
