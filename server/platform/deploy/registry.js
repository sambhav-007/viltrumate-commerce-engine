const { LocalProvider } = require("./localProvider");

// Provider registry. New deployment targets (Vercel, Render, Docker, …) register
// here and become available to the panel without any panel/commerce changes.
const PROVIDERS = {
  local: LocalProvider,
};

function listProviders() {
  return Object.keys(PROVIDERS);
}

function getProvider(name, ctx) {
  const Provider = PROVIDERS[name || "local"];
  if (!Provider) throw new Error(`Unknown deployment provider "${name}"`);
  return new Provider(ctx);
}

module.exports = { getProvider, listProviders };
