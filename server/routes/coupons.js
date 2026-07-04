const express = require("express");
const router = express.Router();
const controller = require("../controller/coupons");
const { loginCheck, adminCheck } = require("../middleware/auth");
const { requireFeature } = require("../config/features");

const admin = [loginCheck, adminCheck];

// Whole router is feature-gated (mirrors how reviews/orders gate in app.js).
router.use(requireFeature("coupons"));

router.post("/validate", controller.validate); // public: checkout applies a code
router.get("/", admin, controller.list);
router.post("/", admin, controller.create);
router.put("/:id", admin, controller.update);
router.delete("/:id", admin, controller.remove);

module.exports = router;
