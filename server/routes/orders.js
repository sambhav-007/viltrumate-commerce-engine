const express = require("express");
const router = express.Router();
const controller = require("../controller/orders");
const { loginCheck, adminCheck } = require("../middleware/auth");

const admin = [loginCheck, adminCheck];

router.post("/", controller.create); // public: any checkout method records here
router.get("/", admin, controller.list); // admin: paginated list for reporting
router.get("/:id", admin, controller.getOne); // admin: single order (details view)
router.patch("/:id/status", admin, controller.updateStatus); // admin: workflow

module.exports = router;
