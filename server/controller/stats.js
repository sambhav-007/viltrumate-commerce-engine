const Category = require("../models/categories");
const Product = require("../models/products");
const Shade = require("../models/shades");
const Review = require("../models/reviews");

// GET /api/stats -> dashboard counts only (no analytics/sales/orders).
class StatsController {
  async get(req, res) {
    try {
      const [categories, products, shades, pendingReviews] = await Promise.all([
        Category.countDocuments(),
        Product.countDocuments(),
        Shade.countDocuments(),
        Review.countDocuments({ approved: false }),
      ]);
      return res.json({ categories, products, shades, pendingReviews });
    } catch (err) {
      return res.status(500).json({ error: "Failed to load stats" });
    }
  }
}

module.exports = new StatsController();
