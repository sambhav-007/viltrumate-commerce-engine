/*
 * Aura Rare demo seed (DEVELOPMENT ONLY) — previews the storefront with the
 * original cosmetics catalog. Real client stores start empty (see provisioning).
 * Run: node scripts/seed.js   (uses DATABASE from .env)
 * WARNING: clears catalog collections + StoreSettings first.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { connect } = require("../config/db");
const StoreSettings = require("../models/storeSettings");
const { seedCatalog } = require("../provisioning/seedCatalog");
const auraRare = require("../provisioning/presets/aura-rare.json");

async function run() {
  await connect();
  console.log("Connected. Seeding Aura Rare demo…");

  // Store settings (singleton) — Aura Rare identity for the demo storefront.
  await StoreSettings.deleteMany({});
  await StoreSettings.create({
    storeName: "Aura Rare",
    whatsappNumber: "919876543210",
    address: "Mumbai, India",
    aboutUs:
      "Aura Rare is a premium cosmetics house crafting nail lacquers, lipsticks and beauty essentials in considered, wearable shades — made to let your natural glow lead.",
    contactEmail: "hello@aurarare.in",
    contactPhone: "+91 98765 43210",
    instagramUrl: "https://instagram.com",
    facebookUrl: "https://facebook.com",
    heroHeading: "Quiet Luxury, Bare Skin",
    heroSubheading: "Cosmetics crafted to let you glow.",
  });

  const counts = await seedCatalog(auraRare);
  console.log(
    `Seed complete: ${counts.categories} categories, ${counts.products} products, ${counts.variants} variants.`
  );
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
