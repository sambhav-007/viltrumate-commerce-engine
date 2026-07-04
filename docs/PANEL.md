# VCE Panel — the agency control plane

One UI to **create client stores and manage every store's look, features and payments**
across all fleet databases — including taking those controls **away from the client's
admin** so they're managed exclusively by your agency.

## Start it

```bash
cd server
export PROVISION_CLUSTER_URI="mongodb+srv://USER:PASS@cluster.mongodb.net"  # no db name
export PANEL_KEY="a-long-random-key"        # optional — generated + printed if unset
npm run panel                                # → http://localhost:8100
```

Enter the panel key in the browser. The panel is a **local operator tool** — don't expose
it to the internet as-is (it holds cluster-wide write power).

## What it does

| Area | Details |
| --- | --- |
| **Create store** | Name, id, industry preset, admin email → provisions the store's own database: StoreSettings (with the industry's theme/label/layout/flags), admin user (password shown once), starter categories. Manifest saved to `provisioning/stores/<id>.json`, registered in `fleet.json`. Env files + deployment stay a CLI step (docs/DEPLOYMENT.md). |
| **Identity** | Store name, variant label, WhatsApp, contact, hero copy |
| **Theme** | All 8 brand colors, design tokens (JSON), body/display fonts + Google families, motion |
| **Layout** | Homepage variant (editorial / catalog / minimal) |
| **Features** | reviews, wishlist, coupons, inventory, cod, whatsappCheckout |
| **Payment** | Enabled providers + default (Razorpay keys stay env-side per store) |
| **Trust stats** | The homepage count-up band |
| **Agency locks** | See below |

Changes save **directly into the target store's database** and are live on that
storefront immediately.

## Agency locks (`lockedSections`)

Tick a section under **Agency locks** and it becomes agency-managed:

- the section **disappears from the client's admin Settings** (replaced by a
  "Managed by your agency" notice), and
- the store's settings API **rejects writes** to it — the lock is enforced
  server-side, not just hidden.

Only the panel (direct DB access) can change locked sections or the locks themselves.
Lockable: `identity, theme, layout, payment, features, seo, stats, content`.

## How it works

- Registry: `provisioning/fleet.json` (+ one manifest per store in `provisioning/stores/`)
  — the same registry `scripts/fleet.js` uses for health/backup/reapply.
- DB access: one store at a time through the shared connect helper (serialized queue),
  using `PROVISION_CLUSTER_URI` + each store's db name.
- Provisioning is idempotent; a failed create can be re-run (`retry: true`, offered by
  the UI error path).
