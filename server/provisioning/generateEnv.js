const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SERVER_DIR = path.resolve(__dirname, "..");
const CLIENT_DIR = path.resolve(__dirname, "..", "..", "client");

// Secrets are supplied by the OPERATOR ENVIRONMENT, never by the manifest:
//   PROVISION_CLUSTER_URI  e.g. mongodb+srv://user:pass@cluster.mongodb.net
//   CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
// The manifest only contributes the per-store DB NAME and Cloudinary FOLDER.
function buildDatabaseUri(dbName) {
  const cluster = process.env.PROVISION_CLUSTER_URI;
  if (!cluster) {
    throw new Error(
      "PROVISION_CLUSTER_URI is required (mongodb+srv://user:pass@cluster.mongodb.net)"
    );
  }
  const base = cluster.replace(/\/+$/, "").split("?")[0];
  return `${base}/${dbName}?retryWrites=true&w=majority`;
}

const render = (obj) =>
  Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n";

function writeSafe(file, content, force) {
  if (fs.existsSync(file) && !force) {
    throw new Error(`${file} already exists — re-run with force to overwrite`);
  }
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`); // rollback point
  fs.writeFileSync(file, content);
}

// Generate server/.env and client/.env from a normalized manifest.
// targetDir overrides exist for testing (write to a scratch dir, not the repo).
function generateEnv(
  manifest,
  { force = false, serverDir = SERVER_DIR, clientDir = CLIENT_DIR } = {}
) {
  const infra = manifest.infrastructure;
  const idn = manifest.store.identity;
  const seo = (manifest.store.branding && manifest.store.branding.seo) || {};

  const serverEnv = render({
    DATABASE: buildDatabaseUri(infra.database.name),
    PORT: 8000,
    DNS_SERVERS: process.env.DNS_SERVERS || "8.8.8.8,1.1.1.1",
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",
    CLOUDINARY_FOLDER: infra.cloudinary.folder,
    STORE_NAME: idn.storeName,
    CURRENCY_SYMBOL: idn.currencySymbol,
    LOCALE: idn.locale,
    JWT_SECRET: crypto.randomBytes(48).toString("hex"),
    CORS_ORIGINS: (infra.client && infra.client.url) || "",
  });

  const clientEnv = render({
    REACT_APP_API_URL: infra.api.url,
    REACT_APP_STORE_NAME: idn.storeName,
    REACT_APP_CURRENCY_SYMBOL: idn.currencySymbol,
    REACT_APP_LOCALE: idn.locale,
    REACT_APP_VARIANT_LABEL: idn.variantLabel,
    REACT_APP_SEO_TITLE: seo.metaTitle || idn.storeName,
    REACT_APP_SEO_DESCRIPTION: seo.metaDescription || "",
  });

  const serverPath = path.join(serverDir, ".env");
  const clientPath = path.join(clientDir, ".env");
  writeSafe(serverPath, serverEnv, force);
  writeSafe(clientPath, clientEnv, force);
  return { serverPath, clientPath };
}

module.exports = { generateEnv, buildDatabaseUri };
