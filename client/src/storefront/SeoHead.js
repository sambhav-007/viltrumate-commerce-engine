import { useEffect } from "react";
import { useSettings } from "../context/SettingsContext";
import { SEO_DEFAULTS } from "../config/seo.config";
import { STORE_NAME } from "../config/store.config";

// Runtime per-store SEO. CRA's index.html is static, so document.title and the
// meta description are set here from StoreSettings.seo (with sensible fallbacks).
const SeoHead = () => {
  const s = useSettings();
  useEffect(() => {
    const seo = (s && s.seo) || {};
    document.title =
      seo.metaTitle || s.storeName || SEO_DEFAULTS.title || STORE_NAME;

    const desc = seo.metaDescription || SEO_DEFAULTS.description;
    let tag = document.querySelector('meta[name="description"]');
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute("name", "description");
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", desc);
  }, [s]);
  return null;
};

export default SeoHead;
