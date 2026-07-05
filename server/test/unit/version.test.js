const { test } = require("node:test");
const assert = require("node:assert");
const { bumpVersion } = require("../../platform/deploy/version");

test("bumpVersion: first version is 1.0.0 from empty/invalid", () => {
  assert.equal(bumpVersion("", "patch"), "1.0.0");
  assert.equal(bumpVersion(null, "minor"), "1.0.0");
  assert.equal(bumpVersion("garbage", "major"), "1.0.0");
});

test("bumpVersion: patch/minor/major", () => {
  assert.equal(bumpVersion("1.0.0", "patch"), "1.0.1");
  assert.equal(bumpVersion("1.0.9", "minor"), "1.1.0");
  assert.equal(bumpVersion("1.2.3", "major"), "2.0.0");
  assert.equal(bumpVersion("1.2.3"), "1.2.4"); // default patch
});
