# Viltrumate Commerce Engine (VCE)

A reusable, vertical-agnostic **MERN commerce engine** by Viltrumate Technologies — one maintainable
codebase that can power multiple client storefronts. VCE was extracted from a single-brand
cosmetics store (Aura Rare) and generalized into a configuration-driven engine: identity, theme,
SEO, payment methods, and feature flags are all data, not hardcoded.

> **Architecture model:** _Shared codebase + a separate database per store._ Each client store runs
> the same code pointed at its own database, with its own environment and `StoreSettings`. This is
> **not** row-level multi-tenancy — tenant routing is intentionally out of scope for now.

---

## Tech stack

- **Frontend:** React 16 (CRA), Tailwind-style utility CSS, CSS-variable theming
- **Backend:** Node.js + Express
- **Database:** MongoDB + Mongoose 5
- **Media:** Cloudinary
- **Auth:** JWT (admin)
- **Checkout:** WhatsApp + Cash on Delivery (Razorpay/Stripe stubbed for future)

---

## Capabilities

| Area | Status |
| --- | --- |
| Catalog (categories, products) | ✅ Implemented |
| Variants (the purchasable unit; CRUD incl. bulk ops) | ✅ Implemented |
| Runtime theming (admin-editable CSS variables) | ✅ Implemented |
| Store settings (identity / theme / SEO / payment / features) | ✅ Implemented |
| Order management (create, list, details, status workflow) | ✅ Implemented + verified |
| Admin dashboard with order metrics & pending alerts | ✅ Implemented + verified |
| WhatsApp / COD checkout (every order recorded) | ✅ Implemented |
| Customer reviews (feature-flagged) | ✅ Implemented |
| Runtime SEO (per-store title / meta description) | ✅ Implemented |
| Feature flags (reviews, wishlist, coupons, inventory, cod, whatsappCheckout) | ⚙️ Infra in place; enforcement on reviews + payment providers |
| Wishlist / Coupons / Inventory | 🔲 Flag placeholders only |
| Multi-store provisioning / tenant routing | 🗺️ Planned |

---

## Configuration model

Two tiers, so changing a store never requires editing business logic:

1. **Build-time fallbacks** — `client/src/config/*` and `server/config/store.config.js`
   (currency, locale, store name, variant label). These are only defaults.
2. **Runtime overrides** — the admin-editable `StoreSettings` singleton (identity, theme colors,
   SEO, payment providers, feature flags). Whatever it sets overrides the build-time fallbacks.

Feature flags live in `server/config/features.js` with a client mirror in
`client/src/config/features.config.js`; the server guard `requireFeature()` 403s disabled features.

---

## Getting started

### Prerequisites
- Node.js (LTS) and npm
- A MongoDB database (local or Atlas)
- A Cloudinary account (for product/store images)

### 1. Install

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Configure environment

Copy the example files and fill in your own values (never commit `.env`):

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

- **`server/.env`** — `DATABASE` (must include the database name), Cloudinary keys,
  `JWT_SECRET`, `CLOUDINARY_FOLDER`, optional `CORS_ORIGINS`.
- **`client/.env`** — `REACT_APP_API_URL` (e.g. `http://localhost:8000`) plus optional
  `REACT_APP_STORE_NAME` / `REACT_APP_CURRENCY_SYMBOL` / `REACT_APP_LOCALE` /
  `REACT_APP_VARIANT_LABEL` branding fallbacks.

> **Windows / DNS note:** `mongodb+srv://` requires a DNS SRV lookup that can fail on some
> Windows setups (`querySrv ECONNREFUSED`). The server points the resolver at public DNS by
> default; override with `DNS_SERVERS="1.1.1.1,8.8.8.8"` or disable with `DNS_SERVERS="off"`.

### 3. Create an admin user

```bash
cd server
node scripts/createAdmin.js <email> <password(8+ chars)> "Admin Name"
```

### 4. (Optional) Seed demo catalog

```bash
node scripts/seed.js   # WARNING: clears catalog collections first
```

### 5. Run

```bash
# terminal 1 — API
cd server && npm run start:dev

# terminal 2 — storefront + admin
cd client && npm start
```

- Storefront: <http://localhost:3000/>
- Admin: <http://localhost:3000/admin/login>

---

## Project structure

```
client/                 React storefront + admin SPA
  src/config/           build-time store config + feature flags
  src/storefront/       customer-facing pages, theming, SEO
  src/payments/         payment provider registry (whatsapp, cod, stubs)
  src/components/admin/  admin dashboard (catalog, orders, settings, ...)
server/
  config/               db, cloudinary, store config, feature flags
  models/               Mongoose schemas (products, variants/shades, orders, storeSettings, ...)
  controller/ routes/   REST API under /api
  scripts/              createAdmin, seed, maintenance
```

---

## API overview

All endpoints are under `/api`. Highlights:

- `GET /api/products`, `GET /api/categories`, `GET /api/variants/by-product/:id`
- `POST /api/orders` (public — records every checkout) · `GET /api/orders` (admin, paginated,
  newest first, `?status=` filter) · `GET /api/orders/:id` · `PATCH /api/orders/:id/status`
- `GET/PUT /api/settings` (store configuration)
- `GET /api/stats` (admin dashboard counts + order metrics)
- `GET /api/health`

---

## Roadmap

- **Store provisioning / onboarding** — one-command setup of a new client store (env + settings +
  admin + branding) to cut setup from hours to minutes.
- **Tenant routing** — optional future step toward many stores from one deployment.
- **Commerce modules** — coupon engine, inventory, wishlist.

---

_Built by Sambhav for Viltrumate Technologies._
