// Standardized structured logger (Phase Ν). Emits one JSON object per line:
//   { ts, level, component, requestId?, message, stack? }
// - stack is included only outside production (NODE_ENV !== "production").
// - secrets are redacted: known secret env VALUES and any mongodb URI are
//   replaced before anything is written, so credentials never reach the logs.
//
// Dependency-free (Node built-ins only), matching the repo's ethos.

const SECRET_ENV = [
  "DATABASE",
  "PROVISION_CLUSTER_URI",
  "PLATFORM_DATABASE",
  "CLOUDINARY_API_SECRET",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "JWT_SECRET",
  "PANEL_KEY",
];

const isDev = () => process.env.NODE_ENV !== "production";

// Replace secret env values + any mongodb connection string with a marker.
function redact(input) {
  let s = typeof input === "string" ? input : String(input == null ? "" : input);
  for (const k of SECRET_ENV) {
    const v = process.env[k];
    if (v && v.length >= 6) s = s.split(v).join("***");
  }
  s = s.replace(/mongodb(\+srv)?:\/\/[^\s"']+/gi, "mongodb://***");
  return s;
}

function emit(level, component, message, meta = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    component: component || "app",
    message: redact(message),
  };
  if (meta.requestId) entry.requestId = meta.requestId;
  if (meta.stack && isDev()) entry.stack = redact(meta.stack);
  const line = JSON.stringify(entry);
  (level === "error" ? console.error : console.log)(line);
  return entry;
}

const logInfo = (component, message, meta) => emit("info", component, message, meta);
const logWarn = (component, message, meta) => emit("warn", component, message, meta);
const logError = (component, err, meta = {}) =>
  emit("error", component, err && err.message ? err.message : String(err), {
    ...meta,
    stack: err && err.stack,
  });

module.exports = { logInfo, logWarn, logError, redact, SECRET_ENV };
