const express = require("express");
const router = express.Router();
const controller = require("../controller/stats");
const { loginCheck, adminCheck } = require("../middleware/auth");

router.get("/", loginCheck, adminCheck, controller.get);
router.get("/analytics", loginCheck, adminCheck, controller.analytics);

module.exports = router;
