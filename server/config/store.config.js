// Server bootstrap config: values needed at server start or independent of the
// runtime StoreSettings document (which is fetched per request). The Cloudinary
// folder in particular is fixed when the upload middleware is constructed.
//
// Existing Aura Rare deployments MUST set CLOUDINARY_FOLDER=aura-rare to keep
// asset path continuity; new VCE stores get their own namespace.
require("dotenv").config();

module.exports = {
  cloudinaryFolder: process.env.CLOUDINARY_FOLDER || "vce",
  storeName: process.env.STORE_NAME || "Store",
  currencySymbol: process.env.CURRENCY_SYMBOL || "₹",
  locale: process.env.LOCALE || "en-IN",
};
