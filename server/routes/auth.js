const express = require("express");
const router = express.Router();
const authController = require("../controller/auth");

/*
 * Public signup is disabled: the old route minted admin accounts (userRole: 1)
 * for anyone. Aura Rare is single-admin — create the account with
 * `node scripts/createAdmin.js` instead.
 */
router.post("/signin", authController.postSignin);

module.exports = router;
