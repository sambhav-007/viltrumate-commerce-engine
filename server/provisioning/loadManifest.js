const fs = require("fs");
const path = require("path");

// The store manifest is the single source of truth for one client store.
// It is SECRET-FREE by design (safe to version-control): cluster credentials and
// Cloudinary keys come from the operator environment at provision time, never
// from here. Forward-compatible — future phases (tenant routing, custom domains,
// multiple admins, email notifications, Razorpay/Stripe) add keys without
// breaking v1 consumers, which ignore unknown fields.

const REQUIRED = ["store.id", "store.identity.storeName", "admin.email"];

const get = (obj, dotted) =>
  dotted.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);

const set = (obj, dotted, val) => {
  const keys = dotted.split(".");
  const last = keys.pop();
  let o = obj;
  for (const k of keys) o = o[k] = o[k] || {};
  o[last] = val;
};

// Fill structural + id-derived defaults so downstream consumers never branch.
function withDefaults(m) {
  m.version = m.version || 1;
  m.store = m.store || {};
  const s = m.store;
  const id = s.id;

  s.identity = s.identity || {};
  s.identity.currencySymbol = s.identity.currencySymbol || "₹";
  s.identity.locale = s.identity.locale || "en-IN";
  s.identity.variantLabel = s.identity.variantLabel || "Variant";

  s.branding = s.branding || {};
  s.branding.theme = s.branding.theme || { colors: {} };
  s.branding.theme.colors = s.branding.theme.colors || {};
  s.branding.seo = s.branding.seo || {};
  s.branding.logoUrl = s.branding.logoUrl || "";

  s.commerce = s.commerce || {};
  s.commerce.features = s.commerce.features || {};
  s.commerce.payment = s.commerce.payment || {
    enabledProviders: ["whatsapp"],
    defaultProvider: "whatsapp",
  };

  s.catalog = s.catalog || { preset: "empty" };

  m.admin = m.admin || {};
  m.admin.name = m.admin.name || "Store Admin";

  m.infrastructure = m.infrastructure || {};
  const infra = m.infrastructure;
  infra.database = infra.database || {};
  if (!infra.database.name && id) infra.database.name = `vce-${id}`;
  infra.cloudinary = infra.cloudinary || {};
  if (!infra.cloudinary.folder && id) infra.cloudinary.folder = `vce/${id}`;
  infra.api = infra.api || { url: "http://localhost:8000" };
  infra.client = infra.client || { url: "http://localhost:3000" };

  return m;
}

// Load + normalize a manifest file. Returns the manifest plus the list of any
// still-missing required fields (the orchestrator can prompt for these).
function load(file) {
  const abs = path.resolve(file);
  const manifest = withDefaults(JSON.parse(fs.readFileSync(abs, "utf8")));
  const missing = REQUIRED.filter((k) => !get(manifest, k));
  return { manifest, missing, file: abs };
}

// Write a manifest back (used after interactive prompts fill missing values).
function save(file, manifest) {
  fs.writeFileSync(
    path.resolve(file),
    JSON.stringify(manifest, null, 2) + "\n"
  );
}

module.exports = { load, save, withDefaults, REQUIRED, get, set };
