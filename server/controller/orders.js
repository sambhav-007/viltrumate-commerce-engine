const Order = require("../models/orders");
const Coupon = require("../models/coupons");
const Variant = require("../models/shades");
const { applyOrderTransition } = require("../config/inventory");
const { isFeatureEnabled } = require("../config/features");
const notify = require("../config/notify");

// Allowed status transitions. Terminal states (fulfilled, cancelled) accept none.
const TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["fulfilled", "cancelled"],
  fulfilled: [],
  cancelled: [],
};

const MAX_LIMIT = 200;

class OrderController {
  // POST /api/orders (public) — records an order for any checkout method.
  async create(req, res) {
    try {
      const { items, customer, total, paymentMethod } = req.body;
      if (!customer || !customer.name || !customer.phone) {
        return res
          .status(400)
          .json({ error: "Customer name and phone are required" });
      }
      if (!Array.isArray(items) || !items.length) {
        return res.status(400).json({ error: "Order has no items" });
      }
      // Server-side money math — neither the client's total nor its line
      // prices are trusted. Re-price every line from the live variant; the
      // client snapshot only survives for variants deleted since carting.
      const ids = items.map((it) => it.variantId).filter(Boolean);
      const dbVariants = ids.length
        ? await Variant.find({ _id: { $in: ids } }).select("price")
        : [];
      const priceOf = new Map(dbVariants.map((v) => [String(v._id), v.price]));
      let itemsTotal = 0;
      for (const it of items) {
        const key = String(it.variantId || "");
        if (priceOf.has(key)) it.price = priceOf.get(key);
        itemsTotal += (Number(it.price) || 0) * (Number(it.qty) || 1);
      }

      // Coupon: re-validate and consume atomically (never trust the client's
      // discount). findOneAndUpdate's filter re-checks status/expiry/maxUses
      // so two concurrent orders can't overspend a maxUses cap.
      let couponSnap = { code: "", discount: 0 };
      const code = req.body.coupon && req.body.coupon.code;
      if (code && isFeatureEnabled("coupons")) {
        const now = new Date();
        const coupon = await Coupon.findOneAndUpdate(
          {
            code: String(code).trim().toUpperCase(),
            status: "Active",
            $and: [
              { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
              {
                $or: [
                  { maxUses: null },
                  { $expr: { $lt: ["$usedCount", "$maxUses"] } },
                ],
              },
            ],
            minCart: { $lte: itemsTotal },
          },
          { $inc: { usedCount: 1 } },
          { new: true }
        );
        if (!coupon) {
          return res.status(400).json({ error: "This coupon can't be applied" });
        }
        // discountFor re-checks nothing that could have changed; compute the
        // amount from the same document we just consumed.
        const raw =
          coupon.type === "percent" ? (itemsTotal * coupon.value) / 100 : coupon.value;
        couponSnap = { code: coupon.code, discount: Math.min(Math.round(raw), itemsTotal) };
      }

      const order = await Order.create({
        items,
        customer,
        total: itemsTotal - couponSnap.discount,
        coupon: couponSnap,
        paymentMethod: paymentMethod || "whatsapp",
      });
      notify.orderCreated(order); // fire-and-forget
      return res.json({ success: "Order created", order });
    } catch (err) {
      return res.status(500).json({ error: "Failed to create order" });
    }
  }

  // GET /api/orders (admin) — newest first, paginated.
  // Query: ?status=<state> (optional filter), ?limit (default 50, max 200),
  // ?page (default 1). Response keeps the `orders` key for back-compat and adds
  // pagination metadata. Unbounded results were intentionally dropped — there
  // are no production consumers relying on them.
  async list(req, res) {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, MAX_LIMIT);
      const page = Math.max(Number(req.query.page) || 1, 1);
      const filter = {};
      if (req.query.status) filter.status = req.query.status;
      const [orders, total] = await Promise.all([
        Order.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        Order.countDocuments(filter),
      ]);
      return res.json({ orders, total, page, limit });
    } catch (err) {
      return res.status(500).json({ error: "Failed to load orders" });
    }
  }

  // GET /api/orders/:id (admin) — single order for the details view.
  async getOne(req, res) {
    try {
      const order = await Order.findById(req.params.id);
      if (!order) return res.status(404).json({ error: "Order not found" });
      return res.json({ order });
    } catch (err) {
      return res.status(500).json({ error: "Failed to load order" });
    }
  }

  // PATCH /api/orders/:id/status (admin) — advance the fulfillment workflow.
  // Body: { status }. Validated against the enum and the transition rules.
  async updateStatus(req, res) {
    try {
      const { status } = req.body;
      if (!status || !(status in TRANSITIONS)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      const order = await Order.findById(req.params.id);
      if (!order) return res.status(404).json({ error: "Order not found" });
      if (order.status === status) {
        return res.json({ success: "No change", order });
      }
      if (!TRANSITIONS[order.status].includes(status)) {
        return res.status(400).json({
          error: `Cannot change status from "${order.status}" to "${status}"`,
        });
      }
      const previous = order.status;
      order.status = status;
      await order.save();
      // Inventory movement (no-op unless the feature is enabled).
      await applyOrderTransition(order, previous, status);
      notify.orderStatusChanged(order, previous); // fire-and-forget
      return res.json({ success: "Order updated", order });
    } catch (err) {
      return res.status(500).json({ error: "Failed to update order" });
    }
  }
}

module.exports = new OrderController();
