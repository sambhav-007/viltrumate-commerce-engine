const express = require("express");
const router = express.Router();
const controller = require("../controller/banners");
const { loginCheck, adminCheck } = require("../middleware/auth");
const { makeUploader } = require("../config/uploadCloud");

const upload = makeUploader("banners");
const admin = [loginCheck, adminCheck];

router.get("/", controller.getAll);
router.post("/", admin, upload.single("image"), controller.create);
router.put("/:id", admin, upload.single("image"), controller.update);
router.delete("/:id", admin, controller.remove);

module.exports = router;
