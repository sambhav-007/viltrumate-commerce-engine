/*
 * Create (or reset) the single admin account.
 * Usage: node scripts/createAdmin.js <email> <password> [name]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const userModel = require("../models/users");

async function run() {
  const [email, password, name = "Aura Admin"] = process.argv.slice(2);
  if (!email || !password || password.length < 8) {
    console.error("Usage: node scripts/createAdmin.js <email> <password(8+ chars)> [name]");
    process.exit(1);
  }
  await mongoose.connect(process.env.DATABASE, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
  });
  const hash = bcrypt.hashSync(password, 10);
  const existing = await userModel.findOne({ email });
  if (existing) {
    existing.password = hash;
    existing.userRole = 1;
    await existing.save();
    console.log(`Admin password reset for ${email}`);
  } else {
    await userModel.create({ name, email, password: hash, userRole: 1 });
    console.log(`Admin created: ${email}`);
  }
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
