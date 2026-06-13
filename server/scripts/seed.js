/*
 * Demo seed for previewing the Aura Rare UI (no images — uses placeholders).
 * Run: node scripts/seed.js   (uses DATABASE from .env)
 * WARNING: clears catalog collections first.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { baseSlug } = require("../config/slug");

const Category = require("../models/categories");
const Product = require("../models/products");
const Shade = require("../models/shades");
const Review = require("../models/reviews");
const StoreSettings = require("../models/storeSettings");

const pad2 = (n) => String(n).padStart(2, "0");

async function run() {
  await mongoose.connect(process.env.DATABASE, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
  });
  console.log("Connected. Clearing catalog…");
  await Promise.all([
    Category.deleteMany({}),
    Product.deleteMany({}),
    Shade.deleteMany({}),
    Review.deleteMany({}),
  ]);

  // Store settings (singleton)
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

  // Categories
  const cats = {};
  let order = 0;
  for (const name of [
    "Lipstick",
    "Nail Lacquer",
    "Nail Paint",
    "NPR Tissue",
    "Combo Packs",
  ]) {
    cats[name] = await Category.create({
      name,
      slug: baseSlug(name),
      description: `${name} by Aura Rare`,
      status: "Active",
      order: order++,
    });
  }

  // Products: [name, category, featured, shadeMode, count, price, mrp]
  const products = [
    ["Smile & Shine", "Lipstick", true, "named", 0, 199, 299],
    ["Mattitude", "Lipstick", false, "numbered", 36, 249, 349],
    ["Rafael", "Nail Lacquer", true, "numbered", 60, 59, 65],
    ["England", "Nail Paint", false, "numbered", 60, 49, 59],
    ["Aura Swift Erase", "NPR Tissue", false, "numbered", 6, 99, 129],
    ["Aura Bare Bear Wipes", "NPR Tissue", false, "numbered", 6, 99, 129],
    ["Potlis", "Combo Packs", true, "numbered", 4, 499, 699],
    ["Box", "Combo Packs", false, "numbered", 3, 799, 999],
  ];

  const lipstickShades = [
    "Passionate Red",
    "Hot Red",
    "Rusty Nude",
    "Maroon Bride",
    "Pink Blush",
    "Coral Crush",
    "Mauve Muse",
    "Berry Bold",
    "Spiced Cocoa",
    "Rose Petal",
    "Cherry Noir",
    "Terracotta",
    "Soft Plum",
    "Caramel",
    "Brick Lane",
    "Wine Velvet",
    "Peach Nude",
    "Dusty Rose",
    "Crimson",
    "Toffee",
    "Magenta",
    "Bare Beige",
    "Scarlet",
    "Cocoa Kiss",
  ];

  for (const [pname, cat, featured, mode, count, price, mrp] of products) {
    const product = await Product.create({
      name: pname,
      slug: baseSlug(pname),
      description: `${pname} — a signature ${cat.toLowerCase()} collection from Aura Rare.`,
      category: cats[cat]._id,
      isFeatured: featured,
      status: "Active",
    });

    const names =
      mode === "named"
        ? lipstickShades
        : Array.from({ length: count }, (_, i) => `Shade ${pad2(i + 1)}`);

    const docs = names.map((nm, i) => ({
      product: product._id,
      name: nm,
      slug: `${baseSlug(pname)}-${baseSlug(nm)}-${i}`,
      price,
      mrp,
      status: "Active",
      images: [],
    }));
    const shades = await Shade.insertMany(docs);

    // A couple of approved reviews on the first shade
    if (shades[0]) {
      await Review.create([
        {
          shade: shades[0]._id,
          product: product._id,
          customerName: "Aisha",
          rating: 5,
          text: "Gorgeous shade, lasts all day.",
          approved: true,
        },
        {
          shade: shades[0]._id,
          product: product._id,
          customerName: "Neha",
          rating: 4,
          text: "Lovely finish, will reorder.",
          approved: true,
        },
      ]);
    }
    console.log(`  ${pname}: ${shades.length} shades`);
  }

  console.log("Seed complete.");
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
