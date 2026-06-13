const Shade = require("../models/shades");
const Review = require("../models/reviews");

// Attach { shadeCount, minPrice, rating: { avg, count } } to lean products.
async function attachShadeStats(products) {
  if (!products || !products.length) return products;
  const ids = products.map((p) => p._id);
  const [stats, ratings] = await Promise.all([
    Shade.aggregate([
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
    p.shadeCount = st ? st.count : 0;
    p.minPrice = st ? st.minPrice : null;
    const rt = rMap[p._id];
    p.rating = rt ? { avg: Math.round(rt.avg * 10) / 10, count: rt.count } : null;
  });
  return products;
}

module.exports = { attachShadeStats };
