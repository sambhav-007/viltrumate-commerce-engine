const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { cloudinary } = require("./cloudinary");

// Build a multer instance that streams uploads straight to Cloudinary.
// No temporary disk paths are ever stored (Render's disk is ephemeral).
const makeUploader = (folder) =>
  multer({
    storage: new CloudinaryStorage({
      cloudinary,
      params: {
        folder: `aura-rare/${folder}`,
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
      },
    }),
  });

// multer-storage-cloudinary exposes the secure URL on `path` and the
// Cloudinary public_id on `filename`. Map both into our stored shape.
const toImage = (file) =>
  file ? { url: file.path, publicId: file.filename } : null;
const toImages = (files = []) => files.map(toImage);

module.exports = { makeUploader, toImage, toImages };
