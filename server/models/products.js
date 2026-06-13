const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;
const { imageSchema } = require("./_image");

// A Product is a named collection of shades (e.g. "Smile & Shine").
// Shades (the purchasable units) live in their own collection, referencing this.
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: "" },
    category: { type: ObjectId, ref: "categories", required: true, index: true },
    coverImage: { type: imageSchema, default: null },
    isFeatured: { type: Boolean, default: false, index: true },
    status: { type: String, enum: ["Active", "Disabled"], default: "Active" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("products", productSchema);
