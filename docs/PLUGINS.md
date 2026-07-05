# VCE — Plugin & Extension SDK

Extend VCE without modifying the core. Plugins run **inside the existing application**
(they are not microservices): the commerce server loads a store's enabled plugins at boot,
and the VCE Panel manages install/enable/disable/settings per store. (Phase Ξ.)

## Plugin structure

Plugins live at the repo root under `/plugins/<id>/`:

```
plugins/<id>/
  manifest.json      declaration (validated on discovery)
  server/index.js    exports register(sdk) — the plugin's entry point
  migrations/        optional <version>-<slug>.js files (run on install)
  client/            optional example components (reference — not auto-built)
  README.md
```

The reference plugin is [`plugins/announcements`](../plugins/announcements). Copy it to start.

## Manifest

```json
{
  "id": "announcements",           // lowercase slug (required, unique)
  "name": "Announcements",         // required
  "version": "1.0.0",              // semver (required)
  "description": "…",              // required
  "author": "VCE",                 // required
  "permissions": ["storefront", "admin"],
  "dependencies": [],
  "routes": [{ "method": "GET", "path": "active", "public": true }],
  "adminPages": [{ "id": "…", "title": "…", "path": "/admin/plugins/…" }],
  "sidebarItems": [{ "label": "…", "target": "…" }],
  "dashboardWidgets": [{ "id": "…", "title": "…" }],
  "navigationItems": [],
  "featureFlags": [{ "flag": "announcementBar", "default": true }],
  "settings": { "schema": [{ "key": "barColor", "type": "color", "default": "#111827", "label": "…" }] },
  "migrations": true
}
```

Manifests are **validated** on discovery (`server/pluginHost/validate.js`). Invalid manifests are
reported and the plugin is skipped — the platform never crashes. Route `path`s must be relative
subpaths (no leading `/`, no `..`).

## The SDK

`register(sdk)` receives a restricted SDK — the **only** surface a plugin may use. It never
exposes raw mongoose, core models, or the core app:

| API | Purpose |
| --- | --- |
| `sdk.registerRoute(method, subpath, ...handlers)` | Mount an Express handler **only** under `/api/plugins/<id>/<subpath>`. Duplicates and path escapes are rejected; a plugin can never override a core route. |
| `sdk.storage(name)` | A mongoose model bound to a plugin-namespaced collection `plugin_<id>_<name>`. The **only** approved data interface — plugins cannot touch core collections. |
| `sdk.registerMigration(m)` | Register a `{ version, description, run, verification, rollback }` migration (also auto-discovered from `migrations/`). Run on install against the store db. |
| `sdk.registerFeatureFlag(flag, default)` | Declare a feature flag. |
| `sdk.registerSettingsSchema(schema)` | Declare settings (surfaced in the panel). |
| `sdk.registerAdminPage / SidebarItem / DashboardWidget / NavigationItem` | Declare UI extension points. |
| `sdk.getSettings()` | The plugin's per-store settings (from stored state). |
| `sdk.log.{info,warn,error}` | Secret-redacting logger, scoped to the plugin. |

## Lifecycle

Managed per store from **Panel → store → Plugins** (state stored in the platform database):

- **install** — runs the plugin's migrations against the store db; records state; logs `Plugin installed`.
- **enable** — mounts the plugin's routes on the running store (mirrored to the store db so the
  commerce server picks it up); logs `Plugin enabled`.
- **disable** — stops loading it; logs `Plugin disabled`.
- **uninstall** — marks not-installed. **Validates whether data would be orphaned** and refuses
  (HTTP 409) unless `force:true`. It **never deletes plugin data automatically** — the plugin's
  collections are retained. Logs `Plugin uninstalled`.

Settings are edited in the same tab (`Plugin settings updated` is audited).

## Security

- Routes are namespaced under `/api/plugins/<id>/` — no core or cross-plugin override.
- Data goes only through `sdk.storage()` → plugin-owned collections; no direct core mutation.
- Manifests are validated; a bad or throwing plugin **fails safely** (reported, skipped) and
  never aborts the load or the platform.
- The SDK does not hand out the core app, raw mongoose, or core models.

## Diagnostics

**Panel → Diagnostics** (and `GET /api/diagnostics`) lists discovered plugins, validity/health,
versions, and fleet install/enable counts.

## Best practices

- Keep all data in `sdk.storage()` collections; never assume core schema.
- Make migrations idempotent; never delete user data in a migration/uninstall.
- Namespace feature flags/settings under your plugin id.
- Fail gracefully — return proper HTTP codes from your routes; use `sdk.log` (it redacts secrets).
- Treat `manifest.version` as the migration target; add new migrations, never edit shipped ones.

## Testing

`server/test/unit/plugin-validate.test.js` + `plugin-loader.test.js` (discovery, validation,
failure isolation, route namespacing, storage scoping) and `server/test/integration/plugins.test.js`
(full lifecycle via the panel, DB-gated). See [QUALITY.md](QUALITY.md).
