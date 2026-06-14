const Variant = require("../models/variants");
const { uniqueSlug } = require("../config/slug");
const { toImages } = require("../config/uploadCloud");
const { destroyAssets } = require("../config/cloudinary");
const { deleteVariantById } = require("../config/cascade");

// Price fields must be non-negative numbers (or absent).
const badPrice = (v) =>
  v !== undefined && v !== null && v !== "" && (isNaN(Number(v)) || Number(v) < 0);

class VariantController {
  // GET /api/variants/by-product/:productId
  async getByProduct(req, res) {
    try {
      const variants = await Variant.find({ product: req.params.productId }).sort({
        _id: 1,
      });
      // `shades` retained as an alias key for wire back-compat.
      return res.json({ variants, shades: variants });
    } catch (err) {
      return res.status(500).json({ error: "Failed to load variants" });
    }
  }

  // POST /api/variants (admin, images[])
  async create(req, res) {
    try {
      const { product, name, price, mrp, description, status } = req.body;
      const images = toImages(req.files);
      if (!product || !name || price === undefined) {
        await destroyAssets(images.map((i) => i.publicId));
        return res
          .status(400)
          .json({ error: "Product, name and price are required" });
      }
      if (badPrice(price) || badPrice(mrp)) {
        await destroyAssets(images.map((i) => i.publicId));
        return res.status(400).json({ error: "Price/MRP must be a non-negative number" });
      }
      const slug = await uniqueSlug(Variant, name);
      const variant = await Variant.create({
        product,
        name,
        slug,
        price,
        mrp,
        description,
        status,
        images,
      });
      return res.json({ success: "Variant created", variant, shade: variant });
    } catch (err) {
      if (req.files) await destroyAssets(req.files.map((f) => f.filename));
      return res.status(500).json({ error: "Failed to create variant" });
    }
  }

  // POST /api/variants/bulk (admin) -> create many variants at once.
  // body: { product, variants|shades:[{name, price?, mrp?}], price, mrp, status }
  async bulkCreate(req, res) {
    try {
      const { product, price, mrp, status } = req.body;
      // Accept either `variants` (new) or `shades` (legacy) in the body.
      const list = req.body.variants || req.body.shades;
      if (!product || !Array.isArray(list) || !list.length) {
        return res
          .status(400)
          .json({ error: "Product and a non-empty variants list are required" });
      }
      if (badPrice(price) || badPrice(mrp) || list.some((s) => s && (badPrice(s.price) || badPrice(s.mrp)))) {
        return res.status(400).json({ error: "Price/MRP must be a non-negative number" });
      }
      const seen = new Set();
      const docs = [];
      for (const s of list) {
        if (!s || !s.name) continue;
        let slug = await uniqueSlug(Variant, s.name);
        while (seen.has(slug)) slug = `${slug}-x`;
        seen.add(slug);
        docs.push({
          product,
          name: s.name,
          slug,
          price: s.price !== undefined ? s.price : price || 0,
          mrp: s.mrp !== undefined ? s.mrp : mrp,
          status: status || "Active",
          images: [],
        });
      }
      const created = await Variant.insertMany(docs);
      return res.json({ success: `${created.length} variants created`, created });
    } catch (err) {
      return res.status(500).json({ error: "Failed to bulk create variants" });
    }
  }

  // PATCH /api/variants/bulk (admin) -> set price/mrp/status on many variants.
  // body: { ids:[], price?, mrp?, status? }
  async bulkUpdate(req, res) {
    try {
      const { ids, price, mrp, status } = req.body;
      if (!Array.isArray(ids) || !ids.length) {
        return res.status(400).json({ error: "ids list is required" });
      }
      const set = {};
      if (price !== undefined) set.price = price;
      if (mrp !== undefined) set.mrp = mrp;
      if (status !== undefined) set.status = status;
      if (!Object.keys(set).length) {
        return res.status(400).json({ error: "Nothing to update" });
      }
      const result = await Variant.updateMany({ _id: { $in: ids } }, { $set: set });
      return res.json({ success: "Variants updated", modified: result.nModified });
    } catch (err) {
      return res.status(500).json({ error: "Failed to bulk update variants" });
    }
  }

  // PUT /api/variants/:id (admin) -> updates fields, appends any new images
  async update(req, res) {
    try {
      const { name, price, mrp, description, status } = req.body;
      if (badPrice(price) || badPrice(mrp)) {
        if (req.files) await destroyAssets(req.files.map((f) => f.filename));
        return res.status(400).json({ error: "Price/MRP must be a non-negative number" });
      }
      const variant = await Variant.findById(req.params.id);
      if (!variant) {
        if (req.files) await destroyAssets(req.files.map((f) => f.filename));
        return res.status(404).json({ error: "Variant not found" });
      }
      if (name && name !== variant.name) {
        variant.name = name;
        variant.slug = await uniqueSlug(Variant, name, variant._id);
      }
      if (price !== undefined) variant.price = price;
      if (mrp !== undefined) variant.mrp = mrp;
      if (description !== undefined) variant.description = description;
      if (status !== undefined) variant.status = status;
      if (req.files && req.files.length) variant.images.push(...toImages(req.files));
      await variant.save();
      return res.json({ success: "Variant updated", variant, shade: variant });
    } catch (err) {
      if (req.files) await destroyAssets(req.files.map((f) => f.filename));
      return res.status(500).json({ error: "Failed to update variant" });
    }
  }

  // DELETE /api/variants/:id/image  body: { publicId }
  async removeImage(req, res) {
    try {
      const { publicId } = req.body;
      const variant = await Variant.findById(req.params.id);
      if (!variant) return res.status(404).json({ error: "Variant not found" });
      variant.images = variant.images.filter((i) => i.publicId !== publicId);
      await variant.save();
      await destroyAssets(publicId);
      return res.json({ success: "Image removed", variant, shade: variant });
    } catch (err) {
      return res.status(500).json({ error: "Failed to remove image" });
    }
  }

  // DELETE /api/variants/:id (admin) -> cascades images + reviews
  async remove(req, res) {
    try {
      const exists = await Variant.exists({ _id: req.params.id });
      if (!exists) return res.status(404).json({ error: "Variant not found" });
      await deleteVariantById(req.params.id);
      return res.json({ success: "Variant deleted" });
    } catch (err) {
      return res.status(500).json({ error: "Failed to delete variant" });
    }
  }
}

module.exports = new VariantController();
