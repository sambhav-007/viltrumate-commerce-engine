const cloudinary = require("cloudinary").v2;
require("dotenv").config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Delete one or many Cloudinary assets by publicId. Accepts a string or array.
const destroyAssets = async (publicIds) => {
  if (!publicIds) return;
  const ids = Array.isArray(publicIds) ? publicIds : [publicIds];
  await Promise.all(
    ids.filter(Boolean).map((id) => cloudinary.uploader.destroy(id))
  );
};

module.exports = { cloudinary, destroyAssets };
