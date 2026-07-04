// Merchant notifications — dependency-free webhook POST (no SMTP lib).
// Set NOTIFY_WEBHOOK_URL in the store's env (a Zapier/Make/Slack/Discord/
// custom endpoint) to get pinged on new orders and status changes; from
// there the merchant routes to email/WhatsApp/anything. Unset = no-op.
//
// Fire-and-forget BY DESIGN: a notification failure must never fail an order.
const https = require("https");
const http = require("http");

function post(payload) {
  const url = process.env.NOTIFY_WEBHOOK_URL;
  if (!url) return;
  try {
    const u = new URL(url);
    const body = JSON.stringify(payload);
    const mod = u.protocol === "http:" ? http : https;
    const req = mod.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === "http:" ? 80 : 443),
        path: u.pathname + u.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 5000,
      },
      (res) => res.resume() // drain + discard
    );
    req.on("error", () => {}); // never throw into the order path
    req.on("timeout", () => req.destroy());
    req.write(body);
    req.end();
  } catch (e) {
    /* malformed URL — ignore */
  }
}

const summarize = (order) => ({
  orderId: String(order._id),
  status: order.status,
  total: order.total,
  paymentMethod: order.paymentMethod,
  customer: { name: order.customer && order.customer.name, phone: order.customer && order.customer.phone },
  items: (order.items || []).map((it) => `${it.productName} — ${it.variantName} × ${it.qty}`),
  coupon: order.coupon && order.coupon.code ? order.coupon : undefined,
  createdAt: order.createdAt,
});

const orderCreated = (order) =>
  post({ event: "order.created", store: process.env.STORE_NAME || "", order: summarize(order) });

const orderStatusChanged = (order, from) =>
  post({
    event: "order.status_changed",
    store: process.env.STORE_NAME || "",
    from,
    to: order.status,
    order: summarize(order),
  });

module.exports = { orderCreated, orderStatusChanged };
