const express = require("express");
const router = express.Router();
const controller = require("../controller/variants");
const { loginCheck, adminCheck } = require("../middleware/auth");
const { makeUploader } = require("../config/uploadCloud");

// Cloudinary subfolder kept as "shades" so variant image paths stay consistent
// with already-uploaded assets.
const upload = makeUploader("shades");
const admin = [loginCheck, adminCheck];

router.get("/by-product/:productId", controller.getByProduct);
router.post("/bulk", admin, controller.bulkCreate);
router.patch("/bulk", admin, controller.bulkUpdate);
router.post("/", admin, upload.array("images"), controller.create);
router.put("/:id", admin, upload.array("images"), controller.update);
router.delete("/:id/image", admin, controller.removeImage);
router.delete("/:id", admin, controller.remove);

module.exports = router;
