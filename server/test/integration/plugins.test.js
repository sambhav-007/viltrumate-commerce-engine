// Plugin lifecycle integration tests via the panel. DB-gated: skipped unless a
// cluster is configured. Isolated platform + store db; restores repo files.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const mongoose = require("mongoose");
const h = require("../helpers/db");

if (!h.hasCluster()) {
  test("plugin integration (skipped: no test cluster configured)", { skip: "set PROVISION_CLUSTER_URI to run" }, () => {});
  return;
}

const KEY = "itplg-key", PORT = 8291, STORE = "itplg", PID = "announcements";
const STORE_DB = h.names.store("plg");
let panel, base, api, repoSnap;

async function inStoreDb(fn) {
  const c = mongoose.createConnection(`${h.clusterRoot()}/${STORE_DB}${h.QS}`, { useNewUrlParser: true, useUnifiedTopology: true });
  await new Promise((res, rej) => { c.once("open", res); c.once("error", rej); });
  try { return await fn(c); } finally { await c.close(); }
}

before(async () => {
  repoSnap = h.snapshotRepo();
  const s = await h.spawnPanel({ port: PORT, key: KEY });
  panel = s.proc; base = s.base; api = h.apiClient(base, KEY);
  await api("/stores", { method: "POST", body: JSON.stringify({ id: STORE, storeName: "IT Plugins", industry: "jewelry", adminEmail: "it@plg.test", dbName: STORE_DB }) });
});

after(async () => {
  if (panel) panel.kill();
  await h.sleep(300);
  await h.dropDb(h.names.platform);
  await h.dropDb(STORE_DB);
  h.restoreRepo(repoSnap);
});

test("catalog: announcements discovered + valid", async () => {
  const { d } = await api("/plugins");
  const ann = d.plugins.find((p) => p.id === PID);
  assert.ok(ann && ann.valid);
  assert.ok((ann.settingsSchema || []).length > 0);
});

test("per-store state: available before install", async () => {
  const { d } = await api(`/stores/${STORE}/plugins`);
  const ann = d.plugins.find((p) => p.id === PID);
  assert.equal(ann.state.installed, false);
  assert.equal(ann.state.enabled, false);
});

test("install: runs migration, records state + activity", async () => {
  const r = await api(`/stores/${STORE}/plugins/${PID}/install`, { method: "POST" });
  assert.equal(r.status, 200, r.d.error);
  assert.ok(r.d.migrations.every((m) => m.result === "success"));
  const ann = (await api(`/stores/${STORE}/plugins`)).d.plugins.find((p) => p.id === PID);
  assert.equal(ann.state.installed, true);
  const acts = (await api(`/activity?storeId=${STORE}`)).d.activity.map((a) => a.action);
  assert.ok(acts.includes("Plugin installed"));
});

test("enable: state + store-db runtime mirror", async () => {
  const r = await api(`/stores/${STORE}/plugins/${PID}/enable`, { method: "POST" });
  assert.equal(r.status, 200, r.d.error);
  const ann = (await api(`/stores/${STORE}/plugins`)).d.plugins.find((p) => p.id === PID);
  assert.equal(ann.state.enabled, true);
  const runtime = await inStoreDb((c) => c.collection("pluginruntimes").findOne({ pluginId: PID }));
  assert.ok(runtime && runtime.enabled === true, "runtime mirror reflects enabled");
});

test("cannot enable a plugin that isn't installed", async () => {
  const r = await api(`/stores/${STORE}/plugins/does-not-exist/enable`, { method: "POST" });
  assert.equal(r.status, 404);
});

test("settings: update persists", async () => {
  const r = await api(`/stores/${STORE}/plugins/${PID}/settings`, { method: "PUT", body: JSON.stringify({ settings: { barColor: "#ff0000", dismissible: false } }) });
  assert.equal(r.status, 200, r.d.error);
  const ann = (await api(`/stores/${STORE}/plugins`)).d.plugins.find((p) => p.id === PID);
  assert.equal(ann.state.settings.barColor, "#ff0000");
});

test("diagnostics: plugin counts reflected", async () => {
  const { d } = await api("/diagnostics");
  assert.ok(d.diagnostics.plugins.discovered >= 1);
  assert.ok(d.diagnostics.plugins.installed >= 1);
  assert.ok(d.diagnostics.plugins.enabled >= 1);
});

test("disable: turns off", async () => {
  const r = await api(`/stores/${STORE}/plugins/${PID}/disable`, { method: "POST" });
  assert.equal(r.status, 200);
  const ann = (await api(`/stores/${STORE}/plugins`)).d.plugins.find((p) => p.id === PID);
  assert.equal(ann.state.enabled, false);
});

test("uninstall: warns on orphaned data, retains it under force", async () => {
  // seed a plugin record to create orphan data
  await inStoreDb((c) => c.collection("plugin_announcements_items").insertOne({ message: "Hi", active: true }));
  const blocked = await api(`/stores/${STORE}/plugins/${PID}/uninstall`, { method: "POST", body: JSON.stringify({}) });
  assert.equal(blocked.status, 409);
  assert.ok(blocked.d.orphaned >= 1);

  const forced = await api(`/stores/${STORE}/plugins/${PID}/uninstall`, { method: "POST", body: JSON.stringify({ force: true }) });
  assert.equal(forced.status, 200);
  // data is NOT deleted
  const still = await inStoreDb((c) => c.collection("plugin_announcements_items").countDocuments());
  assert.equal(still, 1, "plugin data retained after uninstall");
  const ann = (await api(`/stores/${STORE}/plugins`)).d.plugins.find((p) => p.id === PID);
  assert.equal(ann.state.installed, false);
});

test("activity: full lifecycle logged", async () => {
  const acts = new Set((await api(`/activity?storeId=${STORE}&limit=50`)).d.activity.map((a) => a.action));
  for (const a of ["Plugin installed", "Plugin enabled", "Plugin settings updated", "Plugin disabled", "Plugin uninstalled"]) {
    assert.ok(acts.has(a), `${a} logged`);
  }
});
