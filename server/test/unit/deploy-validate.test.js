const { test } = require("node:test");
const assert = require("node:assert");
const { validateDeployment } = require("../../platform/deploy/validateSecrets");

const fullEnv = {
  PROVISION_CLUSTER_URI: "mongodb+srv://u:p@c.net",
  PLATFORM_DATABASE: "mongodb+srv://u:p@c.net/vce_platform",
  CLOUDINARY_CLOUD_NAME: "c",
  CLOUDINARY_API_KEY: "k",
  CLOUDINARY_API_SECRET: "s",
};
const store = { databaseName: "vce-x" };

test("validateDeployment: ok when all secrets present + whatsapp only", () => {
  const v = validateDeployment({ store, settings: { payment: { enabledProviders: ["whatsapp"], defaultProvider: "whatsapp" } }, env: fullEnv });
  assert.equal(v.ok, true);
  assert.equal(v.missing.length, 0);
});

test("validateDeployment: cloudinary missing blocks", () => {
  const v = validateDeployment({ store, settings: { payment: { enabledProviders: ["whatsapp"] } }, env: { ...fullEnv, CLOUDINARY_API_SECRET: "" } });
  assert.equal(v.ok, false);
  assert.ok(v.missing.some((m) => m.name === "cloudinary"));
});

test("validateDeployment: razorpay enabled without keys blocks", () => {
  const v = validateDeployment({ store, settings: { payment: { enabledProviders: ["razorpay"], defaultProvider: "razorpay" } }, env: fullEnv });
  assert.equal(v.ok, false);
  assert.ok(v.missing.some((m) => m.name === "payment"));
});

test("validateDeployment: default provider not enabled blocks", () => {
  const v = validateDeployment({ store, settings: { payment: { enabledProviders: ["whatsapp"], defaultProvider: "razorpay" } }, env: fullEnv });
  assert.equal(v.ok, false);
  assert.ok(v.missing.some((m) => m.name === "feature-compat"));
});
