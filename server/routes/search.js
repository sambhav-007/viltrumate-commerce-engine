const express = require("express");
const router = express.Router();
const controller = require("../controller/search");

router.get("/", controller.search);

module.exports = router;
