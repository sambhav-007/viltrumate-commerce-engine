const mongoose = require("mongoose");
const { imageSchema } = require("./_image");

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: "" },
    image: { type: imageSchema, default: null },
    status: { type: String, enum: ["Active", "Disabled"], default: "Active" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("categories", categorySchema);
