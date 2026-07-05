const Order = require("../models/orders");

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
      const order = await Order.create({
        items,
        customer,
        total,
        paymentMethod: paymentMethod || "whatsapp",
      });
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
      order.status = status;
      await order.save();
      return res.json({ success: "Order updated", order });
    } catch (err) {
      return res.status(500).json({ error: "Failed to update order" });
    }
  }
}

module.exports = new OrderController();
