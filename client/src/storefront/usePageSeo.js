import { useEffect } from "react";

// Per-page SEO for a CRA app: sets document.title, meta description, og:*
// tags and an optional JSON-LD block for the current page, restoring nothing
// on unmount (the next page or SeoHead overwrites). Crawlers that execute JS
// (Google) pick these up; the store-level tags from SeoHead stay the default.
const setMeta = (attr, key, content) => {
  if (content == null) return;
  let tag = document.querySelector(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
};

const JSONLD_ID = "vce-page-jsonld";

export default function usePageSeo({ title, description, image, jsonLd }) {
  useEffect(() => {
    if (title) {
      document.title = title;
      setMeta("property", "og:title", title);
    }
    if (description) {
      setMeta("name", "description", description);
      setMeta("property", "og:description", description);
    }
    if (image) setMeta("property", "og:image", image);
    setMeta("property", "og:url", window.location.href);

    let script = document.getElementById(JSONLD_ID);
    if (jsonLd) {
      if (!script) {
        script = document.createElement("script");
        script.id = JSONLD_ID;
        script.type = "application/ld+json";
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLd);
    } else if (script) {
      script.remove();
    }

    return () => {
      // Drop page-scoped JSON-LD when leaving; meta tags are overwritten by
      // the next page (or remain as last-set, which is fine for a SPA).
      const s = document.getElementById(JSONLD_ID);
      if (s) s.remove();
    };
  }, [title, description, image, JSON.stringify(jsonLd)]); // eslint-disable-line react-hooks/exhaustive-deps
}
