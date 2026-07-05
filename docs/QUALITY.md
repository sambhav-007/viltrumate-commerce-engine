# VCE — Quality, Testing & Diagnostics

How VCE stays reliable: the test suite, the diagnostics/health surfaces, the logging
standard, and the release workflow. (Phase Ν — Quality Assurance & Release Candidate.)

## Testing strategy

VCE uses **Node's built-in test runner** (`node:test` + `node:assert`) — zero extra
dependencies, matching the repo's dependency-free ethos. Tests live under `server/test/`:

```
server/test/
  unit/          pure logic, no I/O — always run, never need a DB
  integration/   DB-backed (platform + commerce models) — auto-skip without a cluster
  helpers/db.js  isolated-DB derivation, panel spawn, repo snapshot/restore
```

Run:

```bash
cd server
npm test              # everything (integration auto-skips if no cluster is configured)
npm run test:unit     # pure unit tests only
npm run test:integration
```

### Isolation & no production data

- **Unit tests** are pure (version/migration/deploy-validation/package-builder/zip/
  compatibility/template-validation/Razorpay-HMAC/coupons/features/logger-redaction/slug).
  They never touch a network or database.
- **Integration tests** are **DB-gated**: they run only when `PROVISION_CLUSTER_URI` is set
  (or a `DATABASE` to derive the cluster from); otherwise they **skip** so `npm test` stays
  green in any environment. When they do run they create **throwaway databases**
  (`vce_platform_itest_*`, `vce-itest-*`), exercise the real panel over HTTP / the real
  models, and **drop every database + restore mutated repo files** (`fleet.json`, generated
  manifests, deployment packages) in teardown. They never read or write production data.

### Coverage map

| Area | Where |
| --- | --- |
| Provisioning, fleet fallback, activity logging, auth/validation, health/ready, diagnostics | `integration/panel.test.js` |
| Deployment package generation, update manager, migrations, templates (create/import/export/preview), cloning | `integration/panel.test.js` + `unit/*` |
| Products, categories, variants, inventory movements, coupons, orders, StoreSettings | `integration/commerce.test.js` |
| Razorpay signature/webhook verification (mocked, no network) | `unit/razorpay.test.js` |

## Diagnostics

The panel exposes read-only diagnostics (**Panel → Diagnostics**, or `GET /api/diagnostics`):
application/VCE version, platform DB status, store-cluster reachability + store count,
Cloudinary configuration, payment-provider configuration, deployment providers, and migration
status (current version + stores needing update). Use it as the first stop when a store or the
fleet misbehaves.

## Health endpoints

Unauthenticated, structured JSON, suitable for monitoring/uptime checks:

- `GET /health` — liveness: `{ status:"ok", service, version, uptime, ts }` (always 200 while up).
- `GET /ready` — readiness: `200` when the platform DB is reachable, `503` otherwise.

The commerce API server (`app.js`) additionally serves `GET /api/health`.

## Logging standard

`server/config/logger.js` emits one JSON object per line: `{ ts, level, component, requestId?,
message, stack? }`. Rules:

- **Secrets are redacted** before writing — known secret env values and any `mongodb[+srv]://`
  URI are replaced with `***`.
- **Stack traces only outside production** (`NODE_ENV !== "production"`).
- Every panel request gets an `x-request-id` (honored from the caller or generated) echoed on
  the response and attached to error logs for correlation.
- A final Express error middleware guarantees graceful JSON failure; `unhandledRejection` /
  `uncaughtException` are logged rather than crashing silently.

## Release workflow

1. `npm test` (with a test cluster configured so integration runs) → all green.
2. Review **[RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)**.
3. Confirm **Diagnostics** is all-green for the target environment.
4. Generate the deployment package (Panel → Deployment) and verify `healthcheck.json`.
5. Apply pending migrations via the Update Wizard (with a backup taken first).
6. Post-deploy: hit `/health` + `/ready`, and re-check Diagnostics.

See also: [PANEL.md](PANEL.md), [DEPLOYMENT.md](DEPLOYMENT.md).
