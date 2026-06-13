const mongoose = require("mongoose");

// Reusable Cloudinary image shape. Local-disk storage is gone: every image
// is referenced by its secure URL plus the publicId needed to delete it.
const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false }
);

module.exports = { imageSchema };
