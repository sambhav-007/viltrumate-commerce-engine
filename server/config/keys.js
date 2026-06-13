require("dotenv").config();

module.exports = {
  // Set JWT_SECRET in .env for production. Fallback keeps local dev working.
  JWT_SECRET: process.env.JWT_SECRET || "dev-only-insecure-secret",
};
