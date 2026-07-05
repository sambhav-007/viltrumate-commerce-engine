// Commerce model integration tests against an ISOLATED store database.
// DB-gated: skipped unless a cluster is configured. Drops its db in teardown.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const mongoose = require("mongoose");
const h = require("../helpers/db");

if (!h.hasCluster()) {
  test("commerce integration (skipped: no test cluster configured)", { skip: "set PROVISION_CLUSTER_URI to run" }, () => {});
  return;
}

const DB = h.names.store("commerce");
const StoreSettings = require("../../models/storeSettings");
const Category = require("../../models/categories");
const Product = require("../../models/products");
const Variant = require("../../models/variants");
const Coupon = require("../../models/coupons");
const Order = require("../../models/orders");
const features = require("../../config/features");
const inventory = require("../../config/inventory");

before(async () => {
  await mongoose.connect(`${h.clusterRoot()}/${DB}${h.QS}`, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true });
});
after(async () => {
  try { await mongoose.connection.dropDatabase(); } catch (e) {}
  await mongoose.disconnect();
});

test("StoreSettings: singleton with schema defaults", async () => {
  const s = await StoreSettings.create({ storeName: "Commerce Test" });
  assert.equal(s.storeName, "Commerce Test");
  assert.equal(s.features.reviews, true); // default on
  assert.equal(s.features.inventory, false); // default off
  assert.ok(s.payment.enabledProviders.includes("whatsapp"));
});

test("categories + products + variants: create + relate", async () => {
  const cat = await Category.create({ name: "Rings", slug: "rings", status: "Active", order: 0 });
  const prod = await Product.create({ name: "Gold Ring", slug: "gold-ring", category: cat._id, status: "Active" });
  const v = await Variant.create({ product: prod._id, name: "Default", slug: "gold-ring-default", price: 999, mrp: 1299, status: "Active" });
  assert.equal((await Variant.findById(v._id)).product.toString(), prod._id.toString());
  assert.equal(await Product.countDocuments({ category: cat._id }), 1);
});

test("inventory: confirm decrements, cancel restores (feature-gated)", async () => {
  features.setFeatureOverrides({ inventory: true });
  const prod = await Product.create({ name: "Stocked", slug: "stocked", category: (await Category.findOne({}))._id, status: "Active" });
  const v = await Variant.create({ product: prod._id, name: "S", slug: "stocked-s", price: 100, status: "Active", stock: 10 });
  const order = { items: [{ variantId: v._id, qty: 3 }] };
  await inventory.applyOrderTransition(order, "pending", "confirmed");
  assert.equal((await Variant.findById(v._id)).stock, 7);
  await inventory.applyOrderTransition(order, "confirmed", "cancelled");
  assert.equal((await Variant.findById(v._id)).stock, 10);
  assert.equal(await inventory.lowStockCount(5), 0);
  features.setFeatureOverrides({});
});

test("inventory: no movement when feature disabled", async () => {
  features.setFeatureOverrides({ inventory: false });
  const prod = await Product.create({ name: "Untracked", slug: "untracked", category: (await Category.findOne({}))._id, status: "Active" });
  const v = await Variant.create({ product: prod._id, name: "U", slug: "untracked-u", price: 100, status: "Active", stock: 5 });
  await inventory.applyOrderTransition({ items: [{ variantId: v._id, qty: 2 }] }, "pending", "confirmed");
  assert.equal((await Variant.findById(v._id)).stock, 5); // untouched
});

test("coupons: persist + discountFor from a fetched doc", async () => {
  await Coupon.create({ code: "save10", type: "percent", value: 10, minCart: 200, status: "Active" });
  const c = await Coupon.findOne({ code: "SAVE10" }); // stored uppercase
  assert.ok(c);
  assert.equal(c.discountFor(100), 0); // below minCart
  assert.equal(c.discountFor(1000), 100); // 10%
});

test("orders: create + read", async () => {
  const o = await Order.create({ items: [{ productName: "Gold Ring", qty: 1, price: 999 }], total: 999, status: "pending", customer: { name: "Buyer", phone: "9990001111" } });
  const found = await Order.findById(o._id);
  assert.equal(found.total, 999);
  assert.equal(found.status, "pending");
});
