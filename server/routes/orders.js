const express = require("express");
const router = express.Router();
const controller = require("../controller/orders");
const { loginCheck, adminCheck } = require("../middleware/auth");

const admin = [loginCheck, adminCheck];

router.post("/", controller.create); // public: any checkout method records here
router.get("/", admin, controller.list); // admin: list for reporting/history

module.exports = router;
