const Category = require("../models/categories");
const Product = require("../models/products");
const Shade = require("../models/shades"); // the "variant" collection (legacy name)
const Review = require("../models/reviews");
const { baseSlug } = require("../config/slug");

const pad2 = (n) => String(n).padStart(2, "0");

// Load a catalog preset into the connected database. Data-driven (replaces the
// old hardcoded Aura Rare seed): each preset describes categories, products and
// how each product's variants are generated. The "empty" preset creates nothing
// — the default for real client stores, which add products via the admin.
// Variant/product schemas are unchanged (still the "shades" collection).
async function seedCatalog(preset, { clear = true } = {}) {
  if (clear) {
    await Promise.all([
      Category.deleteMany({}),
      Product.deleteMany({}),
      Shade.deleteMany({}),
      Review.deleteMany({}),
    ]);
  }

  const cats = {};
  let order = 0;
  for (const name of preset.categories || []) {
    cats[name] = await Category.create({
      name,
      slug: baseSlug(name),
      description: `${name}`,
      status: "Active",
      order: order++,
    });
  }

  let products = 0;
  let variants = 0;
  for (const p of preset.products || []) {
    const product = await Product.create({
      name: p.name,
      slug: baseSlug(p.name),
      description: p.description || `${p.name}`,
      category: cats[p.category]._id,
      isFeatured: !!p.featured,
      status: "Active",
    });

    const names =
      p.mode === "named"
        ? preset.namedVariants || []
        : Array.from({ length: p.count || 0 }, (_, i) => `Shade ${pad2(i + 1)}`);

    const docs = names.map((nm, i) => ({
      product: product._id,
      name: nm,
      slug: `${baseSlug(p.name)}-${baseSlug(nm)}-${i}`,
      price: p.price,
      mrp: p.mrp,
      status: "Active",
      images: [],
    }));
    const made = docs.length ? await Shade.insertMany(docs) : [];

    if (made[0] && (preset.reviewsOnFirstVariant || []).length) {
      await Review.create(
        preset.reviewsOnFirstVariant.map((r) => ({
          ...r,
          shade: made[0]._id,
          product: product._id,
        }))
      );
    }

    products += 1;
    variants += made.length;
  }

  return { categories: (preset.categories || []).length, products, variants };
}

module.exports = { seedCatalog };
