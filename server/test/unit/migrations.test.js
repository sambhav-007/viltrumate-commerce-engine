const { test } = require("node:test");
const assert = require("node:assert");
const mig = require("../../platform/migrations");

test("migration loader: ordered list with required shape", () => {
  const list = mig.list();
  assert.ok(list.length >= 3, "at least 3 migrations");
  for (const m of list) {
    assert.equal(typeof m.version, "string");
    assert.equal(typeof m.description, "string");
    assert.equal(typeof m.run, "function");
    assert.equal(typeof m.verification, "function");
    assert.equal(typeof m.rollback, "function");
  }
  // ascending order
  const versions = list.map((m) => m.version);
  const sorted = [...versions].sort(mig.cmp);
  assert.deepEqual(versions, sorted);
});

test("CURRENT_VCE_VERSION equals the newest migration", () => {
  assert.equal(mig.CURRENT_VCE_VERSION, mig.latestVersion());
});

test("pendingFor: strictly-greater semantics", () => {
  assert.equal(mig.pendingFor(mig.CURRENT_VCE_VERSION).length, 0);
  assert.ok(mig.pendingFor("0.0.0").length === mig.list().length);
  assert.ok(mig.pendingFor("").length === mig.list().length);
});

test("cmp: numeric (not lexical) comparison", () => {
  assert.ok(mig.cmp("1.2.0", "1.10.0") < 0);
  assert.ok(mig.cmp("2.0.0", "1.9.9") > 0);
  assert.equal(mig.cmp("1.1.1", "1.1.1"), 0);
});

test("rollback is a placeholder that throws", async () => {
  await assert.rejects(() => mig.list()[0].rollback({}), /not implemented/);
});
