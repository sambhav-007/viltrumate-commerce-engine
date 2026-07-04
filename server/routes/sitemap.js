const express = require("express");
const router = express.Router();
const Category = require("../models/categories");
const Product = require("../models/products");

// GET /sitemap.xml — crawlable URL list for the storefront.
// Base URL: SITE_URL env, else the first CORS_ORIGINS entry (the storefront).
const baseUrl = () =>
  (process.env.SITE_URL ||
    (process.env.CORS_ORIGINS || "").split(",")[0] ||
    "http://localhost:3000")
    .trim()
    .replace(/\/+$/, "");

const xmlEscape = (s) =>
  String(s).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));

router.get("/sitemap.xml", async (req, res) => {
  try {
    const base = baseUrl();
    const [cats, products] = await Promise.all([
      Category.find({ status: "Active" }).select("slug updatedAt"),
      Product.find({ status: "Active" }).select("slug updatedAt"),
    ]);

    const urls = [
      { loc: `${base}/`, priority: "1.0" },
      { loc: `${base}/category`, priority: "0.8" },
      { loc: `${base}/about`, priority: "0.4" },
      { loc: `${base}/contact`, priority: "0.4" },
      ...cats.map((c) => ({
        loc: `${base}/category/${c.slug}`,
        lastmod: c.updatedAt,
        priority: "0.7",
      })),
      ...products.map((p) => ({
        loc: `${base}/product/${p.slug}`,
        lastmod: p.updatedAt,
        priority: "0.9",
      })),
    ];

    const body =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls
        .map(
          (u) =>
            "  <url>" +
            `<loc>${xmlEscape(u.loc)}</loc>` +
            (u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString().slice(0, 10)}</lastmod>` : "") +
            `<priority>${u.priority}</priority>` +
            "</url>"
        )
        .join("\n") +
      "\n</urlset>\n";

    res.set("Content-Type", "application/xml").send(body);
  } catch (err) {
    res.status(500).send("");
  }
});

module.exports = router;
