const { test } = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");

// Razorpay verification is pure crypto keyed off env — no network, fully mockable.
process.env.RAZORPAY_KEY_SECRET = "test_secret_key";
process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";
const rp = require("../../config/razorpay");

const sign = (secret, body) => crypto.createHmac("sha256", secret).update(body).digest("hex");

test("verifyPaymentSignature: accepts a correct HMAC", () => {
  const orderId = "order_123", paymentId = "pay_456";
  const signature = sign("test_secret_key", `${orderId}|${paymentId}`);
  assert.equal(rp.verifyPaymentSignature({ orderId, paymentId, signature }), true);
});

test("verifyPaymentSignature: rejects a tampered signature", () => {
  assert.equal(rp.verifyPaymentSignature({ orderId: "o", paymentId: "p", signature: "deadbeef" }), false);
});

test("verifyWebhook: accepts correct, rejects wrong / empty", () => {
  const raw = JSON.stringify({ event: "payment.captured" });
  assert.equal(rp.verifyWebhook(raw, sign("test_webhook_secret", raw)), true);
  assert.equal(rp.verifyWebhook(raw, sign("wrong", raw)), false);
  assert.equal(rp.verifyWebhook(raw, ""), false);
});
