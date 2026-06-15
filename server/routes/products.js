const express = require("express");
const router = express.Router();
const controller = require("../controller/products");
const importer = require("../controller/productImport");
const { loginCheck, adminCheck } = require("../middleware/auth");
const { makeUploader } = require("../config/uploadCloud");

const upload = makeUploader("products");
const admin = [loginCheck, adminCheck];

// CSV import (admin). Declared before "/:slug" so the paths never collide.
router.post("/import/preview", admin, importer.preview); // dry-run validation
router.post("/import", admin, importer.run); // create products/variants

router.get("/", controller.getAll);
router.get("/by-id/:id", controller.getById);
router.get("/:slug", controller.getBySlug);
router.post("/", admin, upload.single("image"), controller.create);
router.put("/:id", admin, upload.single("image"), controller.update);
router.delete("/:id", admin, controller.remove);

module.exports = router;
