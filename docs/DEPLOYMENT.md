# Deployment & Fleet Operations

One VCE codebase serves many stores; each store = its own database + its own `.env` pair
(see `docs/PROVISIONING.md`). This doc covers getting a provisioned store onto the
internet and operating N stores without losing sleep.

## Deploying one store

Any Node host + static host works. The reference recipe (free-tier friendly):

| Piece | Where | Notes |
| --- | --- | --- |
| API (`server/`) | Render / Railway / a VPS | start: `node app.js` (or `npm start`); set every var from the generated `server/.env` in the host's env settings — never commit the file |
| Storefront (`client/`) | Netlify / Vercel / same VPS | build: `npm run build`, publish `build/`; set the `REACT_APP_*` vars from the generated `client/.env` at build time |
| Database | MongoDB Atlas | one database per store on a shared cluster; allow the API host's IPs |
| Images | Cloudinary | per-store folder is already in the env |

Checklist per store:

1. `node scripts/provision.js <manifest>` locally (creates DB, settings, admin, env files).
2. Copy the env values into the API host + client build settings; set
   `CORS_ORIGINS` to the storefront's real URL and `REACT_APP_API_URL` to the API's real URL.
3. Deploy API → hit `https://api-host/api/health` → `{"status":"ok"}`.
4. Deploy client → storefront loads branded; sign in at `/admin/login`.
5. If Razorpay is enabled: set the dashboard webhook to
   `https://api-host/api/payments/razorpay/webhook` with the same `RAZORPAY_WEBHOOK_SECRET`.
6. Take a first backup (below).

## Fleet registry

Register every live store in `server/provisioning/fleet.json` (copy
`fleet.example.json`; keep the real one out of the public repo if manifests are private):

```json
[{ "name": "Acme Glow", "manifest": "../stores/acme-glow.json" }]
```

## Fleet commands

```bash
cd server
node scripts/fleet.js list       # what's registered
node scripts/fleet.js health     # ping every store's /api/health
node scripts/fleet.js backup     # backup every store's database
node scripts/fleet.js reapply    # re-apply every manifest's StoreSettings (idempotent)
```

`reapply` is the fleet-wide upgrade half: after pulling a new VCE version that adds
settings (new tokens, flags), run it once to converge every store. Code upgrades are the
other half: redeploy the API/client from the new commit — schemas are additive by
convention (see `_forwardCompatNotes`), so old documents keep working.

## Backup & restore

```bash
# one store, explicit db (uses PROVISION_CLUSTER_URI)
node scripts/backupDb.js --db vce-acme-glow
# restore (explicit target required — a stale .env can't hijack it)
node scripts/restoreDb.js ../backups/vce-acme-glow/<timestamp> --db vce-acme-glow --wipe
```

Dumps are one-doc-per-line Extended JSON (`.jsonl`) — ObjectIds and Dates survive the
round-trip; files diff and stream cleanly. Schedule `fleet.js backup` (Task Scheduler /
cron) and sync the `backups/` directory somewhere off-machine.

## Hardening notes (already in the engine)

- `/api/health` for uptime checks; rate limits on login, guest reviews, order creation
  and coupon validation; JWT admin auth; per-store CORS origins.
- Secrets live only in env (server) — `client/.env` carries `REACT_APP_*` only.
- The DB helper suppresses the DEP0170 URI-leaking warning so credentials stay out of logs.
