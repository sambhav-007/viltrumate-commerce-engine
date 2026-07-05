// Pre-flight validation for a deployment package. Confirms every value the
// generated environment needs is actually available — from the operator
// environment (secrets), the platform Store metadata, and the live StoreSettings
// — BEFORE a package is generated. A package is never generated with blocking
// gaps ("Do not generate invalid deployments").
//
// Returns { ok, checks:[{ name, status:"ok"|"missing"|"warn", detail }],
//           missing:[...], warnings:[...] }. ok=false when any check is "missing".

function validateDeployment({ store, settings, manifest, env = process.env }) {
  const checks = [];
  const add = (name, status, detail) => checks.push({ name, status, detail: detail || "" });

  // 1. Database — cluster credentials + the store's authoritative db name.
  if (!env.PROVISION_CLUSTER_URI) {
    add("database", "missing", "PROVISION_CLUSTER_URI is not set (cluster credentials)");
  } else if (!store.databaseName && !(manifest && manifest.infrastructure && manifest.infrastructure.database.name)) {
    add("database", "missing", "no databaseName on the store");
  } else {
    add("database", "ok", store.databaseName || manifest.infrastructure.database.name);
  }

  // 2. Panel / platform settings.
  if (!env.PLATFORM_DATABASE) add("panel", "missing", "PLATFORM_DATABASE is not set");
  else add("panel", "ok", "platform database configured");

  // 3. Cloudinary — image storage. Blocking: the admin cannot manage a catalog
  //    without it.
  const cloud = env.CLOUDINARY_CLOUD_NAME, ckey = env.CLOUDINARY_API_KEY, csec = env.CLOUDINARY_API_SECRET;
  if (!cloud || !ckey || !csec) {
    const gaps = [
      !cloud && "CLOUDINARY_CLOUD_NAME",
      !ckey && "CLOUDINARY_API_KEY",
      !csec && "CLOUDINARY_API_SECRET",
    ].filter(Boolean);
    add("cloudinary", "missing", `missing ${gaps.join(", ")}`);
  } else {
    add("cloudinary", "ok", cloud);
  }

  // 4. Payment keys — only required when razorpay is an enabled provider.
  const payment = settings.payment || {};
  const providers = payment.enabledProviders || [];
  if (providers.includes("razorpay")) {
    const keyId = env.RAZORPAY_KEY_ID || (manifest && manifest.store && manifest.store.commerce &&
      manifest.store.commerce.payment && manifest.store.commerce.payment.razorpay &&
      manifest.store.commerce.payment.razorpay.keyId);
    const secret = env.RAZORPAY_KEY_SECRET;
    if (!keyId || !secret) {
      add("payment", "missing", "razorpay is enabled but RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are missing");
    } else {
      add("payment", "ok", "razorpay keys present");
    }
  } else {
    add("payment", "ok", providers.length ? providers.join(", ") : "whatsapp/cod only");
  }

  // 5. Feature compatibility — non-fatal misconfigurations surface as warnings,
  //    except a default provider that isn't enabled (a checkout dead-end).
  if (payment.defaultProvider && providers.length && !providers.includes(payment.defaultProvider)) {
    add("feature-compat", "missing", `default provider "${payment.defaultProvider}" is not in enabledProviders`);
  } else {
    add("feature-compat", "ok", "");
  }
  const features = settings.features || {};
  if (features.whatsappCheckout && !settings.whatsappNumber) {
    add("whatsapp", "warn", "whatsappCheckout is on but no WhatsApp number is set");
  }
  if (providers.includes("stripe")) {
    add("stripe", "warn", "stripe is enabled but is a stub in this engine");
  }

  const missing = checks.filter((c) => c.status === "missing");
  const warnings = checks.filter((c) => c.status === "warn");
  return { ok: missing.length === 0, checks, missing, warnings };
}

module.exports = { validateDeployment };
