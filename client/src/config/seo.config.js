// Default SEO metadata. CRA's static index.html cannot template custom env
// vars, so these defaults seed the build and the runtime SeoHead component
// (Phase D) overrides document.title / meta tags per store from StoreSettings.
export const SEO_DEFAULTS = {
  title: process.env.REACT_APP_SEO_TITLE || "Store",
  description: process.env.REACT_APP_SEO_DESCRIPTION || "Premium online store",
  ogImage: process.env.REACT_APP_SEO_OG_IMAGE || "/logo.png",
};

export default SEO_DEFAULTS;
