const { test } = require("node:test");
const assert = require("node:assert");
const loader = require("../../pluginHost/loader");
const { createSdk } = require("../../pluginHost/sdk");
const { createRegistry } = require("../../pluginHost/registry");

test("discover: finds the announcements reference plugin (valid)", () => {
  const found = loader.discover();
  const ann = found.find((d) => d.id === "announcements");
  assert.ok(ann, "announcements plugin discovered");
  assert.equal(ann.valid, true);
  assert.equal(ann.manifest.version, "1.0.0");
});

test("pluginMigrations: reads announcements migration files", () => {
  const ann = loader.discover().find((d) => d.id === "announcements");
  const migs = loader.pluginMigrations(ann);
  assert.equal(migs.length, 1);
  assert.equal(migs[0].version, "1.0.0");
  assert.equal(typeof migs[0].run, "function");
});

test("load: failure isolation — a throwing plugin never aborts the load", () => {
  const origErr = console.error;
  console.error = () => {}; // the loader logs the caught failure; silence it for clean output
  const { report, registry } = loader.load({
    mountRoutes: false,
    isEnabled: () => true,
    discovered: [
      { id: "boom", valid: true, manifest: { id: "boom", name: "B" }, module: { register() { throw new Error("kaboom"); } } },
      { id: "ok", valid: true, manifest: { id: "ok", name: "O" }, module: { register(sdk) { sdk.registerRoute("GET", "ping", () => {}); } } },
      { id: "bad", valid: false, errors: ["nope"] },
    ],
  });
  console.error = origErr;
  assert.deepEqual(report.loaded, ["ok"]);
  assert.equal(report.failed[0].id, "boom");
  assert.equal(report.invalid[0].id, "bad");
  assert.ok(registry.routes.some((r) => r.full === "/api/plugins/ok/ping"));
});

test("sdk: routes are namespaced; duplicates + path escapes rejected", () => {
  const reg = createRegistry();
  const sdk = createSdk({ id: "z" }, { registry: reg, mountRoutes: false });
  sdk.registerRoute("GET", "items", () => {});
  assert.equal(reg.routes[0].full, "/api/plugins/z/items");
  assert.throws(() => sdk.registerRoute("GET", "items", () => {}), /already registered/);
  assert.throws(() => sdk.registerRoute("GET", "../escape", () => {}), /Illegal/);
});

test("sdk: storage is scoped to a plugin-namespaced collection", () => {
  const sdk = createSdk({ id: "z" }, { registry: createRegistry(), mountRoutes: false });
  assert.equal(sdk.storage("items").collection.name, "plugin_z_items");
});

test("sdk: disabled plugins are ignored (not loaded)", () => {
  const { report } = loader.load({
    mountRoutes: false,
    isEnabled: () => false,
    discovered: [{ id: "ok", valid: true, manifest: { id: "ok", name: "O" }, module: { register() {} } }],
  });
  assert.deepEqual(report.loaded, []);
  assert.deepEqual(report.disabled, ["ok"]);
});
