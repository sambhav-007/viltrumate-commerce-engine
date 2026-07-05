const { test } = require("node:test");
const assert = require("node:assert");
const Coupon = require("../../models/coupons");

// discountFor is a pure schema method — construct in-memory docs (no DB needed).
const mk = (o) => new Coupon(o);

test("discountFor: flat + percent", () => {
  assert.equal(mk({ code: "F", type: "flat", value: 100, status: "Active" }).discountFor(500), 100);
  assert.equal(mk({ code: "P", type: "percent", value: 10, status: "Active" }).discountFor(500), 50);
});

test("discountFor: clamps to cart total", () => {
  assert.equal(mk({ code: "BIG", type: "flat", value: 999, status: "Active" }).discountFor(300), 300);
});

test("discountFor: respects minCart", () => {
  const c = mk({ code: "M", type: "flat", value: 50, minCart: 400, status: "Active" });
  assert.equal(c.discountFor(300), 0);
  assert.equal(c.discountFor(500), 50);
});

test("discountFor: disabled / expired / exhausted give 0", () => {
  assert.equal(mk({ code: "D", type: "flat", value: 50, status: "Disabled" }).discountFor(500), 0);
  assert.equal(mk({ code: "E", type: "flat", value: 50, status: "Active", expiresAt: new Date(Date.now() - 1000) }).discountFor(500), 0);
  assert.equal(mk({ code: "U", type: "flat", value: 50, status: "Active", maxUses: 5, usedCount: 5 }).discountFor(500), 0);
});
