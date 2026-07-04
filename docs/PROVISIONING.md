# Store Provisioning

VCE follows a **shared codebase + a separate database per store** model. Standing up a new
client store is configuration + data generation — never code edits. The **manifest** is the
single source of truth; it is secret-free and safe to version-control.

## One-time operator setup

Set these in your shell (or a gitignored `provisioning.env`) — they are the **only** secrets,
and they never enter a manifest:

```bash
export PROVISION_CLUSTER_URI="mongodb+srv://USER:PASS@cluster.mongodb.net"   # no db name
export CLOUDINARY_CLOUD_NAME="..."
export CLOUDINARY_API_KEY="..."
export CLOUDINARY_API_SECRET="..."
# optional: export DNS_SERVERS="8.8.8.8,1.1.1.1"
# optional (only for stores with online payment — see "Razorpay" below):
export PROVISION_RAZORPAY_KEY_SECRET="..."
export PROVISION_RAZORPAY_WEBHOOK_SECRET="..."   # optional webhook backstop
```

## Provision a new client store

1. **Copy the manifest template** and fill it in:
   ```bash
   cp server/provisioning/client-manifest.example.json client-manifest.json
   ```
   Set identity (name, currency, locale, variant label, contact, WhatsApp), branding (logo,
   theme colors, SEO), commerce (enabled features + payment providers), the admin email, and the
   infrastructure block (database name, Cloudinary folder, API/client URLs). Real stores keep
   `store.catalog.preset` = `"empty"`.

2. **Run one command:**
   ```bash
   cd server
   node scripts/provision.js ../client-manifest.json
   ```
   This generates `server/.env` + `client/.env`, applies `StoreSettings` (branding/SEO/features/
   payment), creates the admin user (a strong password is generated and printed **once** if you
   didn't supply one), and seeds the chosen catalog preset — all in the store's own database.
   Missing required fields are prompted for (TTY) and written back to the manifest.

3. **Start it:**
   ```bash
   # terminal 1
   cd server && npm run start:dev
   # terminal 2
   cd client && npm start
   ```
   The storefront comes up fully branded; the client signs into `/admin/login` to upload products.

## What provisioning sets, all from the manifest

| Group | Fields |
| --- | --- |
| Identity | store name, currency, locale, variant label, contact info |
| Branding | logo, theme colors, design tokens (radius/tracking/density), fonts (incl. Google Fonts), motion level, SEO (title/description/og image) |
| Commerce | enabled payment methods, feature flags |
| Admin | initial admin user (password generated if omitted) |
| Infrastructure | database name, Cloudinary folder |

## Razorpay (online payment)

To provision a store with online payment enabled:

1. In the manifest: add `"razorpay"` to `commerce.payment.enabledProviders` and set
   `commerce.payment.razorpay.keyId` to the store's **public** key id (`rzp_test_…` /
   `rzp_live_…` — safe in the manifest, Checkout sends it to the browser anyway).
2. In the operator environment: set `PROVISION_RAZORPAY_KEY_SECRET` (required) and
   optionally `PROVISION_RAZORPAY_WEBHOOK_SECRET`.

Provisioning writes `RAZORPAY_*` into `server/.env` and enables the provider via
`StoreSettings.payment.enabledProviders`. Enabling `razorpay` without keys **fails fast** —
a store must never ship with a broken money path. WhatsApp/COD stores need none of this.

## Industry presets

Set `store.industry` in the manifest to pre-fill an entire vertical personality —
variant label, theme colors + design tokens + fonts + motion, homepage layout, feature
flags, and starter categories. Anything you set explicitly in the manifest **always wins**;
the industry only fills what you left blank.

Available: `beauty`, `jewelry`, `footwear`, `apparel`, `food`
(one JSON each in `server/provisioning/industries/` — adding a vertical is just a new file).

Starter categories are seeded only when the catalog preset is `empty`.

## Catalog presets

- `empty` — default; no products (the client adds catalog via the admin or a future CSV import).
- `aura-rare` — **development only**; reproduces the original demo catalog.

## Safety & rollback

- Provisioning targets a **new database** — if anything fails, drop that database; other stores
  and the shared codebase are untouched.
- `generateEnv` refuses to overwrite an existing `.env` without `--force`, and writes a `.bak`.
- All steps are idempotent (StoreSettings upsert, admin upsert) — re-running converges.
- The admin password is never written to the manifest; the manifest carries no secrets.

## Forward compatibility

The manifest is the long-term contract between VCE and each store. Future phases add keys
(custom domains, tenant routing, multiple admins, email notifications, Razorpay/Stripe) without
removing existing ones — v1 consumers ignore unknown fields. See `_forwardCompatNotes` in the
example manifest.
