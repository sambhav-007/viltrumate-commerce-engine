/*
 * Aura Rare API server.
 * Images are stored on Cloudinary (no local uploads folder).
 * Admin signup: see controller/auth.js (userRole: 1 = admin).
 */

const express = require("express");
const app = express();
require("dotenv").config();
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
// Shared MongoDB connection helper (DNS-SRV workaround + credential-leak guard).
const { connect: connectDb } = require("./config/db");

// Active routers (VCE commerce engine)
const authRouter = require("./routes/auth"); // admin login
const categoryRouter = require("./routes/categories");
const productRouter = require("./routes/products");
const variantRouter = require("./routes/variants");
const reviewRouter = require("./routes/reviews");
const bannerRouter = require("./routes/banners");
const settingsRouter = require("./routes/settings");
const searchRouter = require("./routes/search");
const statsRouter = require("./routes/stats");
const orderRouter = require("./routes/orders");
const paymentRouter = require("./routes/payments");
const couponRouter = require("./routes/coupons");
const sitemapRouter = require("./routes/sitemap");

/*
 * SOFT-DEPRECATED (disconnected, files retained until full storefront/admin
 * cutover is verified): braintree, orders, customize, users routers.
 * Do not re-enable — see docs/VCE_ARCHITECTURE.md.
 */

// Database Connection
connectDb()
  .then(async () => {
    console.log("==== MongoDB Connected ====");
    // Load this store's feature flags into the runtime guard at boot.
    try {
      const StoreSettings = require("./models/storeSettings");
      const { setFeatureOverrides } = require("./config/features");
      const s = await StoreSettings.findOne({});
      if (s && s.features) setFeatureOverrides(s.features.toObject());
    } catch (e) {
      console.log("Feature flag preload skipped:", e.message);
    }
  })
  .catch((err) => console.log("Database Not Connected !!!", err.message));

// Middleware
// CSP is a browser-HTML protection; this server returns only JSON, so we
// disable it (it otherwise just blocks Chrome's devtools probe and adds noise).
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));
app.use(cookieParser());
// CORS: comma-separated allowlist in CORS_ORIGINS, or open in dev.
const origins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors(origins.length ? { origin: origins } : {}));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
// Stash the raw body so the Razorpay webhook can verify its HMAC signature.
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Rate limits: brute-force guard on login, spam guard on guest reviews.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
const reviewLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10 });
const orderLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30 });
const couponLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }); // code guessing
app.use("/api/signin", authLimiter);
app.use("/api/reviews", (req, res, next) =>
  req.method === "POST" ? reviewLimiter(req, res, next) : next()
);
app.use("/api/orders", (req, res, next) =>
  req.method === "POST" ? orderLimiter(req, res, next) : next()
);
app.use("/api/coupons/validate", couponLimiter);

// Routes
app.use("/api", authRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/products", productRouter);
app.use("/api/variants", variantRouter);
app.use("/api/shades", variantRouter); // back-compat alias (deprecated)
app.use("/api/reviews", reviewRouter);
app.use("/api/banners", bannerRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/search", searchRouter);
app.use("/api/stats", statsRouter);
app.use("/api/orders", orderRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/coupons", couponRouter); // feature-gated inside the router
app.use("/", sitemapRouter); // GET /sitemap.xml (point the storefront's robots.txt here)

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Friendly root so hitting the API host directly doesn't look broken.
app.get("/", (req, res) =>
  res.json({
    name: "Aura Rare API",
    status: "running",
    docs: "All endpoints live under /api (e.g. /api/health, /api/products).",
  })
);

// Run Server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log("Server is running on", PORT));
