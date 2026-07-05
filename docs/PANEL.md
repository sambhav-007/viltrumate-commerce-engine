# VCE Panel — the agency control plane

One UI to **create client stores and manage every store's look, features and payments**
across all fleet databases — including taking those controls **away from the client's
admin** so they're managed exclusively by your agency.

## Start it

```bash
cd server
# agency source of truth — the vce_platform database (metadata only):
export PLATFORM_DATABASE="mongodb+srv://USER:PASS@cluster.mongodb.net/vce_platform?retryWrites=true&w=majority"
# cluster root (NO db name) — used only to reach each store's own database:
export PROVISION_CLUSTER_URI="mongodb+srv://USER:PASS@cluster.mongodb.net"
export PANEL_KEY="a-long-random-key"        # optional — generated + printed if unset
npm run panel                                # → http://localhost:8100
```

All three can equally live in `server/.env` (the panel reads it via dotenv).

Enter the panel key in the browser. The panel is a **local operator tool** — don't expose
it to the internet as-is (it holds cluster-wide write power).

## Platform database (`vce_platform`)

The panel's single source of truth is a dedicated **Platform Database** holding **agency
metadata only** — never merchant data. Four collections:

| Collection | What it holds |
| --- | --- |
| `stores` | one doc per store: `storeId`, `name`, `slug`, `industry`, **`databaseName`** (authoritative), `domain`, `status`, `currentVersion`, `lockedSections`, `notes`, timestamps |
| `operators` | agency users: `name`, `email`, hashed `password`, `role`, `permissions`, `active`, `lastLogin` (seed with `node scripts/createOperator.js <email> <pw> [name] [role]`) |
| `activitylogs` | audit trail — every panel action appends `{ timestamp, operator, storeId, action, metadata }` |
| `deployments` | deployment ledger — `{ storeId, gitCommit, version, deployedAt, deployedBy, environment, notes }` |

**Architecture rule:** products, orders, customers and all merchant data stay in each
store's OWN database. The platform database never receives any of it.

### Fleet fallback (backwards compatibility)

Store resolution is **platform-first, fleet-fallback**: if a store exists in the platform
`stores` collection, its `databaseName` is authoritative; otherwise the panel falls back to
the legacy `provisioning/fleet.json` + manifest. With `PLATFORM_DATABASE` unset the panel
runs entirely off the fleet registry, exactly as before. Creating a store registers it in
**both** the platform database and the fleet registry.

The `x-panel-operator` header (set from the "operator" box in the panel header) is recorded
as the actor on every audit event; it defaults to `panel`.

## What it does

| Area | Details |
| --- | --- |
| **Create store** | Name, id, industry preset, admin email → provisions the store's own database: StoreSettings (with the industry's theme/label/layout/flags), admin user (password shown once), starter categories. Manifest saved to `provisioning/stores/<id>.json`, registered in `fleet.json`. Env files + deployment stay a CLI step (docs/DEPLOYMENT.md). |
| **Identity** | Store name, variant label, WhatsApp, contact, hero copy |
| **Theme** | All 8 brand colors, design tokens (JSON), body/display fonts + Google families, motion |
| **Layout** | Homepage variant (editorial / catalog / minimal) |
| **Features** | reviews, wishlist, coupons, inventory, cod, whatsappCheckout |
| **Payment** | Enabled providers + default (Razorpay keys stay env-side per store) |
| **Trust stats** | The homepage count-up band |
| **Agency locks** | See below |

Changes save **directly into the target store's database** and are live on that
storefront immediately.

## Agency locks (`lockedSections`)

Tick a section under **Agency locks** and it becomes agency-managed:

- the section **disappears from the client's admin Settings** (replaced by a
  "Managed by your agency" notice), and
- the store's settings API **rejects writes** to it — the lock is enforced
  server-side, not just hidden.

Only the panel (direct DB access) can change locked sections or the locks themselves.
Lockable: `identity, theme, layout, payment, features, seo, stats, content`.

## Dashboard & store tabs

- **Dashboard** (landing view): total stores, active stores, stores-by-industry, recent
  activity, and latest deployments — all from the platform database.
- **Store detail** is organised into tabs: **Overview** (platform metadata + per-store
  activity), **Appearance** (theme/typography/tokens/motion/layout), **Commerce** (payment),
  **Content** (identity/hero), **Features** (flags + trust stats), **Operations** (record +
  view deployments), **Security** (agency locks). One "Save all changes" persists every tab.

## How it works

- Source of truth: the **platform database** (`stores` collection). Legacy registry
  `provisioning/fleet.json` (+ manifests in `provisioning/stores/`) is the fallback and is
  still updated on create — the same registry `scripts/fleet.js` uses for health/backup/reapply.
- Store DB access: one store at a time through the shared connect helper (serialized queue),
  using `PROVISION_CLUSTER_URI` + each store's authoritative db name. The platform connection
  is separate and persistent (the panel closes only the store connection between operations).
- Every panel action writes an `activitylogs` event; deployments write a `deployments` record.
- Provisioning is idempotent; a failed create can be re-run (`retry: true`, offered by
  the UI error path) — a failed provision leaves the store `status: "provisioning"`/`"error"`.
