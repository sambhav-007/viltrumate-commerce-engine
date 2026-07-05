const { test } = require("node:test");
const assert = require("node:assert");
const { validateImport, previewOf, INCLUDE_KEYS } = require("../../platform/templates");

test("INCLUDE_KEYS covers the reusable sections", () => {
  for (const k of ["theme", "layout", "content", "stats", "features", "payment", "seo", "categories"]) {
    assert.ok(INCLUDE_KEYS.includes(k), `missing include key ${k}`);
  }
});

test("validateImport: accepts a well-formed template", () => {
  const v = validateImport({ name: "T", config: { theme: {}, categories: [] } });
  assert.equal(v.ok, true);
});

test("validateImport: rejects missing name / config", () => {
  assert.equal(validateImport({ config: {} }).ok, false);
  assert.equal(validateImport({ name: "T" }).ok, false);
  assert.equal(validateImport(null).ok, false);
});

test("validateImport: rejects merchant data leakage", () => {
  for (const bad of ["orders", "customers", "users", "reviews", "analytics", "activity", "products"]) {
    const v = validateImport({ name: "T", config: { [bad]: [1] } });
    assert.equal(v.ok, false, `${bad} should be rejected`);
    assert.ok(v.errors.some((e) => e.includes(bad)));
  }
});

test("previewOf: returns a secret-free renderable subset", () => {
  const pv = previewOf({ name: "T", version: "1.0.0", config: { theme: { colors: { accent: "#111" }, motion: "reduced" }, layout: { home: "catalog" }, navigation: ["A"], features: { wishlist: true }, heroHeading: "Hi" } });
  assert.equal(pv.layout, "catalog");
  assert.deepEqual(pv.navigation, ["A"]);
  assert.equal(pv.theme.motion, "reduced");
  assert.equal(pv.hero.heading, "Hi");
});
