# Deprecated Modules — Removed

The soft-deprecated Hayroo modules (braintree, orders, customize, users
routers/controllers/models, uploadFolderCreateScript) were permanently
deleted after the storefront + admin cutover was verified end-to-end.

Retained & active: `routes/auth.js` (signin only), `controller/auth.js`,
`models/users.js`, `middleware/auth.js` — single-admin login.

Admin account management: `node scripts/createAdmin.js <email> <password>`.
