const { test } = require("node:test");
const assert = require("node:assert");
const { validateManifest } = require("../../pluginHost/validate");

const good = {
  id: "announcements", name: "Announcements", version: "1.0.0",
  description: "d", author: "VCE", permissions: ["admin"],
  routes: [{ method: "GET", path: "active" }],
  featureFlags: [{ flag: "bar", default: true }],
  settings: { schema: [{ key: "x", type: "text", default: "" }] },
};

test("validateManifest: accepts a well-formed manifest", () => {
  assert.equal(validateManifest(good).ok, true);
});

test("validateManifest: requires id/name/version/description/author", () => {
  const v = validateManifest({ id: "Bad Id", version: "x" });
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => /id/.test(e)));
  assert.ok(v.errors.some((e) => /version/.test(e)));
  assert.ok(v.errors.some((e) => /name/.test(e)));
  assert.ok(v.errors.some((e) => /author/.test(e)));
});

test("validateManifest: rejects illegal route paths + bad method", () => {
  assert.equal(validateManifest({ ...good, routes: [{ method: "GET", path: "/leading" }] }).ok, false);
  assert.equal(validateManifest({ ...good, routes: [{ method: "GET", path: "../escape" }] }).ok, false);
  assert.equal(validateManifest({ ...good, routes: [{ method: "TELEPORT", path: "x" }] }).ok, false);
});

test("validateManifest: array-typed fields must be arrays", () => {
  assert.equal(validateManifest({ ...good, permissions: "admin" }).ok, false);
});
