const express = require("express");
const router = express.Router();
const controller = require("../controller/reviews");
const { loginCheck, adminCheck } = require("../middleware/auth");

const admin = [loginCheck, adminCheck];

router.get("/", admin, controller.getAll); // moderation list
router.get("/by-shade/:shadeId", controller.getByShade);
router.post("/", controller.create); // guest submit
router.put("/:id/approve", admin, controller.approve);
router.delete("/:id", admin, controller.remove);

module.exports = router;
