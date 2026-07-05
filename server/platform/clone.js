// ============================================================================
// Store cloning (Phase Μ) — copy REUSABLE parts of one store into a fresh store
// database. snapshotStore() reads from the currently-connected source DB;
// writeClone() writes into the currently-connected (fresh) destination DB. The
// panel runs each within its own withStoreDb() call (the two stores are never
// open on the same connection at once).
//
// NEVER cloned: orders, customers/users, reviews, coupons, analytics, activity,
// admin passwords. Every clone gets its own database and a fresh admin.
// ============================================================================
const StoreSettings = require("../models/storeSettings");
const Category = require("../models/categories");
const Product = require("../models/products");
const Shade = require("../models/shades"); // the "variant" collection (legacy name)
const Banner = require("../models/banners");

// True when any option needs categories present (categories/products/navigation).
const needsCategories = (o) => !!(o.categories || o.products || o.navigation);

// Read selected parts of the current (source) store into a plain snapshot.
async function snapshotStore(options = {}) {
  const snap = { options };
  if (options.appearance || options.settings || options.content) {
    const s = await StoreSettings.findOne({});
    snap.settings = s ? s.toObject({ flattenMaps: true }) : {};
  }
  if (needsCategories(options)) snap.categories = await Category.find({}).sort({ order: 1 }).lean();
  if (options.products) {
    snap.products = await Product.find({}).lean();
    snap.variants = await Shade.find({}).lean();
  }
  if (options.pages) snap.banners = await Banner.find({}).sort({ order: 1 }).lean();
  return snap;
}

// Write a snapshot into the current (fresh, empty) destination store.
async function writeClone(snap, options = {}) {
  const result = { categories: 0, products: 0, variants: 0, banners: 0 };

  // --- Settings (appearance / settings / content) ---
  if (snap.settings && (options.appearance || options.settings || options.content)) {
    let doc = await StoreSettings.findOne({});
    if (!doc) doc = new StoreSettings({});
    const s = snap.settings;
    if (options.appearance) {
      doc.theme = s.theme;
      doc.layout = s.layout;
    }
    if (options.settings) {
      doc.features = s.features;
      doc.payment = {
        enabledProviders: (s.payment && s.payment.enabledProviders) || ["whatsapp"],
        defaultProvider: (s.payment && s.payment.defaultProvider) || "whatsapp",
      };
      doc.seo = s.seo;
      doc.variantLabel = s.variantLabel;
    }
    if (options.content) {
      doc.content = s.content;
      doc.stats = s.stats;
      doc.heroHeading = s.heroHeading;
      doc.heroSubheading = s.heroSubheading;
    }
    await doc.save();
  }

  // --- Categories (also needed for products / navigation) ---
  const catMap = {}; // old _id -> new _id
  if (snap.categories && needsCategories(options)) {
    for (const c of snap.categories) {
      const nc = await Category.create({
        name: c.name,
        slug: c.slug,
        description: c.description || "",
        image: c.image || null,
        status: c.status || "Active",
        order: c.order || 0,
      });
      catMap[String(c._id)] = nc._id;
      result.categories++;
    }
  }

  // --- Products + variants (structure only; stock reset to untracked) ---
  if (options.products && snap.products) {
    const prodMap = {};
    for (const p of snap.products) {
      const np = await Product.create({
        name: p.name,
        slug: p.slug,
        description: p.description || "",
        category: catMap[String(p.category)] || null,
        coverImage: p.coverImage || null,
        isFeatured: !!p.isFeatured,
        status: p.status || "Active",
      });
      prodMap[String(p._id)] = np._id;
      result.products++;
    }
    const vdocs = (snap.variants || [])
      .filter((v) => prodMap[String(v.product)])
      .map((v) => ({
        product: prodMap[String(v.product)],
        name: v.name,
        slug: v.slug,
        price: v.price,
        mrp: v.mrp,
        description: v.description || "",
        images: v.images || [],
        status: v.status || "Active",
        order: v.order || 0,
        stock: null, // do not carry live inventory into a clone
      }));
    if (vdocs.length) {
      await Shade.insertMany(vdocs);
      result.variants = vdocs.length;
    }
  }

  // --- Pages (homepage banners/slides) ---
  if (options.pages && snap.banners) {
    for (const b of snap.banners) {
      await Banner.create({
        image: b.image,
        heading: b.heading || "",
        subheading: b.subheading || "",
        link: b.link || "",
        order: b.order || 0,
        active: b.active !== false,
      });
      result.banners++;
    }
  }

  return result;
}

module.exports = { snapshotStore, writeClone };
