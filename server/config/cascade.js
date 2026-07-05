const Product = require("../models/products");
const Variant = require("../models/variants");
const Review = require("../models/reviews");
const { destroyAssets } = require("./cloudinary");

const variantImageIds = (variant) => (variant.images || []).map((i) => i.publicId);

// Delete a variant: its Cloudinary images + its reviews + the doc.
async function deleteVariantById(id) {
  const variant = await Variant.findById(id);
  if (!variant) return;
  await destroyAssets(variantImageIds(variant));
  await Review.deleteMany({ shade: id }); // review.shade ref kept for data compat
  await Variant.findByIdAndDelete(id);
}

// Delete a product: all its variants' images + variants + reviews + cover + doc.
async function deleteProductById(id) {
  const product = await Product.findById(id);
  if (!product) return;
  const variants = await Variant.find({ product: id });
  for (const v of variants) await destroyAssets(variantImageIds(v));
  await Variant.deleteMany({ product: id });
  await Review.deleteMany({ product: id });
  if (product.coverImage) await destroyAssets(product.coverImage.publicId);
  await Product.findByIdAndDelete(id);
}

module.exports = {
  deleteVariantById,
  deleteProductById,
  // Back-compat alias.
  deleteShadeById: deleteVariantById,
};
