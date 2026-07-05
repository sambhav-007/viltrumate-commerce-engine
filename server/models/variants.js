const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;
const { imageSchema } = require("./_image");

// A Variant is the atomic purchasable unit: own name, price, MRP and images.
// Cart, checkout and Reviews all reference a variant by _id.
//
// VCE note: the Mongoose model is registered as "shades" (and so the Mongo
// collection stays "shades") for backward-compat with existing data and with
// other schemas that use `ref: "shades"`. Only the code-level vocabulary moves
// to "Variant"; the persisted name is intentionally preserved.
const variantSchema = new mongoose.Schema(
  {
    product: { type: ObjectId, ref: "products", required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, index: true },
    price: { type: Number, required: true },
    mrp: { type: Number, default: null },
    description: { type: String, default: "" },
    images: { type: [imageSchema], default: [] },
    status: { type: String, enum: ["Active", "Disabled"], default: "Active" },
  },
  { timestamps: true }
);

// Text index powers shop search across variant + product names.
variantSchema.index({ name: "text", slug: "text" });

module.exports = mongoose.model("shades", variantSchema);
