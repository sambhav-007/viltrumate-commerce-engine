const express = require("express");
const router = express.Router();
const controller = require("../controller/payments");

// All public (customer-facing checkout). Each references an existing VCE order.
router.post("/razorpay/order", controller.createRazorpayOrder); // create gateway order
router.post("/razorpay/verify", controller.verifyRazorpay); // confirm after payment
router.post("/razorpay/webhook", controller.webhook); // Razorpay -> us (backstop)

module.exports = router;
