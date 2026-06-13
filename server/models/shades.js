const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;
const { imageSchema } = require("./_image");

// A Shade is the atomic purchasable unit: own name, price, MRP and images.
// Cart, WhatsApp checkout and Reviews all reference a shade by _id.
const shadeSchema = new mongoose.Schema(
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

// Text index powers shop search across shade + product names.
shadeSchema.index({ name: "text", slug: "text" });

module.exports = mongoose.model("shades", shadeSchema);
