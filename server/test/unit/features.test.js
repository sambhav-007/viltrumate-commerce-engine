const { test } = require("node:test");
const assert = require("node:assert");
const features = require("../../config/features");

test("getFeatures: defaults + overrides merge", () => {
  features.setFeatureOverrides({});
  assert.equal(features.isFeatureEnabled("reviews"), true);
  assert.equal(features.isFeatureEnabled("coupons"), false);
  features.setFeatureOverrides({ coupons: true });
  assert.equal(features.isFeatureEnabled("coupons"), true);
  features.setFeatureOverrides({}); // reset
});

test("requireFeature: 403 when disabled, next() when enabled", () => {
  features.setFeatureOverrides({ inventory: false });
  let status = 0, nexted = false;
  const res = { status: (c) => ((status = c), { json: () => {} }) };
  features.requireFeature("inventory")({}, res, () => (nexted = true));
  assert.equal(status, 403);
  assert.equal(nexted, false);

  features.setFeatureOverrides({ inventory: true });
  nexted = false;
  features.requireFeature("inventory")({}, { status: () => ({ json: () => {} }) }, () => (nexted = true));
  assert.equal(nexted, true);
  features.setFeatureOverrides({});
});
