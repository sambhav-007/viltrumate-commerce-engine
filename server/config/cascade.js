const Product = require("../models/products");
const Shade = require("../models/shades");
const Review = require("../models/reviews");
const { destroyAssets } = require("./cloudinary");

const shadeImageIds = (shade) => (shade.images || []).map((i) => i.publicId);

// Delete a shade: its Cloudinary images + its reviews + the doc.
async function deleteShadeById(id) {
  const shade = await Shade.findById(id);
  if (!shade) return;
  await destroyAssets(shadeImageIds(shade));
  await Review.deleteMany({ shade: id });
  await Shade.findByIdAndDelete(id);
}

// Delete a product: all its shades' images + shades + reviews + cover + the doc.
async function deleteProductById(id) {
  const product = await Product.findById(id);
  if (!product) return;
  const shades = await Shade.find({ product: id });
  for (const s of shades) await destroyAssets(shadeImageIds(s));
  await Shade.deleteMany({ product: id });
  await Review.deleteMany({ product: id });
  if (product.coverImage) await destroyAssets(product.coverImage.publicId);
  await Product.findByIdAndDelete(id);
}

module.exports = { deleteShadeById, deleteProductById };
