import { useSettings } from "../context/SettingsContext";
import { STORE_NAME, VARIANT_LABEL } from "./store.config";

// Vertical-neutral storefront copy. Per-store overrides live in
// StoreSettings.content (admin / provisioning manifest); these are the generic
// fallbacks. Read via resolveContent(settings, key[, vars]) or the useContent()
// hook. Placeholders {storeName} {variantLabel} {variantLabelPlural} {year}
// (plus any call-site vars, e.g. {count}) are interpolated at read time.
export const CONTENT_DEFAULTS = {
  // Home — hero
  "home.hero.eyebrow": "{storeName}",
  "home.hero.heading": "Welcome to {storeName}",
  "home.hero.sub": "Discover our collection.",
  "home.hero.cta": "Shop Now",
  "home.hero.scroll": "Scroll",
  // Home — categories
  "home.categories.eyebrow": "Collections",
  "home.categories.title": "Shop by Category",
  // Home — best sellers
  "home.bestsellers.eyebrow": "Popular",
  "home.bestsellers.title": "Best Sellers",
  "home.bestsellers.viewAll": "View All",
  // Home — story
  "home.story.eyebrow": "Our Story",
  "home.story.title": "About {storeName}",
  "home.story.body":
    "{storeName} brings together a considered selection — made to be enjoyed.",
  "home.story.cta": "Browse Products",
  // Home — featured
  "home.featured.eyebrow": "Featured",
  "home.featured.title": "Featured Products",
  // Home — testimonial (empty quote => section hidden)
  "home.testimonial.eyebrow": "Loved by Many",
  "home.testimonial.quote": "",
  "home.testimonial.attribution": "",
  // Home — social
  "home.social.eyebrow": "Follow",
  "home.social.title": "Follow Us",

  // Product card (count supplied at call site)
  "product.card.count": "{count} {variantLabelPlural}",

  // Search
  "search.eyebrow": "Search",
  "search.empty.title": "Nothing found",
  "search.empty.hint": "Try a {variantLabel}, product, or category.",
  "search.empty.cta": "Browse Categories",
  "search.section.variants": "{variantLabelPlural}",
  "search.section.products": "Products",
  "search.section.categories": "Categories",

  // Footer
  "footer.tagline": "{storeName}",
  "footer.blurb": "",
  "footer.cta": "Order Now",
  "footer.col.shop": "Shop",
  "footer.col.shopAll": "All Collections",
  "footer.col.explore": "Explore",
  "footer.col.connect": "Connect",
  "footer.strip": "",

  // About
  "about.eyebrow": "Our Story",
  "about.title": "About {storeName}",
  "about.body":
    "{storeName} brings together a considered selection — made to be enjoyed.",
  "about.cta": "Browse Products",

  // Contact
  "contact.eyebrow": "Get in Touch",
  "contact.title": "Contact Us",

  // Thank You
  "thankyou.eyebrow": "Order Sent",
  "thankyou.title": "Thank You",
  "thankyou.body":
    "Your order has been placed. We'll be in touch shortly to confirm and arrange delivery.",
  "thankyou.bodyAlt": "",
  "thankyou.cta": "Continue Shopping",

  // Collections
  "collections.eyebrow": "Explore",
  "collections.title": "Collections",

  // Not found
  "notfound.title": "404",
  "notfound.body": "This page could not be found.",
  "notfound.cta": "Return Home",

  // Nav
  "nav.shop": "Shop",
  "nav.shopAll": "Shop All",
  "nav.cta": "Order Now",
};

const plural = (w) => (w ? `${w}s` : w);

// Resolve a content slot for the active store: explicit override wins (even an
// intentional empty string), else the generic default, then interpolate vars.
export const resolveContent = (settings = {}, key, vars = {}) => {
  const overrides = settings.content || {};
  const has = Object.prototype.hasOwnProperty.call(overrides, key);
  let str = has ? overrides[key] : CONTENT_DEFAULTS[key];
  if (str == null) str = "";

  const variantLabel = settings.variantLabel || VARIANT_LABEL;
  const map = {
    storeName: settings.storeName || STORE_NAME,
    variantLabel,
    variantLabelPlural: plural(variantLabel),
    contactPhone: settings.contactPhone || "",
    contactEmail: settings.contactEmail || "",
    year: new Date().getFullYear(),
    ...vars,
  };
  return String(str).replace(/\{(\w+)\}/g, (m, k) => (map[k] != null ? map[k] : m));
};

// Hook for components: returns a t(key, vars) bound to the current store.
export const useContent = () => {
  const settings = useSettings();
  return (key, vars) => resolveContent(settings, key, vars);
};
