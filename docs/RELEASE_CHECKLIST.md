# VCE — Release Checklist

Work top to bottom before shipping a store (or the platform) to production. See
[QUALITY.md](QUALITY.md) for the testing/diagnostics context.

## 1. Environment variables
- [ ] `server/.env` present and **not committed** (`.gitignore` covers it).
- [ ] Store: `DATABASE` (incl. db name), `JWT_SECRET` (long random), `CLOUDINARY_*`, `CORS_ORIGINS`.
- [ ] Payments (if online): `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (+ `RAZORPAY_WEBHOOK_SECRET`).
- [ ] Panel/platform: `PLATFORM_DATABASE` (…/`vce_platform`), `PROVISION_CLUSTER_URI` (no db name), `PANEL_KEY`.
- [ ] `client/.env` holds **only** `REACT_APP_*` (no secrets).

## 2. Tests
- [ ] `cd server && npm test` passes (run with a test cluster so integration executes, not just skips).

## 3. Migrations / version
- [ ] Panel → store → **Updates**: store is **up-to-date** (or run the Update Wizard, backup first).
- [ ] `GET /api/platform` shows the expected VCE version; no stores stuck in `update-failed`.

## 4. Deployment package
- [ ] Panel → store → **Deployment**: generate the package; validation passes (no missing secrets).
- [ ] Review `SECRETS.md`; `backend.env` → `server/.env`, `frontend.env` → `client/.env`.
- [ ] Reuse the previous `JWT_SECRET` on a redeploy (keeps admin sessions valid).

## 5. Backups
- [ ] `node scripts/backupDb.js` taken for the target store before any migration/deploy.
- [ ] Platform database backed up (stores/operators/deployments/activity metadata).

## 6. Diagnostics (Panel → Diagnostics)
- [ ] Platform DB **connected**; store cluster **reachable**.
- [ ] Cloudinary configured; payment provider configured as intended.
- [ ] Deployment providers listed; migrations current.

## 7. Health checks (post-deploy)
- [ ] Panel `GET /health` → 200; `GET /ready` → 200.
- [ ] Store API `GET /api/health` → 200; storefront loads; admin login works.
- [ ] Verify the store against its generated `healthcheck.json` (api/frontend/db/payments/cloudinary).

## 8. Sign-off
- [ ] Admin user created (`node scripts/createAdmin.js …`) and password stored securely.
- [ ] Rollback plan noted (deployment record + prior package retained).
