/*
 * Aura Rare API server.
 * Images are stored on Cloudinary (no local uploads folder).
 * Admin signup: see controller/auth.js (userRole: 1 = admin).
 */

const express = require("express");
const app = express();
require("dotenv").config();
const mongoose = require("mongoose");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const dns = require("dns");

/*
 * mongodb+srv:// needs a DNS SRV lookup. Node's c-ares resolver fails with
 * `querySrv ECONNREFUSED` when the OS DNS server is an IPv6 link-local
 * address (common on Windows). Point the resolver at a reliable DNS server.
 * Override with DNS_SERVERS="1.1.1.1,8.8.8.8", or DNS_SERVERS="off" to skip.
 */
if (process.env.DNS_SERVERS !== "off") {
  const servers = (process.env.DNS_SERVERS || "8.8.8.8,1.1.1.1")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    dns.setServers(servers);
  } catch (e) {
    console.log("Could not set DNS servers:", e.message);
  }
}

// Active routers (Aura Rare architecture)
const authRouter = require("./routes/auth"); // admin login
const categoryRouter = require("./routes/categories");
const productRouter = require("./routes/products");
const shadeRouter = require("./routes/shades");
const reviewRouter = require("./routes/reviews");
const bannerRouter = require("./routes/banners");
const settingsRouter = require("./routes/settings");
const searchRouter = require("./routes/search");
const statsRouter = require("./routes/stats");

/*
 * SOFT-DEPRECATED (disconnected, files retained until full storefront/admin
 * cutover is verified): braintree, orders, customize, users routers.
 * Do not re-enable — see docs/AURA_RARE_ARCHITECTURE.md.
 */

// Database Connection
mongoose
  .connect(process.env.DATABASE, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
  })
  .then(() => console.log("==== MongoDB Connected ===="))
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
app.use(express.json({ limit: "1mb" }));

// Rate limits: brute-force guard on login, spam guard on guest reviews.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
const reviewLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10 });
app.use("/api/signin", authLimiter);
app.use("/api/reviews", (req, res, next) =>
  req.method === "POST" ? reviewLimiter(req, res, next) : next()
);

// Routes
app.use("/api", authRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/products", productRouter);
app.use("/api/shades", shadeRouter);
app.use("/api/reviews", reviewRouter);
app.use("/api/banners", bannerRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/search", searchRouter);
app.use("/api/stats", statsRouter);

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
