const Variant = require("../models/variants");
const Review = require("../models/reviews");

// Attach { variantCount, shadeCount, minPrice, rating: { avg, count } } to lean
// products. `shadeCount` is retained as an alias for wire back-compat.
async function attachVariantStats(products) {
  if (!products || !products.length) return products;
  const ids = products.map((p) => p._id);
  const [stats, ratings] = await Promise.all([
    Variant.aggregate([
      { $match: { product: { $in: ids } } },
      {
        $group: {
          _id: "$product",
          count: { $sum: 1 },
          minPrice: { $min: "$price" },
        },
      },
    ]),
    Review.aggregate([
      { $match: { product: { $in: ids }, approved: true } },
      {
        $group: {
          _id: "$product",
          avg: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);
  const sMap = {};
  stats.forEach((s) => (sMap[s._id] = s));
  const rMap = {};
  ratings.forEach((r) => (rMap[r._id] = r));
  products.forEach((p) => {
    const st = sMap[p._id];
    p.variantCount = st ? st.count : 0;
    p.shadeCount = p.variantCount; // back-compat alias
    p.minPrice = st ? st.minPrice : null;
    const rt = rMap[p._id];
    p.rating = rt ? { avg: Math.round(rt.avg * 10) / 10, count: rt.count } : null;
  });
  return products;
}

// `attachShadeStats` kept as an alias so existing call sites need no change.
module.exports = { attachVariantStats, attachShadeStats: attachVariantStats };
