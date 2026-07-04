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

**This session (Gamma→Theta roadmap):**
1. **Γ payments hardening** — Razorpay provisioning from manifest (`commerce.payment.razorpay.keyId` + `PROVISION_RAZORPAY_KEY_SECRET`/`_WEBHOOK_SECRET`, fail-fast when enabled without keys); DNS-helper sweep confirmed clean. Commit `d75f0c4`.
2. **Δ 3B design tokens** — `aura.css` fully tokenized (typography/tracking/radius/density/motion + `--*-rgb` triplets for translucent tints); `StoreSettings.theme.tokens/fonts/motion`; ThemeApplier rework (fixes stale-CSS-var-on-clear bug, derives rgb from hex); FontLoader (runtime Google Fonts); useMotion (store "reduced" + OS `prefers-reduced-motion`); admin Typography & Motion section; `docs/THEMING.md`. Commit `e8a1ad1`.
3. **Ε presets & layouts** — 5 industry presets (`server/provisioning/industries/`) selected via `store.industry`, merge-under (explicit manifest wins), starter categories; `StoreSettings.layout.home` = editorial|catalog|minimal with Home.js refactored into composable sections (editorial unchanged); admin layout picker. Commit `5bb6ff4`.
4. **Ζ merchant ops** — inventory (variant `stock`, atomic confirm/cancel movements via `config/inventory.js`, PDP OOS, admin stock column, dashboard low-stock); coupons (model+CRUD+checkout apply, atomic consume on order create, validate rate-limited); server-side order re-pricing (client money never trusted); wishlist (device-local); analytics endpoint + dashboard bars; `NOTIFY_WEBHOOK_URL` order webhooks. Commit `56b1e6e`.
5. **Η fleet ops** — `backupDb.js`/`restoreDb.js` (EJSON .jsonl, explicit-target restore), `fleet.js` (list/health/backup/reapply) over gitignored `fleet.json` registry, `docs/DEPLOYMENT.md`. Commit `dc3d7a4`.
6. **Θ growth** — `/sitemap.xml` (server-generated), `usePageSeo` + Product/Offer JSON-LD on PDP, resume-cart bar. Commit `0c3a224`.
7. **Aura back-port wave** (from `aura-rare-beauty` commits `03c282a`/`6e3c1a5`/`158d610`+/`75eed12`/`5c4ec01`/`64fa8b3`, generalized for VCE): intro curtain preloader (content-slot tag line, skips admin/reduced-motion); trust-stats band — **admin-editable** via `StoreSettings.stats` (aura hardcodes them) + count-up on scroll, `stats` section in all three layouts; drag-to-reorder categories & variants (`useRowDnd`, `order` field, PATCH reorder endpoints, append-on-create); banner slideshow hero (contain, ¾-height band, dots) + clean single-image hero + solid navbar; desktop nav hover flyout previewing collections/products. Browser-verified against the running dev store.

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

_Last updated: end of the Γ→Θ roadmap wave (payments provisioning, 3B tokens, industry presets + layouts, merchant ops, fleet ops, growth/SEO). Branch `vce-alpha`, local — push pending user go-ahead. Docs: PROVISIONING / THEMING / DEPLOYMENT._
