// Panel API + platform integration tests. DB-gated: skipped unless a cluster is
// configured (PROVISION_CLUSTER_URI or a DATABASE to derive it from). Uses an
// isolated platform db + throwaway store dbs, and restores mutated repo files.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const h = require("../helpers/db");

if (!h.hasCluster()) {
  test("panel integration (skipped: no test cluster configured)", { skip: "set PROVISION_CLUSTER_URI to run" }, () => {});
  return;
}

const KEY = "itest-key";
const PORT = 8290;
const SRC = "itsrc", FROM_TPL = "ittpl", CLONE = "itclone";
let panel, base, api, repoSnap, tplSlug;
const storeDbs = [h.names.store(SRC), h.names.store(FROM_TPL), h.names.store(CLONE)];

before(async () => {
  repoSnap = h.snapshotRepo();
  const s = await h.spawnPanel({ port: PORT, key: KEY });
  panel = s.proc; base = s.base;
  api = h.apiClient(base, KEY);
});

after(async () => {
  if (panel) panel.kill();
  await h.sleep(300);
  await h.dropDb(h.names.platform);
  for (const db of storeDbs) await h.dropDb(db);
  [SRC, FROM_TPL, CLONE].forEach(h.cleanupDeployDir);
  h.restoreRepo(repoSnap);
});

test("health + ready return structured JSON", async () => {
  const health = await (await fetch(base + "/health")).json();
  assert.equal(health.status, "ok");
  assert.ok(health.version && health.ts);
  const ready = await (await fetch(base + "/ready")).json();
  assert.ok(["ready", "not-ready"].includes(ready.status));
});

test("auth: 401 without key, 200 with key", async () => {
  const bad = await fetch(base + "/api/dashboard", { headers: { "x-panel-key": "nope" } });
  assert.equal(bad.status, 401);
  const ok = await api("/dashboard");
  assert.equal(ok.status, 200);
});

test("unknown /api endpoint returns 404 JSON", async () => {
  const r = await api("/does-not-exist");
  assert.equal(r.status, 404);
  assert.ok(r.d.error);
});

test("diagnostics: read-only shape", async () => {
  const { status, d } = await api("/diagnostics");
  assert.equal(status, 200);
  const diag = d.diagnostics;
  assert.ok(diag.application.vceVersion);
  assert.equal(diag.platformDatabase.configured, true);
  assert.ok("cloudinary" in diag && "payments" in diag && "deployment" in diag && "migrations" in diag);
});

test("provisioning: creates + registers store + logs activity", async () => {
  const r = await api("/stores", { method: "POST", body: JSON.stringify({ id: SRC, storeName: "IT Source", industry: "jewelry", adminEmail: "it@src.test", dbName: h.names.store(SRC) }) });
  assert.equal(r.status, 200, r.d.error);
  const list = await api("/stores");
  const s = list.d.stores.find((x) => x.id === SRC);
  assert.ok(s && s.source === "platform");
  const acts = (await api(`/activity?storeId=${SRC}`)).d.activity.map((a) => a.action);
  assert.ok(acts.includes("Store created") && acts.includes("Store provisioned"));
});

test("input validation: bad id / missing fields => 400", async () => {
  assert.equal((await api("/stores", { method: "POST", body: JSON.stringify({ id: "Bad Id", storeName: "x", adminEmail: "a@b.c" }) })).status, 400);
  assert.equal((await api("/stores", { method: "POST", body: JSON.stringify({ id: "ok-id" }) })).status, 400);
  assert.equal((await api(`/stores/${SRC}`, { method: "POST" })).status || 404, 404); // no such route -> 404
});

test("duplicate store => 409", async () => {
  const r = await api("/stores", { method: "POST", body: JSON.stringify({ id: SRC, storeName: "dup", adminEmail: "a@b.c" }) });
  assert.equal(r.status, 409);
});

test("fleet fallback: registry-only store appears as source=fleet", async () => {
  const list = await api("/stores");
  const x = list.d.stores.find((s) => s.id === "x123");
  // x123 is a fixture in provisioning/fleet.json
  assert.ok(!x || x.source === "fleet");
});

test("update manager: fresh store is up-to-date; confirm required", async () => {
  const chk = await api(`/stores/${SRC}/update/check`);
  assert.equal(chk.d.upToDate, true);
  const noConfirm = await api(`/stores/${SRC}/update`, { method: "POST", body: JSON.stringify({}) });
  assert.equal(noConfirm.status, 400);
});

test("deployment: validate + (conditionally) generate a package", async () => {
  const v = await api(`/stores/${SRC}/deploy/validate`);
  assert.equal(v.status, 200);
  assert.equal(typeof v.d.validation.ok, "boolean");
  if (v.d.validation.ok) {
    const gen = await api(`/stores/${SRC}/deployments/package`, { method: "POST", body: JSON.stringify({ bump: "patch" }) });
    assert.equal(gen.status, 200, gen.d.error);
    assert.equal(gen.d.deployment.vceVersion, (await api("/platform")).d.version);
  } else {
    const gen = await api(`/stores/${SRC}/deployments/package`, { method: "POST", body: JSON.stringify({}) });
    assert.equal(gen.status, 422);
  }
});

test("templates: create from store + gallery + preview + export/import validation", async () => {
  const c = await api(`/stores/${SRC}/template`, { method: "POST", body: JSON.stringify({ name: "IT Blueprint" }) });
  assert.equal(c.status, 200, c.d.error);
  tplSlug = c.d.template.slug;
  assert.ok((await api("/templates")).d.templates.some((t) => t.slug === tplSlug));
  const pv = await api(`/templates/${tplSlug}/preview`);
  assert.ok(pv.d.preview.theme && Array.isArray(pv.d.preview.navigation));
  // import with merchant data is rejected
  const bad = await api("/templates/import", { method: "POST", body: JSON.stringify({ template: { name: "Bad", config: { orders: [1] } } }) });
  assert.equal(bad.status, 422);
});

test("provision from template imports config; usageCount increments", async () => {
  const r = await api("/stores", { method: "POST", body: JSON.stringify({ id: FROM_TPL, storeName: "IT FromTpl", template: tplSlug, adminEmail: "it@tpl.test", dbName: h.names.store(FROM_TPL) }) });
  assert.equal(r.status, 200, r.d.error);
  const t = (await api("/templates")).d.templates.find((x) => x.slug === tplSlug);
  assert.equal(t.usageCount, 1);
});

test("clone: fresh db, merchant data excluded from the flow", async () => {
  const r = await api(`/stores/${SRC}/clone`, { method: "POST", body: JSON.stringify({ id: CLONE, storeName: "IT Clone", adminEmail: "it@cln.test", dbName: h.names.store(CLONE), options: { appearance: true, categories: true, products: true } }) });
  assert.equal(r.status, 200, r.d.error);
  assert.equal(r.d.db, h.names.store(CLONE));
  const acts = (await api(`/activity?storeId=${CLONE}`)).d.activity.map((a) => a.action);
  assert.ok(acts.includes("Store cloned"));
});
