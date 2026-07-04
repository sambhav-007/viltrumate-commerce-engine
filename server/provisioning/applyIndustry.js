const fs = require("fs");
const path = require("path");

// Industry presets: one JSON per vertical (provisioning/industries/*.json)
// bundling variant label + 3B theme personality + layout + feature flags +
// starter categories. Selected via `store.industry` in the manifest.
//
// Merge rule: the industry fills DEFAULTS UNDER the manifest — any value the
// operator set explicitly always wins. Empty strings/arrays/objects count as
// "unset" so the example-manifest scaffolding doesn't block industry values.

const INDUSTRIES_DIR = path.join(__dirname, "industries");

const isUnset = (v) =>
  v === undefined ||
  v === null ||
  v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);

// Fill target's unset keys from defaults, recursively for plain objects.
function mergeUnder(target, defaults) {
  if (defaults == null || typeof defaults !== "object" || Array.isArray(defaults)) {
    return isUnset(target) ? defaults : target;
  }
  const out = target && typeof target === "object" && !Array.isArray(target) ? target : {};
  for (const k of Object.keys(defaults)) {
    out[k] = mergeUnder(out[k], defaults[k]);
  }
  return out;
}

function listIndustries() {
  if (!fs.existsSync(INDUSTRIES_DIR)) return [];
  return fs
    .readdirSync(INDUSTRIES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

// Mutates + returns the manifest with industry defaults merged under it.
// Also returns the industry's starter categories (seeded when the catalog
// preset itself is empty). No industry key -> no-op.
function applyIndustry(manifest) {
  const id = manifest.store && manifest.store.industry;
  if (!id) return { manifest, categories: [] };
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Invalid industry: ${id}`);

  const file = path.join(INDUSTRIES_DIR, `${id}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Unknown industry "${id}" — available: ${listIndustries().join(", ")}`);
  }
  const ind = JSON.parse(fs.readFileSync(file, "utf8"));

  const s = manifest.store;
  // loadManifest.withDefaults runs first and stamps the generic "Variant"
  // placeholder — treat it as unset so the industry's label can fill it
  // (an operator who explicitly wants "Variant" keeps it: no industry sets it).
  if (s.identity && s.identity.variantLabel === "Variant") {
    s.identity.variantLabel = "";
  }
  s.identity = mergeUnder(s.identity, ind.identity || {});
  if (!s.identity.variantLabel) s.identity.variantLabel = "Variant"; // restore default
  s.branding = s.branding || {};
  s.branding.theme = mergeUnder(s.branding.theme, ind.theme || {});
  s.branding.layout = mergeUnder(s.branding.layout, ind.layout || {});
  s.commerce = s.commerce || {};
  s.commerce.features = mergeUnder(s.commerce.features, ind.features || {});

  return { manifest, categories: ind.categories || [] };
}

module.exports = { applyIndustry, listIndustries, mergeUnder };
