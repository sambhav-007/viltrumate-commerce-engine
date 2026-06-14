const Order = require("../models/orders");

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

  // GET /api/orders (admin) — newest first. Foundation for reporting/history.
  async list(req, res) {
    try {
      const orders = await Order.find({}).sort({ createdAt: -1 });
      return res.json({ orders });
    } catch (err) {
      return res.status(500).json({ error: "Failed to load orders" });
    }
  }
}

module.exports = new OrderController();
