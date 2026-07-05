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

// content is stored as [{k,v}] pairs (dots aren't allowed in DB field names).
const toEntries = (o) => Object.entries(o).map(([k, v]) => ({ k, v }));

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
    instagramUrl: "https://instagram.com/aurarare",
    facebookUrl: "https://facebook.com",
    heroHeading: "Quiet Luxury, Bare Skin",
    heroSubheading: "Cosmetics crafted to let you glow.",
    // Aura's original storefront copy, relocated from React into data so the
    // demo store reads textually identical while the engine defaults stay generic.
    content: toEntries({
      "home.hero.eyebrow": "{storeName} · Rare by Nature",
      "home.hero.cta": "Explore Collection",
      "home.bestsellers.eyebrow": "Loved Most",
      "home.story.title": "Rare by Nature",
      "home.story.cta": "Discover the Range",
      "home.featured.eyebrow": "The Edit",
      "home.featured.title": "Featured Shades",
      "home.testimonial.quote":
        "“Quiet luxury you can wear every day. The shades feel considered, the finish effortless.”",
      "home.testimonial.attribution": "— The {storeName} Community",
      "home.social.title": "Join the Aura",
      "footer.tagline": "Rare by Nature",
      "footer.cta": "Order on WhatsApp",
      "footer.strip": "Crafted with care · Ordered over WhatsApp",
      "about.title": "Rare by Nature",
      "about.cta": "Explore the Collection",
      "thankyou.body":
        "Your order has been opened in WhatsApp. Please press send there to confirm it with us — we'll reply shortly to arrange delivery.",
      "thankyou.bodyAlt": "Didn't reach WhatsApp? Message us directly at {contactPhone}.",
      "nav.cta": "Order via WhatsApp",
      "product.card.count": "{count} Shades",
      "search.empty.hint": "Try a shade name, product, or collection.",
      "search.empty.cta": "Browse Collections",
      "search.section.variants": "Shades",
    }),
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
