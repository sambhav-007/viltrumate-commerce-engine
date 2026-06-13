const Banner = require("../models/banners");
const { toImage } = require("../config/uploadCloud");
const { destroyAssets } = require("../config/cloudinary");

class BannerController {
  // GET /api/banners  ?all=true (admin) | default: active only, ordered
  async getAll(req, res) {
    try {
      const filter = req.query.all === "true" ? {} : { active: true };
      const banners = await Banner.find(filter).sort({ order: 1, _id: -1 });
      return res.json({ banners });
    } catch (err) {
      return res.status(500).json({ error: "Failed to load banners" });
    }
  }

  // POST /api/banners (admin, image)
  async create(req, res) {
    try {
      const { heading, subheading, link, order, active } = req.body;
      const image = toImage(req.file);
      if (!image) return res.status(400).json({ error: "Image is required" });
      const banner = await Banner.create({
        image,
        heading,
        subheading,
        link,
        order,
        active: active === undefined ? true : active === "true" || active === true,
      });
      return res.json({ success: "Banner created", banner });
    } catch (err) {
      if (req.file) await destroyAssets(req.file.filename);
      return res.status(500).json({ error: "Failed to create banner" });
    }
  }

  // PUT /api/banners/:id (admin, optional new image)
  async update(req, res) {
    try {
      const { heading, subheading, link, order, active } = req.body;
      const banner = await Banner.findById(req.params.id);
      if (!banner) {
        if (req.file) await destroyAssets(req.file.filename);
        return res.status(404).json({ error: "Banner not found" });
      }
      if (heading !== undefined) banner.heading = heading;
      if (subheading !== undefined) banner.subheading = subheading;
      if (link !== undefined) banner.link = link;
      if (order !== undefined) banner.order = order;
      if (active !== undefined) banner.active = active === "true" || active === true;
      if (req.file) {
        const oldId = banner.image && banner.image.publicId;
        banner.image = toImage(req.file);
        if (oldId) await destroyAssets(oldId);
      }
      await banner.save();
      return res.json({ success: "Banner updated", banner });
    } catch (err) {
      if (req.file) await destroyAssets(req.file.filename);
      return res.status(500).json({ error: "Failed to update banner" });
    }
  }

  // DELETE /api/banners/:id (admin)
  async remove(req, res) {
    try {
      const banner = await Banner.findByIdAndDelete(req.params.id);
      if (!banner) return res.status(404).json({ error: "Banner not found" });
      if (banner.image) await destroyAssets(banner.image.publicId);
      return res.json({ success: "Banner deleted" });
    } catch (err) {
      return res.status(500).json({ error: "Failed to delete banner" });
    }
  }
}

module.exports = new BannerController();
