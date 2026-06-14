# Viltrumate Commerce Engine (VCE) — Architecture (Source of Truth)

A reusable, configuration-driven commerce engine (derived from the Aura Rare
storefront). Vertical-agnostic: the same engine serves cosmetics, fashion,
electronics, furniture, jewelry, etc. Stack: React + Express + MongoDB +
Cloudinary. Checkout is provider-based (WhatsApp, Cash-on-Delivery; Razorpay/
Stripe prepared).

## Domain Model

Hierarchy: **Category → Product → Variant → Review**. The **Variant** is the
purchasable unit (its own name, price, MRP, images).

> Naming note: the Variant Mongoose model is registered as `"shades"` and its
> Mongo collection stays `shades` for backward-compatibility with existing data
> and `ref: "shades"` relations. Only the code vocabulary moved to "Variant".
> The customer-facing label is configurable via `variantLabel` (e.g. "Shade",
> "Size", "Model", "Option").

Reusable image shape (every image): `{ url, publicId }` (Cloudinary).

| Model | Key fields | Relationships |
|---|---|---|
| **Category** | name, slug, description, image, status, order | has many Products |
| **Product** | name, slug, description, category(ref), coverImage, isFeatured, status | belongs to Category; has many Variants |
| **Variant** (collection `shades`) | product(ref), name, slug, price, mrp, description, images[], status | belongs to Product; has many Reviews |
| **Review** | shade(ref → Variant), product(ref), customerName, rating(1–5), text, approved | belongs to Variant |
| **Banner** | image, heading, subheading, link, order, active | standalone |
| **StoreSettings** (singleton) | identity, theme, payment, seo, features (extended in Phase D) | standalone |

## Configuration Architecture (Phase A)

Two tiers. Bootstrap config (env/code) provides defaults needed before/independent
of the runtime settings fetch; runtime `StoreSettings` overrides them.

- **client/src/config**: `store`, `theme`, `payment`, `seo`, `features` configs.
- **server/config/store.config.js**: `CLOUDINARY_FOLDER`, currency, locale, name.
- **server/config/features.js**: generic feature-flag engine + `requireFeature()`.

Feature flags (generic + extensible): `reviews`, `wishlist`, `coupons`,
`inventory`, `cod`, `whatsappCheckout`. Client mirror in
`client/src/config/features.config.js` (`useFeature(flag)` hook).

## API Endpoints

Base: `/api`. Admin routes require `loginCheck + adminCheck` (JWT role=1).
Variants are served at `/api/variants/*`; `/api/shades/*` remains as a
deprecated back-compat alias to the same router.

| Method | Route | Purpose |
|---|---|---|
| GET | `/categories[/:slug]` | list / detail+products |
| GET | `/products` `?category&featured` | list |
| GET | `/products/:slug` | product + variants (`variants`, alias `shades`) |
| GET | `/variants/by-product/:productId` | variants of a product |
| POST/PUT/DELETE | `/variants[/:id]` | admin CRUD (images[]) |
| POST/PATCH | `/variants/bulk` | admin bulk create/update |
| DELETE | `/variants/:id/image` | remove one image by publicId |
| GET/POST | `/reviews/by-shade/:id`, `/reviews` | read approved / guest submit (gated by `reviews` flag) |
| GET/PUT/DELETE | `/reviews[/:id][/approve]` | admin moderation |
| GET | `/banners` `?all` | active (or all) |
| POST/PUT/DELETE | `/banners[/:id]` | admin CRUD |
| GET/PUT | `/settings` | singleton read / admin update |
| GET | `/search?q=` | variants + products + categories |
| GET | `/health` | liveness |
| POST | `/signin` | admin login |

## Cloudinary
- Uploads stream to Cloudinary folder `<CLOUDINARY_FOLDER>/<entity>` (default
  `vce`). Existing Aura deployments must set `CLOUDINARY_FOLDER=aura-rare`.
- Stored as `{ url, publicId }`. Cascades delete images on entity removal.

## Deployment
- Frontend → Vercel · Backend → Render · DB → MongoDB Atlas · Images → Cloudinary.

## Tenancy
- VCE Alpha is single-deployment + config-driven. Recommended production model:
  shared codebase + separate database per store (DB-per-tenant routing is a
  later phase, NOT in Alpha).
