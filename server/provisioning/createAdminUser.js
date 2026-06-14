const bcrypt = require("bcryptjs");
const userModel = require("../models/users");

// Idempotently provision the store's admin user. Creates it, or resets the
// password + ensures the admin role if the email already exists. Returns
// { created } so the orchestrator can report accurately.
async function createAdminUser({ email, password, name = "Store Admin" }) {
  if (!email || !password || password.length < 8) {
    throw new Error("admin email and password (8+ chars) are required");
  }
  const hash = bcrypt.hashSync(password, 10);
  const existing = await userModel.findOne({ email });
  if (existing) {
    existing.password = hash;
    existing.userRole = 1;
    if (!existing.name) existing.name = name;
    await existing.save();
    return { created: false };
  }
  await userModel.create({ name, email, password: hash, userRole: 1 });
  return { created: true };
}

module.exports = { createAdminUser };
