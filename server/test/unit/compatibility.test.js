const { test } = require("node:test");
const assert = require("node:assert");
const { checkCompatibility } = require("../../platform/migrations/compatibility");

const env = { PROVISION_CLUSTER_URI: "x", PLATFORM_DATABASE: "y" };

test("checkCompatibility: ok for a normal store", () => {
  const c = checkCompatibility({ store: {}, settings: { payment: { enabledProviders: ["whatsapp"], defaultProvider: "whatsapp" }, features: {} }, env });
  assert.equal(c.ok, true);
  assert.equal(c.failed.length, 0);
});

test("checkCompatibility: default provider not enabled fails", () => {
  const c = checkCompatibility({ store: {}, settings: { payment: { enabledProviders: ["whatsapp"], defaultProvider: "razorpay" } }, env });
  assert.equal(c.ok, false);
  assert.ok(c.failed.some((f) => f.name === "payment"));
});

test("checkCompatibility: missing env fails", () => {
  const c = checkCompatibility({ store: {}, settings: { payment: {} }, env: {} });
  assert.equal(c.ok, false);
  assert.ok(c.failed.some((f) => f.name === "env"));
});
