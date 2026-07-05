const { test } = require("node:test");
const assert = require("node:assert");
const { baseSlug } = require("../../config/slug");

test("baseSlug: lowercases + strips + hyphenates", () => {
  assert.equal(baseSlug("Gold Ring"), "gold-ring");
  assert.equal(baseSlug("  Café Déluxe!! "), "cafe-deluxe");
  assert.equal(baseSlug("KickCo 2.0"), "kickco-20");
});
