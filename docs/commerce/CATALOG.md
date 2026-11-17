# Catálogo comercial VerasJuris (2026-09)

Fonte canônica em código: `packages/validation/src/commercial-catalog.ts`.

Sync idempotente: `POST /v1/commerce/catalog/sync` (platform) ou
`POST /v1/organizations/:orgId/commerce/catalog/sync`.

Persiste em `monetization_products` + `product_prices` + `commercial_entitlements`.

**Status de compra:** `NOT_HOMOLOGATED` / `purchaseReady: false`. `PAYMENTS_LIVE` permanece `0` por padrão.
