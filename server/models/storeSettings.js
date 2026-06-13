const mongoose = require("mongoose");
const { imageSchema } = require("./_image");

// Singleton document holding all global, admin-editable site content.
// Frontend fetches this once; nothing here is hardcoded.
const storeSettingsSchema = new mongoose.Schema(
  {
    storeName: { type: String, default: "Aura Rare" },
    whatsappNumber: { type: String, default: "" }, // digits incl. country code, for wa.me
    address: { type: String, default: "" },
    aboutUs: { type: String, default: "" },
    contactEmail: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    instagramUrl: { type: String, default: "" },
    facebookUrl: { type: String, default: "" },
    heroHeading: { type: String, default: "" },
    heroSubheading: { type: String, default: "" },
    heroImage: { type: imageSchema, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("storeSettings", storeSettingsSchema);
