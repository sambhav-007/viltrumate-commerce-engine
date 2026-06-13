const StoreSettings = require("../models/storeSettings");
const { toImage } = require("../config/uploadCloud");
const { destroyAssets } = require("../config/cloudinary");

const EDITABLE = [
  "storeName",
  "whatsappNumber",
  "address",
  "aboutUs",
  "contactEmail",
  "contactPhone",
  "instagramUrl",
  "facebookUrl",
  "heroHeading",
  "heroSubheading",
];

class SettingsController {
  // GET /api/settings -> the singleton (auto-created on first read)
  async get(req, res) {
    try {
      let settings = await StoreSettings.findOne({});
      if (!settings) settings = await StoreSettings.create({});
      return res.json({ settings });
    } catch (err) {
      return res.status(500).json({ error: "Failed to load settings" });
    }
  }

  // PUT /api/settings (admin, optional heroImage)
  async update(req, res) {
    try {
      if (
        req.body.whatsappNumber !== undefined &&
        req.body.whatsappNumber !== "" &&
        !/^\d{10,15}$/.test(String(req.body.whatsappNumber).replace(/\D/g, ""))
      ) {
        return res
          .status(400)
          .json({ error: "WhatsApp number must be 10-15 digits incl. country code" });
      }
      let settings = await StoreSettings.findOne({});
      if (!settings) settings = await StoreSettings.create({});
      EDITABLE.forEach((key) => {
        if (req.body[key] !== undefined) settings[key] = req.body[key];
      });
      if (req.file) {
        // Replace hero image (delete the old asset).
        const oldId = settings.heroImage && settings.heroImage.publicId;
        settings.heroImage = toImage(req.file);
        if (oldId) await destroyAssets(oldId);
      } else if (req.body.removeHeroImage === "true") {
        // Clear hero image entirely.
        const oldId = settings.heroImage && settings.heroImage.publicId;
        settings.heroImage = null;
        if (oldId) await destroyAssets(oldId);
      }
      await settings.save();
      return res.json({ success: "Settings updated", settings });
    } catch (err) {
      if (req.file) await destroyAssets(req.file.filename);
      return res.status(500).json({ error: "Failed to update settings" });
    }
  }
}

module.exports = new SettingsController();
