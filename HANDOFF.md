# VCE — Session Handoff

Context handout for picking up the **Viltrumate Commerce Engine (VCE)**. Read this before continuing.

---

## 1. What VCE is

A reusable, vertical-agnostic **MERN commerce engine** extracted from a single-brand cosmetics store (Aura Rare) and generalized so one codebase can power many client storefronts.

- **Architecture model:** _shared codebase + a separate database per store + one agency Platform Database._ Each store runs the same code pointed at its own DB, with its own `.env` and `StoreSettings`. A dedicated **`vce_platform`** database holds agency metadata only (stores, operators, deployments, activity log) and is the VCE Panel's source of truth. This is **not** row-level multi-tenancy — tenant routing is intentionally **not** built.
- **Stack:** React 16 (CRA) · Express · MongoDB + Mongoose 5 · Cloudinary · JWT admin auth.
- **Checkout:** WhatsApp + COD (record every order); Razorpay (online payment) wired; Stripe still a stub.

## 2. Repo / branch / remote

- Working repo: `D:\work\viltrumate-commerce-engine`
- Branch: **`vce-alpha`** (default branch on remote)
- Remote: **https://github.com/sambhav-007/viltrumate-commerce-engine** (PUBLIC)
- Source repo (separate): `D:\work\aura-rare-beauty` → github `sambhav-007/aura-rare-beauty`. **Order tracking + CSV import were back-ported to it** this session (commits `dc61bd1`, `4ef5b75`).

## 3. Phase history

**Pre-session (Alpha):** A config extraction · B Shade→Variant refactor · C payments registry + Order model · D store-config system (theme/payment/seo/features + admin Settings).

**This session (Beta):**
1. **Order Management** — admin Orders page (filters, details modal, status workflow `pending→confirmed→fulfilled`/`cancelled`), dashboard order metrics + pending alert, paginated `GET /api/orders`. Commits `01a45ab`,`d6b2558`,`cc9a383`.
2. **Provisioning / Onboarding** — store **manifest** + `provision.js` orchestrator, `generateEnv`, `applyStoreSettings`, data-driven catalog presets (`empty` default, `aura-rare` dev preset), shared DNS+connect helper, secret-hygiene foundation. `docs/PROVISIONING.md`. Commits `945b0cc`,`4a76c2f`,`ffd430d`,`e2b6a03`.
3. **Storefront Neutralization (3A)** — content-slot registry (`client/src/config/content.js`) + `StoreSettings.content`, generic defaults, `variantLabel` leak fixes, Aura's exact copy relocated to seed data so the demo store is textually identical. Commits `92b0ffa`,`b7d92c9`,`fe1c3a8`,`628d1b0`,`9432e6f`. **3B (design-token expansion) is PLANNED, not implemented.**
4. **CSV Product Import** — dependency-free parser, preview (dry-run) + import, category auto-create, image-URL via Cloudinary, partial success, admin modal. Commits `432953f`,`3d680eb`.
5. **Razorpay** — backend (order create via `https`, HMAC signature/webhook verify via `crypto`, idempotent confirm), frontend provider + a Checkout method-sync bug fix. Commits `cb5abbc`,`9363da6`.
- **Mobile-responsive admin tables** (`.admin-table` card-stacking). Commit `d42b473`.

**This session (Gamma→Theta roadmap):**
1. **Γ payments hardening** — Razorpay provisioning from manifest (`commerce.payment.razorpay.keyId` + `PROVISION_RAZORPAY_KEY_SECRET`/`_WEBHOOK_SECRET`, fail-fast when enabled without keys); DNS-helper sweep confirmed clean. Commit `d75f0c4`.
2. **Δ 3B design tokens** — `aura.css` fully tokenized (typography/tracking/radius/density/motion + `--*-rgb` triplets for translucent tints); `StoreSettings.theme.tokens/fonts/motion`; ThemeApplier rework (fixes stale-CSS-var-on-clear bug, derives rgb from hex); FontLoader (runtime Google Fonts); useMotion (store "reduced" + OS `prefers-reduced-motion`); admin Typography & Motion section; `docs/THEMING.md`. Commit `e8a1ad1`.
3. **Ε presets & layouts** — 5 industry presets (`server/provisioning/industries/`) selected via `store.industry`, merge-under (explicit manifest wins), starter categories; `StoreSettings.layout.home` = editorial|catalog|minimal with Home.js refactored into composable sections (editorial unchanged); admin layout picker. Commit `5bb6ff4`.
4. **Ζ merchant ops** — inventory (variant `stock`, atomic confirm/cancel movements via `config/inventory.js`, PDP OOS, admin stock column, dashboard low-stock); coupons (model+CRUD+checkout apply, atomic consume on order create, validate rate-limited); server-side order re-pricing (client money never trusted); wishlist (device-local); analytics endpoint + dashboard bars; `NOTIFY_WEBHOOK_URL` order webhooks. Commit `56b1e6e`.
5. **Η fleet ops** — `backupDb.js`/`restoreDb.js` (EJSON .jsonl, explicit-target restore), `fleet.js` (list/health/backup/reapply) over gitignored `fleet.json` registry, `docs/DEPLOYMENT.md`. Commit `dc3d7a4`.
6. **Θ growth** — `/sitemap.xml` (server-generated), `usePageSeo` + Product/Offer JSON-LD on PDP, resume-cart bar. Commit `0c3a224`.
7. **Aura back-port wave** (from `aura-rare-beauty` commits `03c282a`/`6e3c1a5`/`158d610`+/`75eed12`/`5c4ec01`/`64fa8b3`, generalized for VCE): intro curtain preloader (content-slot tag line, skips admin/reduced-motion); trust-stats band — **admin-editable** via `StoreSettings.stats` (aura hardcodes them) + count-up on scroll, `stats` section in all three layouts; drag-to-reorder categories & variants (`useRowDnd`, `order` field, PATCH reorder endpoints, append-on-create); banner slideshow hero (contain, ¾-height band, dots) + clean single-image hero + solid navbar; desktop nav hover flyout previewing collections/products. Browser-verified against the running dev store.
8. **VCE Panel** — agency control plane (`server/panel.js` + `server/panel/ui.html`, `npm run panel` → :8100): create stores and manage every store's theme/typography/layout/payment/features/trust-stats/section-locks across all fleet databases, bypassing each client's admin. Gated on `PANEL_KEY`. Commit `5f4928e`. `docs/PANEL.md`.

**This session (Phase Ι — Platform Database Migration):**
- **Dedicated Platform Database (`vce_platform`)** — the agency's single source of truth, **metadata only** (never products/orders/customers). New `server/platform/` module: `schemas.js` (Store, Operator, ActivityLog, Deployment) + `index.js` (lazy dedicated mongoose connection, `logActivity`/`upsertStore` helpers). Store's `databaseName` is now authoritative.
- **Env split:** `PLATFORM_DATABASE` (…/`vce_platform`) for agency metadata; `PROVISION_CLUSTER_URI` (no db name) still only reaches individual store DBs. Documented in `server/.env.example`.
- **Fleet migration w/ fallback:** panel resolves a store **platform-first, fleet-fallback** (`resolveStore`). If in the platform `stores` collection → use it; else fall back to `provisioning/fleet.json` + manifest. With `PLATFORM_DATABASE` unset the panel behaves exactly as before. **JSON registry support retained** and still updated on create.
- **Store creation** now: (1) provisions the store DB as before, (2) registers the store in the platform DB (`status` provisioning→active, or error on failure), (3) still writes the fleet registry.
- **Audit + deployments:** every panel action appends an `activitylogs` event (Store created/provisioned, Theme updated, Typography changed, Feature enabled/disabled, Payment modified, Layout changed, Agency locks updated, Deployment completed, Operator created…), attributed to the `x-panel-operator`. New deployment endpoints + ledger.
- **UI:** agency **Dashboard** (totals, active, by-industry, recent activity, latest deployments) + **store detail tabs** (Overview / Appearance / Commerce / Content / Features / Operations / Security).
- **Operators:** `Operator` model + `scripts/createOperator.js` + panel CRUD (panel still gates on `PANEL_KEY`; operators are recorded metadata + audit actor, a forward hook for real operator auth).
- **Coexistence fix:** `withStoreDb` now closes only the default (store) connection (`mongoose.connection.close()`), not `mongoose.disconnect()`, so the persistent platform connection survives per-store cycles.
- **Verified:** 22/22 end-to-end checks against a live cluster on an isolated `vce_platform_verify` + throwaway store DB (auth gate, platform registration, provisioning, settings edit, activity logging incl. operator attribution, deployment record + list, dashboard aggregation, duplicate guard, operator create + password redaction, **fleet fallback** via the existing `x123` registry entry). Test DBs dropped, fleet.json restored. Browser DOM pass of the new dashboard/tabs still recommended.

**This session (Phase Κ — Deployment Engine):**
- **Provider abstraction** (`server/platform/deploy/`) — `DeploymentProvider` base (`deploy/update/destroy/status/logs`) + `registry.js`. Deployment logic lives **only** in the platform layer; commerce/panel contain none. New targets (Vercel/Render/Docker) plug in via the registry.
- **Local/Manual provider** (`localProvider.js`) — generates a self-contained deployment **package** on disk (no cloud push): `frontend.env`, `backend.env`, `deployment.json`, `healthcheck.json`, `README.md`, `nginx.conf.example`, `start.sh`, `SECRETS.md`. Written to gitignored `server/deployments/<storeId>/<version>/`.
- **Environment generator** (`packageBuilder.js`) — assembles env from authoritative sources (platform Store db name/domain, manifest infra, live StoreSettings) + operator secrets; order Identity→Database→Theme→Payments→Secrets→Generate. Secrets land **only** in `backend.env` (verified absent from the other files).
- **Secrets validation** (`validateSecrets.js`) — pre-flight checks db/cloudinary/payment-keys/panel/feature-compat; blocking gaps **refuse generation** (HTTP 422) with a per-check report. Warnings (e.g. stripe stub, whatsapp number) are non-blocking.
- **Versioning** (`version.js`) — semver per generation (first `1.0.0`; patch/minor/major); stored on the platform Store `currentVersion` and each Deployment record.
- **Healthcheck manifest** — `healthcheck.json` (api/frontend/database/payments/cloudinary) for later deploy verification; also stored on the record.
- **Deployment model expanded** — `provider`, `status` (generated→started→completed/failed/rolled_back), `packagePath`, `healthcheck`, `secretsChecklist`, `rollback` (non-secret metadata for future rollback), `deployedAt` (set on completed). **Rollback itself is intentionally NOT implemented** — records just carry enough to enable it later.
- **Timeline** — every generation + status transition writes an activity event (package generated / started / completed / failed / rolled back).
- **Download** — package zips via a dependency-free STORE-method zip writer (`zip.js`); the panel fetches with the key header and triggers a blob download.
- **Panel UI** — the **Deployment** tab (replaces Operations): current version, provider/bump/env picker, Validate + Generate, per-version download links, status-advance buttons, history table. New endpoints: `GET /api/deploy/providers`, `GET …/deploy/validate`, `POST …/deployments/package`, `GET …/deployments/:depId/package`, `POST …/deployments/:depId/status` (legacy `POST …/deployments` kept as a manual record, provider `manual`).
- **Verified:** 25/25 end-to-end on an isolated platform + throwaway store DB (provider registry, provisioning, validation ok-path, package generation + 8 files on disk, record fields incl. healthcheck/rollback, **valid zip download**, status timeline started→completed w/ deployedAt, activity timeline, minor-bump versioning + platform `currentVersion` persistence, **invalid deployment refused 422 with no package written**, history). Module unit tests (version/validation/builder/zip) passed; zip validated via PowerShell Expand-Archive; no secrets in non-env files. Test DBs dropped, package dir + manifest removed, fleet.json restored. Browser DOM pass still recommended.

**This session (Phase Λ — Store Versioning & Update Manager):**
- **VCE platform version** — defined by the migration set: the highest migration version IS `CURRENT_VCE_VERSION` (currently **1.2.0**). Every store tracks which VCE version it runs; every deployment records the VCE version (`Deployment.vceVersion`).
- **Migration framework** (`server/platform/migrations/`) — one file per migration `<version>-<slug>.js` exporting `{ version, description, run(ctx), verification(ctx), rollback(ctx) }`; `index.js` loader (`list/latestVersion/pendingFor/cmp/CURRENT_VCE_VERSION`). Shipped: `1.0.1-add-theme-token`, `1.1.0-add-inventory`, `1.2.0-add-coupons` (idempotent backfills; no-ops on current stores). **Rule: never edit a shipped migration; always add a new one.** `rollback()` is a placeholder (rollback intentionally NOT implemented).
- **Store version tracking** — Store schema gains `currentVersion` (now the **VCE version**, set to `CURRENT_VCE_VERSION` at provision), `previousVersion`, `lastUpdated`, `pendingMigrations`, `lastUpdateStatus`, `versionHistory[]`. (Deployment **package** build versions live on Deployment records; package generation no longer writes `Store.currentVersion` — it stamps `Deployment.vceVersion` instead.)
- **Update Checker** — per-store `updateState`: `up-to-date` / `migration-required` / `update-failed` / `unknown`, surfaced in the store list + dashboard.
- **Update Wizard** (Updates tab) — 6 explicit steps (Validate → Backup reminder → Preview → Run → Verify → Complete), **never one-click**; `POST …/update` requires `confirm:true`.
- **Compatibility checks** (`migrations/compatibility.js`) — feature flags / theme / payment / database schema / required env; a failed check **aborts safely** (HTTP 422, nothing runs).
- **Migration log** — new platform `migrationlogs` collection: `{ operator, storeId, migration, description, fromVersion, toVersion, duration, result, error }`; each migration also emits an activity event (Migration completed/failed, Store updated/failed/aborted). On a mid-run failure the update stops and advances `currentVersion` only to the last successful migration (no rollback).
- **Dashboard widgets** — latest VCE version, stores-needing-update (count + list), migration history, failed updates.
- **Version history** (Updates tab) — installed/previous version, pending migrations, previous-versions list, and the store's migration history table.
- **Rollback** — still NOT implemented by design; records carry enough metadata to add it later.
- **Endpoints:** `GET /api/platform`, `GET …/update/check`, `POST …/update`, `GET …/migrations`; dashboard extended.
- **Verified:** 30/30 end-to-end on an isolated platform + throwaway store DB (platform version + 3-migration catalog, fresh store starts at 1.2.0 up-to-date, deployment stamps vceVersion, simulated old store → update detection + dashboard/list state, **confirm required (400)**, migration run 1.0.0→1.2.0 with 3 successes + durations, post-update up-to-date, previousVersion/versionHistory/lastUpdated, 3 migration-log entries w/ operator+from/to, dashboard migration history, **compatibility abort 422 with no migrations run and version unchanged**). Migration-loader unit tests passed. Test DBs dropped, package dir + manifest removed, fleet.json restored. Browser DOM pass still recommended.

**This session (Phase Μ — Store Templates & Cloning):**
- **Template model** (platform `templates` collection) — reusable blueprint: `name/slug/description/industry/thumbnail/tags/createdBy/version/visibility/sourceStoreId/usageCount/config/versionHistory[]`. **Config only — never merchant data.**
- **Extract/apply/validate/preview** (`server/platform/templates.js`) — `buildTemplateConfig(include)` snapshots a store's reusable config (theme/layout/content/stats/features/payment-without-secrets/seo/categories/navigation/productAttributes); `applyTemplateConfig` imports it into a fresh store; `validateImport` rejects structural problems **and merchant-data leakage** (orders/customers/users/reviews/analytics/activity/passwords/products); `previewOf` returns a renderable, secret-free preview.
- **Cloning** (`server/platform/clone.js`) — `snapshotStore(options)` reads selected parts of a source store (appearance/settings/content/categories/products/pages/navigation); `writeClone` writes them into a **fresh database** (variant `stock` reset to untracked). **Never clones** orders/customers(users)/reviews/coupons/analytics/activity/admin passwords; every clone gets its own DB + fresh admin.
- **Create Template from store** — `POST /api/stores/:id/template` (choose what to include).
- **Provision from template** — `POST /api/stores` now supports **Blank / Industry preset / Template** (`body.template`); template mode imports the blueprint config + categories, bumps template `usageCount`, logs "Template used".
- **Clone store** — `POST /api/stores/:id/clone` (options per part).
- **Template gallery + versioning + import/export + preview** — `GET /api/templates` (gallery: thumbnail/industry/version/last-updated/usage), `GET/PUT/DELETE /api/templates/:tid` (edit **bumps version + appends versionHistory**; stores are NOT auto-updated), `GET …/export` (JSON download), `POST /api/templates/import` (**validated**), `GET …/preview`.
- **Activity logging** — Template created/edited/deleted/used/exported/imported + Store cloned all audited.
- **Panel UI** — Templates gallery (sidebar), per-template preview/export/delete/"new store", Import JSON; store Overview **Actions** (Create template / Clone store); create-store **Start from** selector (Blank / Industry / Template).
- **Verified:** 39/39 end-to-end on an isolated platform + throwaway store DBs (template saved + v1.0.0 + sourceStoreId, config has categories/theme and **no merchant data**, provision-from-template imports categories/settings + fresh admin + no products/orders + usageCount++, **clone copies products/variants/categories with stock reset but excludes orders/reviews and the customer user**, versioning 1.0.0→1.0.1 + history, export JSON has no secrets, import creates a unique slug, **import with merchant data rejected 422**, preview returns theme/nav/features, all six template activity actions logged). Module unit tests (validate/preview) passed. All test DBs dropped, manifests removed, fleet.json restored. Browser DOM pass still recommended.

**This session (Phase Ν — Quality Assurance, Testing & Release Candidate):**
- **Test framework** — Node's built-in runner (`node:test`, zero new deps). `server/test/` = `unit/` (pure, always run), `integration/` (DB-gated, auto-skip without `PROVISION_CLUSTER_URI`), `helpers/db.js` (isolated-DB derivation, panel spawn, repo snapshot/restore). Scripts: `npm test` / `test:unit` / `test:integration`. **57 tests pass** (38 unit + 6 commerce + 13 panel API); without a cluster the integration files skip so the suite stays green anywhere.
- **Coverage** — platform: provisioning, deployment package gen, update manager/migrations, template create/import/export/preview, cloning, fleet fallback, activity logging, auth/validation, health/ready, diagnostics; commerce: products/categories/variants, inventory movements (feature-gated), coupons (`discountFor`), orders, StoreSettings; Razorpay signature/webhook verification (mocked, no network); logger redaction.
- **Health endpoints (panel)** — `GET /health` (liveness) + `GET /ready` (readiness: platform-DB reachable → 200, else 503), unauthenticated structured JSON. (`app.js` already has `GET /api/health`.)
- **Diagnostics** — `GET /api/diagnostics` + **Panel → Diagnostics** (read-only): app/VCE version, platform DB status, store-cluster reachability + store count, Cloudinary config, payment-provider config, deployment providers, migration status.
- **Logging** — `server/config/logger.js`: one JSON line `{ ts, level, component, requestId?, message, stack? }`; **secret-redacted** (secret env values + mongodb URIs → `***`); **stack only outside production**. Panel now assigns an `x-request-id` per request, has a **404 JSON handler** + **final error middleware** (graceful failure), and `unhandledRejection`/`uncaughtException` handlers.
- **Docs** — new `docs/QUALITY.md` (testing strategy / diagnostics / release workflow) + `docs/RELEASE_CHECKLIST.md`; PANEL/DEPLOYMENT updated.
- **Verified:** full suite green against an isolated cluster (57/57); integration files skip cleanly with no cluster (2 skipped, 0 fail); all throwaway DBs dropped, `fleet.json` + manifests + deployment packages restored/removed (working tree clean). No new features or architecture changes.

**This session (Phase Ξ — Plugin & Extension SDK):**
- **Plugin host** (`server/pluginHost/`) — `validate.js` (manifest validation), `sdk.js` (the restricted SDK), `registry.js`, `loader.js` (discover/load with per-plugin failure isolation), `runtime.js` (store-db enablement mirror). Plugins run **inside the existing app** (not microservices).
- **Plugin packages** at repo root `/plugins/<id>/` = `manifest.json` + `server/index.js` (`register(sdk)`) + `migrations/` + `client/` + `README.md`.
- **SDK surface** — `registerRoute` (mounts **only** under `/api/plugins/<id>/…`; duplicates + path escapes rejected — no core/cross-plugin override), `storage(name)` (mongoose model on a plugin-namespaced `plugin_<id>_<name>` collection — the only data interface; no core mutation), `registerMigration/FeatureFlag/SettingsSchema/AdminPage/SidebarItem/DashboardWidget/NavigationItem`, `getSettings`, `log` (secret-redacting). No raw mongoose / core models / core app exposed.
- **Loader** — discover + validate manifests; load only enabled+valid plugins; a throwing/invalid plugin is reported and skipped (never crashes). `app.js` loads this store's enabled plugins at boot from the store-db `pluginruntimes` mirror.
- **Store-level enablement** — platform `PluginState` collection (`{ storeId, pluginId, installed, enabled, settings, version }`) is authoritative; panel mirrors runtime into each store db. Lifecycle: **install** (runs plugin migrations against the store db + MigrationLog), **enable/disable**, **settings**, **uninstall** (validates orphaned data → 409 unless `force`; **never auto-deletes plugin data**). All lifecycle actions audited (`Plugin installed/enabled/disabled/uninstalled`, `Plugin settings updated`).
- **Reference plugin** `plugins/announcements` — dismissible storefront bar + admin CRUD + migration + settings + example `client/AnnouncementBar.jsx`; exercises every SDK surface.
- **Panel** — per-store **Plugins** tab (install/enable/disable/uninstall + settings form); **Diagnostics** now shows installed/enabled plugins, versions, validity/health.
- **Endpoints** — `GET /api/plugins`, `GET/…/stores/:id/plugins`, `POST …/plugins/:pid/{install,enable,disable,uninstall}`, `PUT …/plugins/:pid/settings`; diagnostics extended.
- **Tests** — `unit/plugin-validate` + `unit/plugin-loader` (discovery, validation, failure isolation, route namespacing, storage scoping, disabled-ignored) + `integration/plugins` (full lifecycle via panel, DB-gated). Suite now **77/77** with a cluster; **48 pass / 3 skipped** without one.
- **Verified:** 77/77 against an isolated cluster (catalog, install+migration, enable + store-db runtime mirror, settings, diagnostics counts, disable, **uninstall orphan-guard 409 + force retains data**, full activity trail); throwaway plugin package discovered→loaded→removed cleanly; all test DBs dropped, repo files restored (tree clean). `docs/PLUGINS.md` added.

## 4. Capability matrix (current)

| Area | Status |
| --- | --- |
| Catalog (categories / products / variants incl. bulk) | ✅ verified |
| Order management (record / list / details / status / metrics) | ✅ verified |
| WhatsApp / COD checkout (records orders) | ✅ verified |
| Provisioning (manifest → one-command store) | ✅ verified on fresh DB |
| Storefront neutralization (generic copy + `variantLabel`) | ✅ verified |
| CSV product import | ✅ verified |
| Razorpay online payment | ⚠️ verified to gateway boundary — see §6 |
| Razorpay via provisioning (manifest keyId + operator secrets) | ✅ harness-verified |
| Reviews (feature-flagged) | ✅ |
| Design tokens 3B (colors+rgb / tokens / fonts / motion, ThemeApplier reset fix) | ✅ built + schema-verified; browser pass pending |
| Industry presets (beauty/jewelry/footwear/apparel/food) | ✅ harness-verified |
| Homepage layout variants (editorial / catalog / minimal) | ✅ built; editorial order unchanged |
| Inventory (flagged: stock, OOS, low-stock, confirm/cancel movements) | ✅ built + offline-verified; runtime pass pending |
| Coupons (flagged: admin CRUD, checkout apply, atomic consume) | ✅ built + offline-verified; runtime pass pending |
| Wishlist (flagged, device-local) | ✅ built |
| Analytics (daily revenue / top products / method split) | ✅ built |
| Order webhooks (NOTIFY_WEBHOOK_URL) | ✅ built + no-throw verified |
| Server-side order re-pricing (client totals untrusted) | ✅ built |
| Fleet ops (backup/restore EJSON, fleet CLI, deploy guide) | ✅ CLI smoke-tested |
| SEO (sitemap.xml, per-product meta + JSON-LD) | ✅ built |
| Resume-cart nudge | ✅ built |
| Responsive admin (mobile) | ✅ verified at 375px |
| VCE Panel (agency control plane) | ✅ built |
| Platform Database (`vce_platform`: stores/operators/deployments/activity) | ✅ 22/22 e2e-verified on isolated DB; browser DOM pass pending |
| Panel dashboard + store-detail tabs | ✅ built + API-verified; browser DOM pass pending |
| Fleet→platform resolution (platform-first, JSON fallback) | ✅ verified (incl. fallback) |
| Deployment Engine (provider abstraction + Local package generator) | ✅ 25/25 e2e-verified on isolated DB; browser DOM pass pending |
| Deployment package (env/manifest/healthcheck/nginx/startup/secrets + zip download) | ✅ verified (zip validated) |
| Secrets validation (blocks invalid deployments) + semver versioning | ✅ verified |
| Deployment rollback | 🔲 not implemented by design — records carry rollback metadata for later |
| Store versioning + Update Manager (migrations, wizard, compat checks, migration log) | ✅ 30/30 e2e-verified on isolated DB; browser DOM pass pending |
| VCE platform version (`CURRENT_VCE_VERSION` = latest migration, currently 1.2.0) | ✅ verified |
| Migration/update rollback | 🔲 not implemented by design — Store + MigrationLog carry metadata for later |
| Store Templates (create from store, gallery, versioning, import/export, preview) | ✅ 39/39 e2e-verified on isolated DB; browser DOM pass pending |
| Provision from template (Blank / Industry / Template) + clone store (fresh DB) | ✅ verified (merchant data excluded) |
| Automated test suite (node:test; 57 tests, DB-gated integration) | ✅ 57/57 pass; skips w/o cluster |
| Health endpoints (/health, /ready) + Diagnostics page + standardized logging | ✅ verified |
| Release checklist + QUALITY.md | ✅ documented |
| Plugin & Extension SDK (host, loader, restricted SDK, per-store lifecycle) | ✅ 77/77 e2e-verified; browser DOM pass pending |
| Reference plugin (announcements) + PLUGINS.md | ✅ verified |
| Tenant routing / Stripe / email-SMTP notifications | 🔲 not started (out of scope) |

## 5. How to run / provision

```bash
# install
cd server && npm install && cd ../client && npm install
# env (never commit .env)
cp server/.env.example server/.env   # DATABASE (incl. db name), Cloudinary, JWT_SECRET, optional RAZORPAY_*
cp client/.env.example client/.env   # REACT_APP_API_URL + REACT_APP_* fallbacks (NO secrets)
# admin
cd server && node scripts/createAdmin.js <email> <password(8+)> "Name"
# run
cd server && npm run start:dev          # API :8000
cd client && npm start                  # storefront+admin :3000  (admin: /admin/login)
```
Provision a new client store: fill `server/provisioning/client-manifest.example.json` → `node scripts/provision.js <manifest>` (generates both `.env` files, seeds `StoreSettings`, creates admin, loads catalog preset). See `docs/PROVISIONING.md`.

**VCE Panel (agency control plane):** set `PLATFORM_DATABASE` (…/`vce_platform`) + `PROVISION_CLUSTER_URI` (cluster root, no db name) + optional `PANEL_KEY` in `server/.env`, then `cd server && npm run panel` → http://localhost:8100. Seed agency users with `node scripts/createOperator.js <email> <pw> [name] [role]`. With `PLATFORM_DATABASE` unset the panel falls back to the fleet registry. See `docs/PANEL.md`.

**Windows DNS:** `mongodb+srv` SRV lookup can fail; the shared db helper points the resolver at public DNS by default (`DNS_SERVERS=...`, or `off`).

## 6. Open items / next steps

1. **Razorpay live test (still the highest-priority close-out; needs a human):** verified up to the hosted Checkout modal; a **successful test-card capture → `/verify` → order `confirmed`** has not been observed. To finish: set test keys in a store `.env` (or provision with the new manifest keys), enable `razorpay`, pay with card `4111 1111 1111 1111` (complete the OTP/Success step), confirm the order flips `confirmed` **and stock decrements when the inventory flag is on**. Also set `RAZORPAY_WEBHOOK_SECRET` to exercise the webhook backstop.
2. **Browser verification pass for the Γ→Θ feature wave** (per §7 pattern: isolated `vce_verify` DB + Claude Preview on alternate ports): 3B token/font/motion overrides incl. clear-reset, industry-provisioned store look, layout variants, inventory OOS + movements, coupon checkout flow, wishlist, analytics dashboard, sitemap.xml, PDP JSON-LD, resume-cart bar. Offline harnesses (38 checks) + 4 clean production builds passed this session; DOM behavior is what remains.
3. **Rotate the MongoDB + Cloudinary credentials** exposed in local logs pre-Beta (§8) — still recommended, still pending.
4. **Optional next wave:** SMTP email notifications (needs nodemailer or a provider API), CSV image-zip upload, Stripe when a non-INR client appears, prerendering for non-JS crawlers.

## 7. Guardrails / conventions

- **Commit messages: NO Claude/Anthropic attribution** (user preference; applies to both repos).
- **Small focused commits; runtime-verify each step before moving on.** Don't mark work complete on static inspection alone.
- **Verification pattern (used throughout):** spin an **isolated `vce_verify` database** via a temp boot wrapper that swaps `DATABASE` (never the prod Aura-Rare-Beauty DB), test via API/controllers and/or browser (Claude Preview MCP), then **drop the DB** and remove temp files.
- **Dev servers:** the user runs their own on **:8000 / :3000** — **ask before killing** anything on those ports; prefer alternate ports / isolated DBs.
- **Shade→Variant compatibility is locked:** the variant collection stays registered as `"shades"`; internal `shade*` identifiers (cart `shadeId`, `/api/shades` alias, refs) are intentionally retained. Vocabulary moved to "Variant" only at the UI/API surface.
- Scope discipline: don't start tenant routing, Stripe, or SMTP email unless asked. (Wishlist, coupons, inventory and 3B shipped in the Γ→Θ wave — they're now maintained features, all flag-gated off by default.)

## 8. Security notes

- `.env` files are gitignored and **never committed**; full history was scanned clean before the repo went public.
- ⚠️ During verification the **MongoDB password and Cloudinary secret were exposed in local terminal logs** (a Node `DEP0170` deprecation print + a deprecation warning). They are not in any repo or commit, but **rotating those credentials is recommended**. The shared db helper now suppresses the URI-leaking `DEP0170` warning going forward.
- `client/.env` should contain **only** `REACT_APP_*` vars; provisioning's `generateEnv` enforces this split (server secrets stay in `server/.env`).

## 9. Memory (persists across sessions)

- No Claude/Anthropic attribution in commits.
- The user runs dev servers on :8000/:3000 — ask before killing them.

---

_Last updated: end of Phase Ξ — Plugin & Extension SDK (plugin host + restricted SDK + loader with failure isolation; /plugins packages incl. reference `announcements`; per-store install/enable/disable/settings/uninstall with orphan-guard; plugins in Diagnostics; 77-test suite; PLUGINS.md). Follows Phase Ν — QA/Testing, Phase Μ — Templates & Cloning, Phase Λ — Update Manager, Phase Κ — Deployment Engine, Phase Ι — Platform Database Migration. Branch `vce-alpha`, local — push pending user go-ahead. Docs: PROVISIONING / THEMING / DEPLOYMENT / PANEL / QUALITY / RELEASE_CHECKLIST / PLUGINS._
