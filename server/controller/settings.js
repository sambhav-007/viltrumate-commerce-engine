const StoreSettings = require("../models/storeSettings");
const { toImage } = require("../config/uploadCloud");
const { destroyAssets } = require("../config/cloudinary");
const { setFeatureOverrides } = require("../config/features");

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
  "variantLabel",
];

// Nested config sent (via multipart) as JSON strings — parse before assigning.
const NESTED = ["theme", "layout", "payment", "seo", "features", "content", "stats"];

// Push the store's feature flags into the runtime guard (requireFeature).
const syncFeatures = (settings) => {
  const f = settings.features
    ? typeof settings.features.toObject === "function"
      ? settings.features.toObject()
      : settings.features
    : {};
  setFeatureOverrides(f);
};

class SettingsController {
  // GET /api/settings -> the singleton (auto-created on first read)
  async get(req, res) {
    try {
      let settings = await StoreSettings.findOne({});
      if (!settings) settings = await StoreSettings.create({});
      syncFeatures(settings);
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
      // Agency-managed sections (VCE Panel): the store admin cannot write
      // them. "identity" covers the flat text fields + hero image.
      const locked = settings.lockedSections || [];
      EDITABLE.forEach((key) => {
        if (locked.includes("identity")) return;
        if (req.body[key] !== undefined) settings[key] = req.body[key];
      });
      NESTED.forEach((key) => {
        if (locked.includes(key)) return;
        if (req.body[key] === undefined) return;
        let val = req.body[key];
        if (typeof val === "string") {
          try {
            val = JSON.parse(val);
          } catch (e) {
            return; // ignore malformed nested payloads
          }
        }
        settings[key] = val;
      });
      if (req.file && locked.includes("identity")) {
        await destroyAssets(req.file.filename); // reject managed hero upload
      } else if (req.file) {
        // Replace hero image (delete the old asset).
        const oldId = settings.heroImage && settings.heroImage.publicId;
        settings.heroImage = toImage(req.file);
        if (oldId) await destroyAssets(oldId);
      } else if (req.body.removeHeroImage === "true" && !locked.includes("identity")) {
        // Clear hero image entirely.
        const oldId = settings.heroImage && settings.heroImage.publicId;
        settings.heroImage = null;
        if (oldId) await destroyAssets(oldId);
      }
      await settings.save();
      syncFeatures(settings);
      return res.json({ success: "Settings updated", settings });
    } catch (err) {
      if (req.file) await destroyAssets(req.file.filename);
      return res.status(500).json({ error: "Failed to update settings" });
    }
  }
}

module.exports = new SettingsController();
