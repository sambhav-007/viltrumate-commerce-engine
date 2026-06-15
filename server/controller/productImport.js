const Category = require("../models/categories");
const Product = require("../models/products");
const Shade = require("../models/shades"); // the "variant" collection (legacy name)
const { uniqueSlug, baseSlug } = require("../config/slug");
const { cloudinary } = require("../config/cloudinary");
const { cloudinaryFolder } = require("../config/store.config");
const { parseCsv } = require("../config/csvParse");

const MAX_ROWS = 500;
const TRUE_SET = new Set(["true", "1", "yes", "y"]);

const num = (v) => {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : NaN;
};
const isUrl = (v) => /^https?:\/\//i.test(String(v).trim());

// Validate + normalize every row. Pure (no DB/writes). Row numbers are
// 1-based over the data rows, +1 for the header (so they match the spreadsheet).
function analyze(csvText) {
  const raw = parseCsv(csvText);
  const rows = raw.map((r, i) => {
    const rowNum = i + 2; // +1 header, +1 to 1-base
    const errors = [];

    const productName = (r.product_name || "").trim();
    const category = (r.category || "").trim();
    const variantName = (r.variant_name || "").trim();
    if (!productName) errors.push("product_name is required");
    if (!category) errors.push("category is required");
    if (!variantName) errors.push("variant_name is required");

    const price = num(r.price);
    if (price === null) errors.push("price is required");
    else if (Number.isNaN(price) || price < 0) errors.push("price must be a number ≥ 0");

    const mrp = num(r.mrp);
    if (mrp !== null && (Number.isNaN(mrp) || mrp < 0))
      errors.push("mrp must be a number ≥ 0");

    let status = (r.status || "").trim();
    if (status) {
      const s = status.toLowerCase();
      if (s === "active") status = "Active";
      else if (s === "disabled") status = "Disabled";
      else errors.push('status must be "Active" or "Disabled"');
    } else {
      status = "Active";
    }

    const productImageUrl = (r.product_image_url || "").trim();
    const variantImageUrl = (r.variant_image_url || "").trim();
    if (productImageUrl && !isUrl(productImageUrl))
      errors.push("product_image_url must be an http(s) URL");
    if (variantImageUrl && !isUrl(variantImageUrl))
      errors.push("variant_image_url must be an http(s) URL");

    return {
      rowNum,
      ok: errors.length === 0,
      errors,
      data: {
        productName,
        category,
        productDescription: (r.product_description || "").trim(),
        featured: TRUE_SET.has(String(r.featured || "").trim().toLowerCase()),
        productImageUrl,
        variantName,
        price,
        mrp,
        variantImageUrl,
        status,
      },
    };
  });

  return rows;
}

// Group valid rows into products by (product_name + category), case-insensitive.
function groupValid(rows) {
  const groups = new Map();
  for (const r of rows) {
    if (!r.ok) continue;
    const key = `${r.data.productName.toLowerCase()}||${r.data.category.toLowerCase()}`;
    if (!groups.has(key)) {
      groups.set(key, { product: r.data, rows: [] });
    }
    groups.get(key).rows.push(r);
  }
  return groups;
}

async function uploadByUrl(url, sub) {
  const res = await cloudinary.uploader.upload(url, {
    folder: `${cloudinaryFolder}/${sub}`,
  });
  return { url: res.secure_url, publicId: res.public_id };
}

class ProductImportController {
  // POST /api/products/import/preview (admin) — dry run, never writes.
  async preview(req, res) {
    try {
      const csv = req.body && req.body.csv;
      if (!csv || typeof csv !== "string")
        return res.status(400).json({ error: "CSV content is required" });

      const rows = analyze(csv);
      if (!rows.length)
        return res.status(400).json({ error: "No data rows found in CSV" });
      if (rows.length > MAX_ROWS)
        return res
          .status(400)
          .json({ error: `Too many rows (${rows.length}); max ${MAX_ROWS} per import` });

      const valid = rows.filter((r) => r.ok);
      const groups = groupValid(rows);

      // Which categories are new (not already in the DB, case-insensitive)?
      const existing = new Set(
        (await Category.find({}, "name").lean()).map((c) => c.name.toLowerCase())
      );
      const newCats = new Set();
      valid.forEach((r) => {
        const k = r.data.category.toLowerCase();
        if (!existing.has(k)) newCats.add(k);
      });

      return res.json({
        summary: {
          totalRows: rows.length,
          validRows: valid.length,
          invalidRows: rows.length - valid.length,
          productsToCreate: groups.size,
          variantsToCreate: valid.length,
          categoriesToCreate: newCats.size,
        },
        rows,
      });
    } catch (err) {
      return res.status(500).json({ error: "Failed to preview import" });
    }
  }

  // POST /api/products/import (admin) — imports valid rows; partial success.
  async run(req, res) {
    try {
      const csv = req.body && req.body.csv;
      if (!csv || typeof csv !== "string")
        return res.status(400).json({ error: "CSV content is required" });

      const rows = analyze(csv);
      if (!rows.length)
        return res.status(400).json({ error: "No data rows found in CSV" });
      if (rows.length > MAX_ROWS)
        return res
          .status(400)
          .json({ error: `Too many rows (${rows.length}); max ${MAX_ROWS} per import` });

      const created = { categories: 0, products: 0, variants: 0 };
      const imageWarnings = [];

      // Preload categories (lower name -> doc) and create missing ones lazily.
      const catMap = new Map();
      (await Category.find({}).lean()).forEach((c) =>
        catMap.set(c.name.toLowerCase(), c)
      );
      const ensureCategory = async (name) => {
        const key = name.toLowerCase();
        if (catMap.has(key)) return catMap.get(key);
        const cat = await Category.create({
          name,
          slug: await uniqueSlug(Category, name),
          status: "Active",
          order: 0,
        });
        catMap.set(key, cat);
        created.categories += 1;
        return cat;
      };

      const groups = groupValid(rows);
      for (const { product: p, rows: variantRows } of groups.values()) {
        const cat = await ensureCategory(p.category);

        let coverImage = null;
        if (p.productImageUrl) {
          try {
            coverImage = await uploadByUrl(p.productImageUrl, "imported");
          } catch (e) {
            imageWarnings.push(`Product "${p.productName}": cover image failed to load`);
          }
        }

        const product = await Product.create({
          name: p.productName,
          slug: await uniqueSlug(Product, p.productName),
          description: p.productDescription,
          category: cat._id,
          isFeatured: p.featured,
          status: p.status,
          coverImage,
        });
        created.products += 1;

        for (const vr of variantRows) {
          const v = vr.data;
          let images = [];
          if (v.variantImageUrl) {
            try {
              images = [await uploadByUrl(v.variantImageUrl, "imported")];
            } catch (e) {
              imageWarnings.push(
                `Variant "${v.variantName}" (row ${vr.rowNum}): image failed to load`
              );
            }
          }
          await Shade.create({
            product: product._id,
            name: v.variantName,
            slug: await uniqueSlug(Shade, `${baseSlug(p.productName)}-${v.variantName}`),
            price: v.price,
            mrp: v.mrp,
            status: v.status,
            images,
          });
          created.variants += 1;
          vr.imported = true;
        }
      }

      return res.json({
        success: "Import complete",
        created,
        skippedRows: rows.filter((r) => !r.ok).length,
        imageWarnings,
        rows,
      });
    } catch (err) {
      return res.status(500).json({ error: "Failed to import products" });
    }
  }
}

module.exports = new ProductImportController();
