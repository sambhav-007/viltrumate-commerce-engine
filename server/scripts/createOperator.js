/*
 * Create (or update) an agency operator in the Platform Database.
 * Usage: node scripts/createOperator.js <email> <password(8+)> [name] [role]
 *   role ∈ owner | admin | operator | viewer   (default: operator)
 *
 * Operators are agency users of the VCE Panel, stored in `vce_platform`
 * (PLATFORM_DATABASE). The panel still gates on PANEL_KEY today; this seeds the
 * operator directory that the audit log attributes actions to.
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { platform, configured } = require("../platform");

async function run() {
  const [email, password, name = "Operator", role = "operator"] = process.argv.slice(2);
  if (!email || !password || password.length < 8) {
    console.error("Usage: node scripts/createOperator.js <email> <password(8+)> [name] [role]");
    process.exit(1);
  }
  if (!configured()) {
    console.error("PLATFORM_DATABASE is not set — cannot create an operator.");
    process.exit(1);
  }
  const { Operator, connection } = platform();
  const hash = bcrypt.hashSync(password, 10);
  const existing = await Operator.findOne({ email: email.toLowerCase() });
  if (existing) {
    existing.password = hash;
    existing.name = name;
    existing.role = role;
    existing.active = true;
    await existing.save();
    console.log(`Operator updated: ${email} (${role})`);
  } else {
    await Operator.create({ name, email, password: hash, role });
    console.log(`Operator created: ${email} (${role})`);
  }
  await connection.close();
}

run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
