// Back-compat shim. The model moved to ./variants (registered as "shades").
// Existing `require("../models/shades")` call sites keep working unchanged.
module.exports = require("./variants");
