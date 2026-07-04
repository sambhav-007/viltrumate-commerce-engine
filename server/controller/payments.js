const Order = require("../models/orders");
const razorpay = require("../config/razorpay");
const { applyOrderTransition } = require("../config/inventory");
const notify = require("../config/notify");

// Mark a VCE order paid/confirmed exactly once (idempotent for verify+webhook).
async function confirmPaid(order, paymentId) {
  const wasPending = order.status === "pending";
  if (wasPending) order.status = "confirmed";
  order.payment = order.payment || {};
  if (paymentId) order.payment.providerPaymentId = paymentId;
  if (!order.payment.paidAt) order.payment.paidAt = new Date();
  await order.save();
  // Inventory decrement exactly once (guarded by wasPending; idempotent for
  // the verify+webhook double-fire because the second call sees "confirmed").
  if (wasPending) {
    await applyOrderTransition(order, "pending", "confirmed");
    notify.orderStatusChanged(order, "pending"); // fire-and-forget
  }
}

class PaymentsController {
  // POST /api/payments/razorpay/order  body: { orderId }
  // Creates a Razorpay order for an existing VCE order and returns the public
  // key + razorpay order id the client needs to open Checkout.
  async createRazorpayOrder(req, res) {
    try {
      if (!razorpay.isConfigured())
        return res.status(503).json({ error: "Razorpay is not configured" });
      const { orderId } = req.body || {};
      const order = await Order.findById(orderId);
      if (!order) return res.status(404).json({ error: "Order not found" });

      const amount = Math.round(Number(order.total || 0) * 100); // paise
      if (!amount || amount < 100)
        return res.status(400).json({ error: "Order amount is too low for online payment" });

      const rzp = await razorpay.createOrder({
        amount,
        currency: "INR",
        receipt: String(order._id),
      });

      order.payment = order.payment || {};
      order.payment.providerOrderId = rzp.id;
      await order.save();

      return res.json({
        keyId: razorpay.keyId(),
        razorpayOrderId: rzp.id,
        amount,
        currency: "INR",
      });
    } catch (err) {
      return res.status(502).json({ error: "Could not start Razorpay payment" });
    }
  }

  // POST /api/payments/razorpay/verify
  // body: { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature }
  async verifyRazorpay(req, res) {
    try {
      const {
        orderId,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      } = req.body || {};
      if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
        return res.status(400).json({ error: "Missing payment fields" });

      const valid = razorpay.verifyPaymentSignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
      });
      if (!valid) return res.status(400).json({ error: "Invalid payment signature" });

      const order = await Order.findById(orderId);
      if (!order) return res.status(404).json({ error: "Order not found" });
      // The razorpay order on this VCE order must match the verified one.
      if (order.payment && order.payment.providerOrderId &&
          order.payment.providerOrderId !== razorpay_order_id)
        return res.status(400).json({ error: "Payment does not match this order" });

      await confirmPaid(order, razorpay_payment_id);
      return res.json({ success: "Payment verified", order });
    } catch (err) {
      return res.status(500).json({ error: "Payment verification failed" });
    }
  }

  // POST /api/payments/razorpay/webhook — reliability backstop. Always 200 to ack.
  async webhook(req, res) {
    try {
      const signature = req.headers["x-razorpay-signature"];
      const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
      if (!razorpay.verifyWebhook(raw, signature))
        return res.status(400).json({ error: "Invalid webhook signature" });

      const event = req.body && req.body.event;
      const entity =
        req.body &&
        req.body.payload &&
        ((req.body.payload.payment && req.body.payload.payment.entity) ||
          (req.body.payload.order && req.body.payload.order.entity));

      if ((event === "payment.captured" || event === "order.paid") && entity) {
        const rzpOrderId = entity.order_id || entity.id;
        const order = await Order.findOne({ "payment.providerOrderId": rzpOrderId });
        if (order) await confirmPaid(order, entity.id);
      }
      return res.json({ status: "ok" });
    } catch (err) {
      return res.status(200).json({ status: "ignored" }); // never make Razorpay retry on our bug
    }
  }
}

module.exports = new PaymentsController();
