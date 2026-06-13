# Aura Rare — Architecture (Source of Truth)

Premium cosmetics e-commerce. **No payments, no customer accounts, no stock.**
Checkout = WhatsApp. Single admin. Stack: React + Express + MongoDB + Cloudinary.

## Database Schema

Hierarchy: **Category → Product → Shade → Review**. Shade is the purchasable unit.

Reusable image shape (every image): `{ url, publicId }` (Cloudinary).

| Model | Key fields | Relationships |
|---|---|---|
| **Category** | name, slug, description, image, status, order | has many Products |
| **Product** | name, slug, description, category(ref), coverImage, isFeatured, status | belongs to Category; has many Shades |
| **Shade** | product(ref), name, slug, price, mrp, description, images[], status | belongs to Product; has many Reviews |
| **Review** | shade(ref), product(ref), customerName, rating(1–5), text, approved | belongs to Shade |
| **Banner** | image, heading, subheading, link, order, active | standalone |
| **StoreSettings** (singleton) | storeName, whatsappNumber, address, aboutUs, contact*, instagram/facebookUrl, hero* | standalone |

No SEO fields in DB — SEO is generated automatically in the app.

## API Endpoints

Base: `/api`. Admin routes require `loginCheck + adminCheck` (JWT role=1).

| Method | Route | Purpose |
|---|---|---|
| GET | `/categories` | list |
| GET | `/categories/:slug` | category + products |
| POST/PUT/DELETE | `/categories[/:id]` | admin CRUD (image) |
| GET | `/products` `?category&featured` | list |
| GET | `/products/:slug` | product + shades |
| POST/PUT/DELETE | `/products[/:id]` | admin CRUD (coverImage) |
| GET | `/shades/by-product/:productId` | shades of a product |
| POST/PUT/DELETE | `/shades[/:id]` | admin CRUD (images[]) |
| DELETE | `/shades/:id/image` | remove one image by publicId |
| GET | `/reviews/by-shade/:shadeId` | approved reviews |
| POST | `/reviews` | guest submit |
| GET/PUT/DELETE | `/reviews[/:id][/approve]` | admin moderation |
| GET | `/banners` `?all` | active (or all) |
| POST/PUT/DELETE | `/banners[/:id]` | admin CRUD (image) |
| GET | `/settings` | singleton |
| PUT | `/settings` | admin update (heroImage) |
| GET | `/search?q=` | shades (priority) + products + categories |
| GET | `/health` | liveness |
| POST | `/signin` (auth) | admin login |

**WhatsApp checkout is client-side only** — no backend endpoint, no order/lead storage.

## Cloudinary Setup
- Uploads stream via `multer-storage-cloudinary` → folder `aura-rare/<entity>`.
- Stored as `{ url: file.path, publicId: file.filename }`. No local disk paths.
- Deletion via `cloudinary.uploader.destroy(publicId)` (helper `destroyAssets`).
- Cascades: delete Category → its Products → Shades → Reviews + all images.

## Environment Variables (server/.env)
```
DATABASE=<mongodb atlas uri>
PORT=8000
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```
JWT secret: `config/keys.js` (move to env before production).

## Deployment Architecture
- **Frontend** → Vercel (React build)
- **Backend** → Render free tier (Express) — ephemeral disk, so images MUST be on Cloudinary
- **Database** → MongoDB Atlas free tier
- **Images** → Cloudinary free tier

## Soft-Deprecated
See `server/DEPRECATED.md` — braintree, orders, customize, users, local-upload script retained but disconnected.
