const Category = require("../models/categories");
const Product = require("../models/products");
const Shade = require("../models/shades");
const Review = require("../models/reviews");
const Order = require("../models/orders");

// GET /api/stats -> dashboard counts + basic order metrics.
class StatsController {
  async get(req, res) {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const [
        categories,
        products,
        shades,
        pendingReviews,
        totalOrders,
        pendingOrders,
        ordersToday,
        revenueAgg,
      ] = await Promise.all([
        Category.countDocuments(),
        Product.countDocuments(),
        Shade.countDocuments(),
        Review.countDocuments({ approved: false }),
        Order.countDocuments(),
        Order.countDocuments({ status: "pending" }),
        Order.countDocuments({ createdAt: { $gte: startOfDay } }),
        // Revenue = realised sales only (confirmed or fulfilled), not pending/cancelled.
        Order.aggregate([
          { $match: { status: { $in: ["confirmed", "fulfilled"] } } },
          { $group: { _id: null, total: { $sum: "$total" } } },
        ]),
      ]);

      const revenue = revenueAgg.length ? revenueAgg[0].total : 0;

      return res.json({
        categories,
        products,
        shades,
        pendingReviews,
        totalOrders,
        pendingOrders,
        ordersToday,
        revenue,
      });
    } catch (err) {
      return res.status(500).json({ error: "Failed to load stats" });
    }
  }
}

module.exports = new StatsController();
