const crypto = require("crypto");

// Build a store database URI from the operator's cluster root (mirrors
// provisioning/generateEnv.buildDatabaseUri, but honors the passed env so
// generation is self-contained/testable rather than reading process.env).
function databaseUriFrom(env, dbName) {
  const cluster = env.PROVISION_CLUSTER_URI;
  if (!cluster) {
    throw new Error("PROVISION_CLUSTER_URI is required (mongodb+srv://user:pass@cluster.mongodb.net)");
  }
  const base = cluster.replace(/\/+$/, "").split("?")[0];
  return `${base}/${dbName}?retryWrites=true&w=majority`;
}

// ============================================================================
// Deployment package builder — turns platform metadata + store settings + the
// operator environment into the full set of files a deployment needs. Pure:
// returns { files, healthcheck, rollback, meta } in memory; the provider writes
// them to disk. Values flow straight from their source (platform Store, the
// store's manifest, live StoreSettings, operator env) — never duplicated by hand.
//
//   Identity → Database → Theme → Payments → Secrets → Generate
// ============================================================================

const renderEnv = (obj) =>
  Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n";

function buildPackage({ store, settings, manifest, version, gitCommit, environment, env = process.env }) {
  const infra = (manifest && manifest.infrastructure) || {};
  const mIdentity = (manifest && manifest.store && manifest.store.identity) || {};

  // ---- Identity (platform + manifest + live settings; live settings win) ----
  const storeName = settings.storeName || store.name || mIdentity.storeName || store.storeId;
  const currencySymbol = mIdentity.currencySymbol || "₹";
  const locale = mIdentity.locale || "en-IN";
  const variantLabel = settings.variantLabel || mIdentity.variantLabel || "Variant";

  // ---- Database (databaseName is authoritative on the platform Store) ----
  const dbName = store.databaseName || (infra.database && infra.database.name);
  const databaseUri = databaseUriFrom(env, dbName);

  // ---- Infrastructure URLs ----
  const apiUrl = (infra.api && infra.api.url) || "http://localhost:8000";
  const clientUrl = store.domain || (infra.client && infra.client.url) || "http://localhost:3000";
  const cloudinaryFolder = (infra.cloudinary && infra.cloudinary.folder) || `vce/${store.storeId}`;

  // ---- Payments ----
  const payment = settings.payment || {};
  const providers = payment.enabledProviders || ["whatsapp"];
  const razorpayEnabled = providers.includes("razorpay");
  const razorpayKeyId =
    env.RAZORPAY_KEY_ID ||
    (manifest && manifest.store && manifest.store.commerce && manifest.store.commerce.payment &&
      manifest.store.commerce.payment.razorpay && manifest.store.commerce.payment.razorpay.keyId) ||
    "";

  // ---- Secrets (operator environment only) ----
  const jwtSecret = crypto.randomBytes(48).toString("hex");

  const backendEnv = renderEnv({
    // identity
    STORE_NAME: storeName,
    CURRENCY_SYMBOL: currencySymbol,
    LOCALE: locale,
    // database
    DATABASE: databaseUri,
    PORT: 8000,
    DNS_SERVERS: env.DNS_SERVERS || "8.8.8.8,1.1.1.1",
    // cloudinary
    CLOUDINARY_CLOUD_NAME: env.CLOUDINARY_CLOUD_NAME || "",
    CLOUDINARY_API_KEY: env.CLOUDINARY_API_KEY || "",
    CLOUDINARY_API_SECRET: env.CLOUDINARY_API_SECRET || "",
    CLOUDINARY_FOLDER: cloudinaryFolder,
    // payments
    RAZORPAY_KEY_ID: razorpayEnabled ? razorpayKeyId : "",
    RAZORPAY_KEY_SECRET: razorpayEnabled ? env.RAZORPAY_KEY_SECRET || "" : "",
    RAZORPAY_WEBHOOK_SECRET: razorpayEnabled ? env.RAZORPAY_WEBHOOK_SECRET || "" : "",
    // secrets + cors
    JWT_SECRET: jwtSecret,
    CORS_ORIGINS: clientUrl,
    NOTIFY_WEBHOOK_URL: "",
  });

  const frontendEnv = renderEnv({
    REACT_APP_API_URL: apiUrl,
    REACT_APP_STORE_NAME: storeName,
    REACT_APP_CURRENCY_SYMBOL: currencySymbol,
    REACT_APP_LOCALE: locale,
    REACT_APP_VARIANT_LABEL: variantLabel,
    REACT_APP_RAZORPAY_KEY_ID: razorpayEnabled ? razorpayKeyId : "",
  });

  // ---- Healthcheck manifest (endpoints/values a verifier can later probe) ----
  const healthcheck = {
    store: store.storeId,
    version,
    api: `${apiUrl.replace(/\/$/, "")}/api/store-settings`,
    frontend: clientUrl,
    database: dbName,
    payments: { providers, default: payment.defaultProvider || "whatsapp" },
    cloudinary: cloudinaryFolder,
    generatedAt: new Date().toISOString(),
  };

  // ---- Non-secret rollback metadata (enough to redeploy a prior version) ----
  const rollback = {
    version,
    gitCommit: gitCommit || "",
    databaseName: dbName,
    apiUrl,
    clientUrl,
    cloudinaryFolder,
    providers,
  };

  // ---- deployment.json (secret-free manifest of the package) ----
  const deploymentJson = {
    store: { id: store.storeId, name: storeName, industry: store.industry || "" },
    version,
    provider: "local",
    environment: environment || "production",
    gitCommit: gitCommit || "",
    generatedAt: healthcheck.generatedAt,
    infrastructure: { apiUrl, clientUrl, databaseName: dbName, cloudinaryFolder },
    commerce: {
      payment: { providers, default: payment.defaultProvider || "whatsapp" },
      features: settings.features || {},
    },
    files: ["frontend.env", "backend.env", "deployment.json", "healthcheck.json", "README.md", "nginx.conf.example", "start.sh", "SECRETS.md"],
    healthcheck,
    rollback,
  };

  const secretsChecklist = [
    { key: "DATABASE", where: "backend.env", note: "MongoDB Atlas URI incl. db name" },
    { key: "CLOUDINARY_API_SECRET", where: "backend.env", note: "image storage secret" },
    { key: "JWT_SECRET", where: "backend.env", note: "freshly generated — reuse the prior value on redeploy to keep admin sessions" },
    razorpayEnabled && { key: "RAZORPAY_KEY_SECRET", where: "backend.env", note: "online payment secret" },
    razorpayEnabled && { key: "RAZORPAY_WEBHOOK_SECRET", where: "backend.env", note: "verify webhook authenticity (recommended)" },
  ].filter(Boolean);

  const nginx = nginxExample({ storeName, clientUrl, apiUrl });
  const startSh = startScript({ storeName });
  const secretsMd = secretsMarkdown(secretsChecklist);
  const readme = readmeMarkdown({ store, storeName, version, environment: deploymentJson.environment, providers, dbName, apiUrl, clientUrl });

  const files = {
    "frontend.env": frontendEnv,
    "backend.env": backendEnv,
    "deployment.json": JSON.stringify(deploymentJson, null, 2) + "\n",
    "healthcheck.json": JSON.stringify(healthcheck, null, 2) + "\n",
    "README.md": readme,
    "nginx.conf.example": nginx,
    "start.sh": startSh,
    "SECRETS.md": secretsMd,
  };

  return { files, healthcheck, rollback, deploymentJson, secretsChecklist, meta: { storeName, dbName, apiUrl, clientUrl } };
}

function nginxExample({ storeName, clientUrl, apiUrl }) {
  let clientHost = "your-store.example.com";
  try { clientHost = new URL(clientUrl).host; } catch (e) {}
  return `# Reverse-proxy example for ${storeName} (adapt to your host).
# Frontend is a static CRA build; API is the Express server on :8000.

server {
  listen 80;
  server_name ${clientHost};

  # Static storefront + admin build (client/build)
  root /var/www/${slug(storeName)}/client/build;
  index index.html;

  location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # SPA fallback
  location / {
    try_files $uri /index.html;
  }
}
# API base for the frontend build: ${apiUrl}
`;
}

function startScript({ storeName }) {
  return `#!/usr/bin/env bash
# Startup commands for ${storeName}. Run from the repo root after placing
# backend.env -> server/.env and frontend.env -> client/.env.
set -e

# 1. Backend
cd server
npm ci --omit=dev
# create the admin (first deploy only):
# node scripts/createAdmin.js <email> <password(8+)> "Admin"
npm run start:dev &   # or: pm2 start app.js --name ${slug(storeName)}-api

# 2. Frontend (build once, serve statically behind nginx)
cd ../client
npm ci
npm run build
# serve client/build via nginx (see nginx.conf.example)
`;
}

function secretsMarkdown(list) {
  return `# Required secrets checklist

Fill/verify these before the store goes live. Secrets live ONLY in the server
environment (backend.env) — never in the client build.

${list.map((s) => `- [ ] **${s.key}** (${s.where}) — ${s.note}`).join("\n")}
`;
}

function readmeMarkdown({ store, storeName, version, environment, providers, dbName, apiUrl, clientUrl }) {
  return `# ${storeName} — deployment package (v${version})

Generated by the VCE Deployment Engine (Local/Manual provider). This package
contains everything needed to bring the store live. It does **not** deploy
automatically — follow the steps below.

- **Store id:** ${store.storeId}
- **Environment:** ${environment}
- **Database:** ${dbName}
- **API URL:** ${apiUrl}
- **Storefront URL:** ${clientUrl}
- **Payment providers:** ${providers.join(", ")}

## Contents
- \`backend.env\` → copy to \`server/.env\` (contains secrets — keep private)
- \`frontend.env\` → copy to \`client/.env\`
- \`deployment.json\` → machine-readable manifest of this package
- \`healthcheck.json\` → endpoints/values for post-deploy verification
- \`nginx.conf.example\` → reverse-proxy template
- \`start.sh\` → build + startup commands
- \`SECRETS.md\` → required-secrets checklist

## Steps
1. \`cp backend.env server/.env\` and \`cp frontend.env client/.env\`.
2. Review \`SECRETS.md\` and confirm every value.
3. Run \`start.sh\` (or its commands) to build the client and start the API.
4. Create the admin user (first deploy): \`node scripts/createAdmin.js <email> <pw>\`.
5. Verify against \`healthcheck.json\`.

Regenerating the package bumps the version. \`JWT_SECRET\` is freshly generated
each time — reuse the previous value on redeploy to keep admin sessions valid.
`;
}

const slug = (s) => String(s || "store").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

module.exports = { buildPackage };
