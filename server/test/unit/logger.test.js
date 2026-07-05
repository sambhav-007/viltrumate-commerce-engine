const { test } = require("node:test");
const assert = require("node:assert");
const { redact } = require("../../config/logger");

test("redact: strips mongodb URIs", () => {
  const out = redact("connecting to mongodb+srv://user:pass@cluster.mongodb.net/db");
  assert.doesNotMatch(out, /user:pass/);
  assert.match(out, /mongodb:\/\/\*\*\*/);
});

test("redact: strips known secret env values", () => {
  const prev = process.env.PANEL_KEY;
  process.env.PANEL_KEY = "supersecretpanelkey123";
  const out = redact("key was supersecretpanelkey123 in the request");
  assert.doesNotMatch(out, /supersecretpanelkey123/);
  assert.match(out, /\*\*\*/);
  if (prev === undefined) delete process.env.PANEL_KEY;
  else process.env.PANEL_KEY = prev;
});

test("redact: leaves ordinary text untouched", () => {
  assert.equal(redact("store zzz provisioned in 42ms"), "store zzz provisioned in 42ms");
});
