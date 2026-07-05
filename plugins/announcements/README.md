# Announcements — VCE reference plugin

A dismissible storefront announcement bar with admin CRUD. Small on purpose: it
exists to demonstrate every surface of the VCE Plugin SDK.

## What it shows

| SDK surface | Used for |
| --- | --- |
| `sdk.storage("items")` | announcement documents in `plugin_announcements_items` (its own collection) |
| `sdk.registerRoute()` | public `GET active` + admin CRUD under `/api/plugins/announcements/…` |
| `sdk.registerMigration()` + `migrations/1.0.0-init.js` | index on the active flag |
| `sdk.registerFeatureFlag()` | `announcementBar` |
| `sdk.registerSettingsSchema()` | bar color / text color / dismissible |
| `sdk.registerAdminPage / SidebarItem / DashboardWidget` | panel-surfaced UI hooks |
| `sdk.log` | secret-redacting, plugin-scoped logging |

## Structure

```
announcements/
  manifest.json        declaration (id/name/version/routes/settings/…)
  server/index.js      register(sdk) — routes + migration + declarations
  migrations/1.0.0-init.js
  client/AnnouncementBar.jsx   example storefront component (reference)
  README.md
```

## Endpoints (mounted when enabled for a store)

- `GET /api/plugins/announcements/active` — public; the storefront bar reads this.
- `GET|POST /api/plugins/announcements/items`, `PUT|DELETE …/items/:id` — admin CRUD.

## Lifecycle

Manage per store from **Panel → store → Plugins**: install (runs the migration),
enable, configure settings, disable, uninstall. Uninstall never deletes the
plugin's data automatically — it warns if data would be orphaned.

See [`docs/PLUGINS.md`](../../docs/PLUGINS.md) for the full SDK reference.
