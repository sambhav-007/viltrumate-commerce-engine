const Product = require("../models/products");
const Shade = require("../models/shades");
const { uniqueSlug } = require("../config/slug");
const { toImage } = require("../config/uploadCloud");
const { destroyAssets } = require("../config/cloudinary");
const { deleteProductById } = require("../config/cascade");
const { attachShadeStats } = require("../config/shadeStats");

class ProductController {
  // GET /api/products  ?category=<id>&featured=true
  async getAll(req, res) {
    try {
      const filter = {};
      if (req.query.category) filter.category = req.query.category;
      if (req.query.featured === "true") filter.isFeatured = true;
      // Optional pagination: ?limit=24&page=1 (defaults to everything).
      const limit = Math.min(parseInt(req.query.limit, 10) || 0, 100);
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      let query = Product.find(filter)
        .populate("category", "name slug")
        .sort({ _id: -1 })
        .lean();
      if (limit) query = query.skip((page - 1) * limit).limit(limit);
      const products = await query;
      await attachShadeStats(products); // adds shadeCount + minPrice + rating
      return res.json({ products });
    } catch (err) {
      return res.status(500).json({ error: "Failed to load products" });
    }
  }

  // GET /api/products/:slug -> product + its shades (+ rating aggregate)
  async getBySlug(req, res) {
    try {
      const product = await Product.findOne({ slug: req.params.slug })
        .populate("category", "name slug")
        .lean();
      if (!product) return res.status(404).json({ error: "Product not found" });
      const shades = await Shade.find({ product: product._id }).sort({ _id: 1 });
      await attachShadeStats([product]);
      return res.json({ product, shades });
    } catch (err) {
      return res.status(500).json({ error: "Failed to load product" });
    }
  }

  // GET /api/products/by-id/:id -> single product (admin Shade Manager header)
  async getById(req, res) {
    try {
      const product = await Product.findById(req.params.id)
        .populate("category", "name slug")
        .lean();
      if (!product) return res.status(404).json({ error: "Product not found" });
      return res.json({ product });
    } catch (err) {
      return res.status(500).json({ error: "Failed to load product" });
    }
  }

  // POST /api/products (admin, optional coverImage)
  async create(req, res) {
    try {
      const { name, description, category, isFeatured, status } = req.body;
      if (!name || !category) {
        if (req.file) await destroyAssets(req.file.filename);
        return res.status(400).json({ error: "Name and category are required" });
      }
      const slug = await uniqueSlug(Product, name);
      const product = await Product.create({
        name,
        slug,
        description,
        category,
        isFeatured: isFeatured === "true" || isFeatured === true,
        status,
        coverImage: toImage(req.file),
      });
      return res.json({ success: "Product created", product });
    } catch (err) {
      if (req.file) await destroyAssets(req.file.filename);
      return res.status(500).json({ error: "Failed to create product" });
    }
  }

  // PUT /api/products/:id (admin, optional new coverImage)
  async update(req, res) {
    try {
      const { name, description, category, isFeatured, status } = req.body;
      const product = await Product.findById(req.params.id);
      if (!product) {
        if (req.file) await destroyAssets(req.file.filename);
        return res.status(404).json({ error: "Product not found" });
      }
      if (name && name !== product.name) {
        product.name = name;
        product.slug = await uniqueSlug(Product, name, product._id);
      }
      if (description !== undefined) product.description = description;
      if (category !== undefined) product.category = category;
      if (isFeatured !== undefined)
        product.isFeatured = isFeatured === "true" || isFeatured === true;
      if (status !== undefined) product.status = status;
      if (req.file) {
        const oldId = product.coverImage && product.coverImage.publicId;
        product.coverImage = toImage(req.file);
        if (oldId) await destroyAssets(oldId);
      } else if (req.body.removeImage === "true") {
        const oldId = product.coverImage && product.coverImage.publicId;
        product.coverImage = null;
        if (oldId) await destroyAssets(oldId);
      }
      await product.save();
      return res.json({ success: "Product updated", product });
    } catch (err) {
      if (req.file) await destroyAssets(req.file.filename);
      return res.status(500).json({ error: "Failed to update product" });
    }
  }

  // DELETE /api/products/:id (admin) -> cascades shades/reviews/images
  async remove(req, res) {
    try {
      const exists = await Product.exists({ _id: req.params.id });
      if (!exists) return res.status(404).json({ error: "Product not found" });
      await deleteProductById(req.params.id);
      return res.json({ success: "Product deleted" });
    } catch (err) {
      return res.status(500).json({ error: "Failed to delete product" });
    }
  }
}

module.exports = new ProductController();
