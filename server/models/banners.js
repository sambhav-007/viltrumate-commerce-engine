const mongoose = require("mongoose");
const { imageSchema } = require("./_image");

// Homepage hero / promo slides, fully managed from the admin panel.
const bannerSchema = new mongoose.Schema(
  {
    image: { type: imageSchema, required: true },
    heading: { type: String, default: "" },
    subheading: { type: String, default: "" },
    link: { type: String, default: "" },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("banners", bannerSchema);
