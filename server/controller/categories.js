const Category = require("../models/categories");
const Product = require("../models/products");
const { uniqueSlug } = require("../config/slug");
const { toImage } = require("../config/uploadCloud");
const { destroyAssets } = require("../config/cloudinary");
const { deleteProductById } = require("../config/cascade");
const { attachShadeStats } = require("../config/shadeStats");

class CategoryController {
  // GET /api/categories  -> all categories, ordered
  async getAll(req, res) {
    try {
      const categories = await Category.find({}).sort({ order: 1, _id: -1 });
      return res.json({ categories });
    } catch (err) {
      return res.status(500).json({ error: "Failed to load categories" });
    }
  }

  // GET /api/categories/:slug -> category + its active products
  async getBySlug(req, res) {
    try {
      const category = await Category.findOne({ slug: req.params.slug });
      if (!category) return res.status(404).json({ error: "Category not found" });
      const products = await Product.find({
        category: category._id,
        status: "Active",
      })
        .sort({ _id: -1 })
        .lean();
      await attachShadeStats(products);
      return res.json({ category, products });
    } catch (err) {
      return res.status(500).json({ error: "Failed to load category" });
    }
  }

  // POST /api/categories  (admin, multipart: image)
  async create(req, res) {
    try {
      const { name, description, status, order } = req.body;
      const image = toImage(req.file);
      if (!name || !image) {
        if (image) await destroyAssets(image.publicId);
        return res.status(400).json({ error: "Name and image are required" });
      }
      const slug = await uniqueSlug(Category, name);
      const category = await Category.create({
        name,
        slug,
        description,
        status,
        order,
        image,
      });
      return res.json({ success: "Category created", category });
    } catch (err) {
      if (req.file) await destroyAssets(req.file.filename);
      return res.status(500).json({ error: "Failed to create category" });
    }
  }

  // PUT /api/categories/:id  (admin, optional new image)
  async update(req, res) {
    try {
      const { name, description, status, order } = req.body;
      const category = await Category.findById(req.params.id);
      if (!category) {
        if (req.file) await destroyAssets(req.file.filename);
        return res.status(404).json({ error: "Category not found" });
      }
      if (name && name !== category.name) {
        category.name = name;
        category.slug = await uniqueSlug(Category, name, category._id);
      }
      if (description !== undefined) category.description = description;
      if (status !== undefined) category.status = status;
      if (order !== undefined) category.order = order;
      if (req.file) {
        const oldId = category.image && category.image.publicId;
        category.image = toImage(req.file);
        if (oldId) await destroyAssets(oldId);
      } else if (req.body.removeImage === "true") {
        const oldId = category.image && category.image.publicId;
        category.image = null;
        if (oldId) await destroyAssets(oldId);
      }
      await category.save();
      return res.json({ success: "Category updated", category });
    } catch (err) {
      if (req.file) await destroyAssets(req.file.filename);
      return res.status(500).json({ error: "Failed to update category" });
    }
  }

  // DELETE /api/categories/:id  (admin) -> cascades products/shades/reviews/images
  async remove(req, res) {
    try {
      const category = await Category.findById(req.params.id);
      if (!category) return res.status(404).json({ error: "Category not found" });
      const products = await Product.find({ category: category._id }, "_id");
      for (const p of products) await deleteProductById(p._id);
      if (category.image) await destroyAssets(category.image.publicId);
      await Category.findByIdAndDelete(category._id);
      return res.json({ success: "Category deleted" });
    } catch (err) {
      return res.status(500).json({ error: "Failed to delete category" });
    }
  }
}

module.exports = new CategoryController();
