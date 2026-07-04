const Category = require("../models/categories");
const Product = require("../models/products");
const Shade = require("../models/shades");
const Review = require("../models/reviews");
const Order = require("../models/orders");
const { lowStockCount } = require("../config/inventory");

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
        lowStock,
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
        lowStockCount(), // 0 when the inventory feature is off
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
        lowStock,
      });
    } catch (err) {
      return res.status(500).json({ error: "Failed to load stats" });
    }
  }

  // GET /api/stats/analytics -> merchant analytics (admin).
  // Realised sales = confirmed + fulfilled. Windows are UTC-day buckets.
  async analytics(req, res) {
    try {
      const days = Math.min(Number(req.query.days) || 30, 365);
      const since = new Date();
      since.setDate(since.getDate() - days);
      since.setHours(0, 0, 0, 0);
      const realised = { status: { $in: ["confirmed", "fulfilled"] } };

      const [byDay, topProducts, byMethod] = await Promise.all([
        Order.aggregate([
          { $match: { ...realised, createdAt: { $gte: since } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              revenue: { $sum: "$total" },
              orders: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        Order.aggregate([
          { $match: { ...realised, createdAt: { $gte: since } } },
          { $unwind: "$items" },
          {
            $group: {
              _id: "$items.productName",
              qty: { $sum: "$items.qty" },
              revenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } },
            },
          },
          { $sort: { qty: -1 } },
          { $limit: 5 },
        ]),
        Order.aggregate([
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: "$paymentMethod", orders: { $sum: 1 }, revenue: { $sum: "$total" } } },
          { $sort: { orders: -1 } },
        ]),
      ]);

      return res.json({ days, byDay, topProducts, byMethod });
    } catch (err) {
      return res.status(500).json({ error: "Failed to load analytics" });
    }
  }
}

module.exports = new StatsController();
