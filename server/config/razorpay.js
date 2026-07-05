// Razorpay helpers using Node built-ins only (no SDK dependency).
// Keys come from this store's env: RAZORPAY_KEY_ID (public), RAZORPAY_KEY_SECRET
// and RAZORPAY_WEBHOOK_SECRET (server-only — never sent to the client).
const https = require("https");
const crypto = require("crypto");

const keyId = () => process.env.RAZORPAY_KEY_ID || "";
const keySecret = () => process.env.RAZORPAY_KEY_SECRET || "";
const webhookSecret = () => process.env.RAZORPAY_WEBHOOK_SECRET || "";

const isConfigured = () => !!(keyId() && keySecret());

// Constant-time string compare (guards signature verification against timing).
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// Create a Razorpay order. amount is in the smallest currency unit (paise).
function createOrder({ amount, currency = "INR", receipt }) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ amount, currency, receipt, payment_capture: 1 });
    const auth = Buffer.from(`${keyId()}:${keySecret()}`).toString("base64");
    const req = https.request(
      {
        hostname: "api.razorpay.com",
        path: "/v1/orders",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          Authorization: `Basic ${auth}`,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            const json = JSON.parse(body || "{}");
            if (res.statusCode >= 200 && res.statusCode < 300) return resolve(json);
            reject(new Error((json.error && json.error.description) || "Razorpay order failed"));
          } catch (e) {
            reject(new Error("Invalid response from Razorpay"));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// Verify the checkout signature: HMAC_SHA256(order_id|payment_id, key_secret).
function verifyPaymentSignature({ orderId, paymentId, signature }) {
  const expected = crypto
    .createHmac("sha256", keySecret())
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return safeEqual(expected, signature);
}

// Verify a webhook: HMAC_SHA256(rawBody, webhook_secret) vs x-razorpay-signature.
function verifyWebhook(rawBody, signature) {
  if (!webhookSecret() || !signature) return false;
  const expected = crypto
    .createHmac("sha256", webhookSecret())
    .update(rawBody)
    .digest("hex");
  return safeEqual(expected, signature);
}

module.exports = {
  isConfigured,
  keyId,
  createOrder,
  verifyPaymentSignature,
  verifyWebhook,
};
