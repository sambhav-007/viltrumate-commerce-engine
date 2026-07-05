// Per-store plugin runtime state, mirrored into the STORE's own database so the
// commerce server (app.js) can load enabled plugins at boot without reaching the
// platform database. The authoritative record lives in the platform database
// (PluginState); the panel keeps this store-side mirror in sync on every change.
const mongoose = require("mongoose");

const COLL = "pluginruntimes";

function runtimeModel() {
  if (mongoose.models[COLL]) return mongoose.model(COLL);
  const schema = new mongoose.Schema(
    {
      pluginId: { type: String, required: true, unique: true, index: true },
      version: { type: String, default: "" },
      installed: { type: Boolean, default: false },
      enabled: { type: Boolean, default: false },
      settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { timestamps: true, collection: COLL }
  );
  return mongoose.model(COLL, schema);
}

module.exports = { runtimeModel };
