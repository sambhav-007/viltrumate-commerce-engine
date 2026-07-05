# VCE — Session Handoff

Context handout for picking up the **Viltrumate Commerce Engine (VCE)**. Read this before continuing.

---

## 1. What VCE is

A reusable, vertical-agnostic **MERN commerce engine** extracted from a single-brand cosmetics store (Aura Rare) and generalized so one codebase can power many client storefronts.

- **Architecture model:** _shared codebase + a separate database per store._ Each store runs the same code pointed at its own DB, with its own `.env` and `StoreSettings`. This is **not** row-level multi-tenancy — tenant routing is intentionally **not** built.
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
| Reviews (feature-flagged) | ✅ |
| Runtime theme colors + SEO | ✅ |
| Responsive admin (mobile) | ✅ verified at 375px |
| Design-token personality (3B) | 🗺️ planned only |
| Wishlist / Coupons / Inventory | 🔲 flag placeholders only |
| Tenant routing / Stripe | 🔲 not started (out of scope) |

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

**Windows DNS:** `mongodb+srv` SRV lookup can fail; the shared db helper points the resolver at public DNS by default (`DNS_SERVERS=...`, or `off`).

## 6. Open items / next steps

1. **Razorpay live test (highest priority to close):** end-to-end is verified **up to and including** the hosted Checkout modal opening with a real test order, but a **successful test-card capture → `/verify` → order `confirmed`** was not observed (test attempts came back `failed`, which correctly left orders `pending`). To finish: set test keys in a store `.env`, enable `razorpay` in `StoreSettings.payment.enabledProviders`, pay with card `4111 1111 1111 1111` (complete the Success/OTP step), confirm the order flips to `confirmed`. Also set `RAZORPAY_WEBHOOK_SECRET` to exercise the (wired but untested) webhook backstop.
2. **3B — Design Token Expansion** (planned): tokenize `aura.css` (typography/spacing/radius/motion/density) + `FontLoader` + `useMotion`, extend `StoreSettings.theme.tokens/fonts/motion`. Goal: stores stop *looking* like Aura, not just *reading* generic. Then a fresh audit before Layout Variants / Industry Presets.
3. **DNS helper in scripts:** `app.js` + provisioning scripts use the shared helper; double-check any remaining standalone scripts.
4. **Known small bug:** `ThemeApplier` doesn't reset a CSS var when a color is cleared (persists until reload) — fold into 3B's `ThemeApplier` rework.
5. **Provisioning could set `RAZORPAY_*`** per store (currently env-only).

## 7. Guardrails / conventions

- **Commit messages: NO Claude/Anthropic attribution** (user preference; applies to both repos).
- **Small focused commits; runtime-verify each step before moving on.** Don't mark work complete on static inspection alone.
- **Verification pattern (used throughout):** spin an **isolated `vce_verify` database** via a temp boot wrapper that swaps `DATABASE` (never the prod Aura-Rare-Beauty DB), test via API/controllers and/or browser (Claude Preview MCP), then **drop the DB** and remove temp files.
- **Dev servers:** the user runs their own on **:8000 / :3000** — **ask before killing** anything on those ports; prefer alternate ports / isolated DBs.
- **Shade→Variant compatibility is locked:** the variant collection stays registered as `"shades"`; internal `shade*` identifiers (cart `shadeId`, `/api/shades` alias, refs) are intentionally retained. Vocabulary moved to "Variant" only at the UI/API surface.
- Scope discipline: don't start tenant routing, Stripe, wishlist, coupons, inventory, or 3B unless asked.

## 8. Security notes

- `.env` files are gitignored and **never committed**; full history was scanned clean before the repo went public.
- ⚠️ During verification the **MongoDB password and Cloudinary secret were exposed in local terminal logs** (a Node `DEP0170` deprecation print + a deprecation warning). They are not in any repo or commit, but **rotating those credentials is recommended**. The shared db helper now suppresses the URI-leaking `DEP0170` warning going forward.
- `client/.env` should contain **only** `REACT_APP_*` vars; provisioning's `generateEnv` enforces this split (server secrets stay in `server/.env`).

## 9. Memory (persists across sessions)

- No Claude/Anthropic attribution in commits.
- The user runs dev servers on :8000/:3000 — ask before killing them.

---

_Last updated: end of Beta priorities 1–5 + mobile-responsive admin + back-port to aura-rare-beauty. Branch `vce-alpha` @ `d42b473`, pushed._
