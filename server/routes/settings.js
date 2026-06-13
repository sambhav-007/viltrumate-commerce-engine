const express = require("express");
const router = express.Router();
const controller = require("../controller/settings");
const { loginCheck, adminCheck } = require("../middleware/auth");
const { makeUploader } = require("../config/uploadCloud");

const upload = makeUploader("settings");
const admin = [loginCheck, adminCheck];

router.get("/", controller.get);
router.put("/", admin, upload.single("image"), controller.update);

module.exports = router;
