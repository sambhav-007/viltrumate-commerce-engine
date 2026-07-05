const { test } = require("node:test");
const assert = require("node:assert");
const { buildPackage } = require("../../platform/deploy/packageBuilder");

const ctx = () => ({
  store: { storeId: "demo", name: "Demo", databaseName: "vce-demo", domain: "https://demo.test", industry: "jewelry" },
  settings: { storeName: "Demo", payment: { enabledProviders: ["whatsapp"], defaultProvider: "whatsapp" }, features: { wishlist: true } },
  manifest: null,
  version: "1.0.0",
  vceVersion: "1.2.0",
  gitCommit: "abc123",
  environment: "production",
  env: { PROVISION_CLUSTER_URI: "mongodb+srv://u:p@c.mongodb.net", CLOUDINARY_CLOUD_NAME: "c", CLOUDINARY_API_KEY: "k", CLOUDINARY_API_SECRET: "s" },
});

test("buildPackage: emits all 8 files", () => {
  const { files } = buildPackage(ctx());
  assert.deepEqual(Object.keys(files).sort(), [
    "README.md", "SECRETS.md", "backend.env", "deployment.json", "frontend.env", "healthcheck.json", "nginx.conf.example", "start.sh",
  ].sort());
});

test("buildPackage: secrets ONLY in backend.env", () => {
  const { files } = buildPackage(ctx());
  assert.match(files["backend.env"], /DATABASE=mongodb/);
  assert.match(files["backend.env"], /JWT_SECRET=[0-9a-f]{96}/);
  // no secret material leaks into the other files
  for (const f of ["frontend.env", "deployment.json", "healthcheck.json", "README.md", "nginx.conf.example"]) {
    assert.doesNotMatch(files[f], /mongodb\+srv:\/\//, `${f} must not contain a db URI`);
    assert.doesNotMatch(files[f], /JWT_SECRET=[0-9a-f]/, `${f} must not contain the jwt secret`);
  }
});

test("buildPackage: healthcheck + deployment.json carry vceVersion", () => {
  const b = buildPackage(ctx());
  assert.equal(b.healthcheck.vceVersion, "1.2.0");
  assert.equal(b.deploymentJson.vceVersion, "1.2.0");
  assert.ok(b.healthcheck.api.endsWith("/api/store-settings"));
});

test("buildPackage: rollback metadata is non-secret + sufficient", () => {
  const b = buildPackage(ctx());
  assert.equal(b.rollback.databaseName, "vce-demo");
  assert.equal(b.rollback.version, "1.0.0");
});
