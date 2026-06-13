const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

// Guest review attached to a Shade. No customer auth — just a name.
// Moderated: only `approved` reviews are shown on the storefront.
const reviewSchema = new mongoose.Schema(
  {
    shade: { type: ObjectId, ref: "shades", required: true, index: true },
    product: { type: ObjectId, ref: "products", index: true },
    customerName: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, default: "" },
    approved: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("reviews", reviewSchema);
