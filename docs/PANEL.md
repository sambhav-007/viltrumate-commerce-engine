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
  **Content** (identity/hero), **Features** (flags + trust stats), **Deployment** (current
  version, generate/download package, deployment history — see below), **Updates** (VCE version,
  Update Wizard, migration history — see below), **Security** (agency locks). One "Save all
  changes" persists the settings tabs.

## Deployment Engine (Phase Κ)

The **Deployment** tab moves a store from "created" to "live" with minimal manual work by
**generating a complete deployment package**. Deployment logic lives entirely in the platform
layer (`server/platform/deploy/`) behind a `DeploymentProvider` interface — the commerce
engine and panel never contain deployment logic.

- **Providers:** `DeploymentProvider` defines `deploy()/update()/destroy()/status()/logs()`.
  New targets (Vercel/Render/Docker/…) register in `deploy/registry.js` and appear in the
  panel automatically. The initial **Local/Manual** provider generates a package (no cloud push).
- **Package** (written to the gitignored `server/deployments/<storeId>/<version>/`, downloadable
  as a zip): `frontend.env`, `backend.env`, `deployment.json`, `healthcheck.json`, `README.md`,
  `nginx.conf.example`, `start.sh`, `SECRETS.md`.
- **Environment generator** assembles env files straight from their authoritative sources —
  platform Store (db name, domain), the store manifest (api/client URLs, cloudinary folder,
  currency/locale) and live StoreSettings (payment/features/identity), plus operator secrets
  from the environment. Order: Identity → Database → Theme → Payments → Secrets → Generate.
  Secrets appear **only** in `backend.env`, never in `deployment.json`/`healthcheck.json`/frontend.
- **Secrets validation** runs before generation (`GET …/deploy/validate`): database, cloudinary,
  payment keys (when razorpay is enabled), panel/platform config, and feature compatibility.
  Blocking gaps **refuse generation** (HTTP 422) and are shown per-check in the UI.
- **Versioning:** each generated package gets a semver (first is `1.0.0`; patch/minor/major
  bump), stored on the platform Store (`currentVersion`) and the Deployment record.
- **Healthcheck manifest** (`healthcheck.json`) captures api/frontend/database/payments/cloudinary
  for later deployment verification.
- **Timeline:** every generation and status transition writes an activity event — *Deployment
  package generated → started → completed / failed / rolled back*.
- **Rollback:** not implemented, but every Deployment record carries enough non-secret metadata
  (`version`, `gitCommit`, `databaseName`, `packagePath`, `rollback{}`) to support it later.

Deployment records (platform `deployments` collection): `provider`, `version`, `gitCommit`,
`environment`, `status`, `packagePath`, `healthcheck`, `secretsChecklist`, `rollback`,
`createdAt`, `deployedAt`, `deployedBy`, `notes`.

## Update Manager (Phase Λ)

Every client store is updatable from the panel. The **VCE platform version** is defined by the
migration set in `server/platform/migrations/` — the highest migration version is the current
VCE version (`CURRENT_VCE_VERSION`). Each store records which VCE version it runs.

- **Migration framework:** one file per migration, `<version>-<slug>.js`, exporting
  `{ version, description, run(ctx), verification(ctx), rollback(ctx) }`. `ctx` gives access to the
  target store's `StoreSettings` (run against its own DB via `withStoreDb`). Migrations are
  idempotent backfills. **Never edit a shipped migration — always add a new one.** `rollback()`
  is a placeholder; rollback is intentionally not implemented.
- **Store version fields:** `currentVersion` (the VCE version, set to the platform version at
  provision), `previousVersion`, `lastUpdated`, `pendingMigrations`, `lastUpdateStatus`,
  `versionHistory[]`. Deployment package build versions live on Deployment records; each
  deployment also records `vceVersion`.
- **Update state** (dashboard + store list badge): `up-to-date` / `migration-required` /
  `update-failed` / `unknown`.
- **Update Wizard** (Updates tab), 6 explicit steps — **never one-click**:
  1. Validate (check version + pending migrations + compatibility)
  2. Backup reminder (`node scripts/backupDb.js`)
  3. Preview changes (the pending migrations)
  4. Run migrations (`POST …/update` with `confirm:true`)
  5. Verify (each migration's `verification()`)
  6. Complete
- **Compatibility checks** run before anything migrates: feature flags, theme, payment,
  database schema, required env vars. A failed check **aborts safely** (HTTP 422, nothing runs).
- **Migration log** (`migrationlogs` collection): `{ operator, storeId, migration, description,
  fromVersion, toVersion, duration, result, error }`, plus activity events. On a mid-run failure
  the update stops and advances `currentVersion` only to the last successful migration.
- **Dashboard widgets:** latest VCE version, stores needing update, migration history, failed updates.

Endpoints: `GET /api/platform` (version + migration catalog), `GET …/update/check`,
`POST …/update`, `GET …/migrations`.

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
