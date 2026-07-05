// Shared MongoDB connection helper.
// Single source of truth for (1) the DNS-SRV workaround some Windows hosts need
// and (2) the connect call, so app.js and every script connect identically.
const mongoose = require("mongoose");
const dns = require("dns");

// mongodb+srv:// needs a DNS SRV lookup. Node's c-ares resolver fails with
// `querySrv ECONNREFUSED` when the OS DNS server is an IPv6 link-local address
// (common on Windows). Point the resolver at a reliable DNS server.
// Override with DNS_SERVERS="1.1.1.1,8.8.8.8", or DNS_SERVERS="off" to skip.
function applyDnsFix() {
  if (process.env.DNS_SERVERS === "off") return;
  const servers = (process.env.DNS_SERVERS || "8.8.8.8,1.1.1.1")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    dns.setServers(servers);
  } catch (e) {
    console.log("Could not set DNS servers:", e.message);
  }
}

// The driver expands a mongodb+srv URI into a multi-host mongodb:// URL and runs
// it through Node's legacy URL parser, which emits a DEP0170 deprecation warning
// that PRINTS THE FULL URI — credentials included — to stderr on every connect.
// Drop only that one warning so secrets never reach logs. Idempotent.
let leakGuarded = false;
function suppressUriDeprecationLeak() {
  if (leakGuarded) return;
  leakGuarded = true;
  const orig = process.emitWarning;
  process.emitWarning = function (warning, ...rest) {
    const opts = rest[0];
    const code = (opts && typeof opts === "object" && opts.code) || rest[1];
    const msg = typeof warning === "string" ? warning : warning && warning.message;
    if (code === "DEP0170" || (msg && /The URL mongodb/i.test(msg))) return;
    return orig.call(process, warning, ...rest);
  };
}

const DEFAULT_OPTS = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
};

// Connect the default mongoose connection (defaults to env DATABASE).
function connect(uri = process.env.DATABASE, opts = {}) {
  applyDnsFix();
  suppressUriDeprecationLeak();
  return mongoose.connect(uri, { ...DEFAULT_OPTS, ...opts });
}

// Open a separate (non-default) connection — for scripts targeting another db.
function createConnection(uri, opts = {}) {
  applyDnsFix();
  suppressUriDeprecationLeak();
  return mongoose.createConnection(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    ...opts,
  });
}

module.exports = {
  applyDnsFix,
  suppressUriDeprecationLeak,
  connect,
  createConnection,
};
