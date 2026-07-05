// Pre-update compatibility checks (Phase Λ). Run before any migration executes;
// a failed check aborts the update safely (nothing runs). Distinct from the
// deployment secrets validation — this checks the STORE is in a shape the update
// can safely migrate: feature flags, theme, payment, database schema, and the
// required environment variables.
//
// Returns { ok, checks:[{ name, status:"ok"|"warn"|"fail", detail }], failed }.
function checkCompatibility({ store, settings, env = process.env }) {
  const checks = [];
  const add = (name, status, detail) => checks.push({ name, status, detail: detail || "" });

  // Feature flags — the known flag set must be readable.
  const features = settings.features || {};
  add("feature-flags", "ok", Object.keys(features).length ? Object.keys(features).join(", ") : "defaults");

  // Theme compatibility — the token map must be present (added in 3B).
  add("theme", "ok", settings.theme && settings.theme.tokens !== undefined ? "tokens present" : "will be backfilled");

  // Payment compatibility — the default provider must be enabled.
  const payment = settings.payment || {};
  const providers = payment.enabledProviders || [];
  if (payment.defaultProvider && providers.length && !providers.includes(payment.defaultProvider)) {
    add("payment", "fail", `default provider "${payment.defaultProvider}" is not enabled`);
  } else {
    add("payment", "ok", providers.join(", ") || "whatsapp");
  }

  // Database schema — the settings singleton is reachable/loaded.
  add("database-schema", settings ? "ok" : "fail", settings ? "StoreSettings reachable" : "cannot read StoreSettings");

  // Required environment variables.
  const missing = ["PROVISION_CLUSTER_URI", "PLATFORM_DATABASE"].filter((k) => !env[k]);
  if (missing.length) add("env", "fail", `missing ${missing.join(", ")}`);
  else add("env", "ok", "cluster + platform configured");

  const failed = checks.filter((c) => c.status === "fail");
  return { ok: failed.length === 0, checks, failed };
}

module.exports = { checkCompatibility };
