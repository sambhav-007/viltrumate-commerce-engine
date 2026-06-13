const Shade = require("../models/shades");
const { uniqueSlug } = require("../config/slug");
const { toImages } = require("../config/uploadCloud");
const { destroyAssets } = require("../config/cloudinary");
const { deleteShadeById } = require("../config/cascade");

// Price fields must be non-negative numbers (or absent).
const badPrice = (v) =>
  v !== undefined && v !== null && v !== "" && (isNaN(Number(v)) || Number(v) < 0);

class ShadeController {
  // GET /api/shades/by-product/:productId
  async getByProduct(req, res) {
    try {
      const shades = await Shade.find({ product: req.params.productId }).sort({
        _id: 1,
      });
      return res.json({ shades });
    } catch (err) {
      return res.status(500).json({ error: "Failed to load shades" });
    }
  }

  // POST /api/shades (admin, images[])
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
      const slug = await uniqueSlug(Shade, name);
      const shade = await Shade.create({
        product,
        name,
        slug,
        price,
        mrp,
        description,
        status,
        images,
      });
      return res.json({ success: "Shade created", shade });
    } catch (err) {
      if (req.files) await destroyAssets(req.files.map((f) => f.filename));
      return res.status(500).json({ error: "Failed to create shade" });
    }
  }

  // POST /api/shades/bulk (admin) -> create many shades at once.
  // body: { product, shades:[{name, price?, mrp?}], price, mrp, status }
  async bulkCreate(req, res) {
    try {
      const { product, shades, price, mrp, status } = req.body;
      if (!product || !Array.isArray(shades) || !shades.length) {
        return res
          .status(400)
          .json({ error: "Product and a non-empty shades list are required" });
      }
      if (badPrice(price) || badPrice(mrp) || shades.some((s) => s && (badPrice(s.price) || badPrice(s.mrp)))) {
        return res.status(400).json({ error: "Price/MRP must be a non-negative number" });
      }
      const seen = new Set();
      const docs = [];
      for (const s of shades) {
        if (!s || !s.name) continue;
        let slug = await uniqueSlug(Shade, s.name);
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
      const created = await Shade.insertMany(docs);
      return res.json({ success: `${created.length} shades created`, created });
    } catch (err) {
      return res.status(500).json({ error: "Failed to bulk create shades" });
    }
  }

  // PATCH /api/shades/bulk (admin) -> set price/mrp/status on many shades.
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
      const result = await Shade.updateMany({ _id: { $in: ids } }, { $set: set });
      return res.json({ success: "Shades updated", modified: result.nModified });
    } catch (err) {
      return res.status(500).json({ error: "Failed to bulk update shades" });
    }
  }

  // PUT /api/shades/:id (admin) -> updates fields, appends any new images
  async update(req, res) {
    try {
      const { name, price, mrp, description, status } = req.body;
      if (badPrice(price) || badPrice(mrp)) {
        if (req.files) await destroyAssets(req.files.map((f) => f.filename));
        return res.status(400).json({ error: "Price/MRP must be a non-negative number" });
      }
      const shade = await Shade.findById(req.params.id);
      if (!shade) {
        if (req.files) await destroyAssets(req.files.map((f) => f.filename));
        return res.status(404).json({ error: "Shade not found" });
      }
      if (name && name !== shade.name) {
        shade.name = name;
        shade.slug = await uniqueSlug(Shade, name, shade._id);
      }
      if (price !== undefined) shade.price = price;
      if (mrp !== undefined) shade.mrp = mrp;
      if (description !== undefined) shade.description = description;
      if (status !== undefined) shade.status = status;
      if (req.files && req.files.length) shade.images.push(...toImages(req.files));
      await shade.save();
      return res.json({ success: "Shade updated", shade });
    } catch (err) {
      if (req.files) await destroyAssets(req.files.map((f) => f.filename));
      return res.status(500).json({ error: "Failed to update shade" });
    }
  }

  // DELETE /api/shades/:id/image  body: { publicId }
  async removeImage(req, res) {
    try {
      const { publicId } = req.body;
      const shade = await Shade.findById(req.params.id);
      if (!shade) return res.status(404).json({ error: "Shade not found" });
      shade.images = shade.images.filter((i) => i.publicId !== publicId);
      await shade.save();
      await destroyAssets(publicId);
      return res.json({ success: "Image removed", shade });
    } catch (err) {
      return res.status(500).json({ error: "Failed to remove image" });
    }
  }

  // DELETE /api/shades/:id (admin) -> cascades images + reviews
  async remove(req, res) {
    try {
      const exists = await Shade.exists({ _id: req.params.id });
      if (!exists) return res.status(404).json({ error: "Shade not found" });
      await deleteShadeById(req.params.id);
      return res.json({ success: "Shade deleted" });
    } catch (err) {
      return res.status(500).json({ error: "Failed to delete shade" });
    }
  }
}

module.exports = new ShadeController();
