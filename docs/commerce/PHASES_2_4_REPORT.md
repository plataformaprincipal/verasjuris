# Relatório — Fases 2–4 (comercial)

**Branch:** `feat/commercial-catalog-phase-1`  
**Gates:** `PAYMENTS_LIVE=0` (padrão), `purchaseReady: false`, status `NOT_HOMOLOGATED`.

## Entregue

### Fase 1 (fechamento)
- Catálogo canônico `2026-09` em `packages/validation/src/commercial-catalog.ts`
- Migration `0029_commercial_catalog_types.sql`
- Sync + API `GET/POST …/commerce/catalog`

### Fase 2 — Carrinho universal + checkout Asaas
- Tables: `commerce_carts`, `commerce_cart_items`, `commerce_orders`, `commerce_order_items` (mig `0030`)
- API: `/v1/organizations/:orgId/commerce/cart*` + `…/checkout`
- Preços só no servidor; rejeita SKU `requires_proposal` / `proposal` / preço zero
- Checkout via `CheckoutService` com `referenceType=commerce_order` (Asaas sandbox gated)

### Fase 3 — Entitlement engine pós-pagamento
- `fulfillCommerceOrderOnPayment` no webhook/`confirmPayment`
- Packs → créditos IA (`purchase`, idempotente)
- Planos/addons/módulos → `organization_commercial_grants`
- `EntitlementService` lê grants comerciais de forma aditiva ao plano

### Fase 4 — Splits OAB-safe
- Seed: legal 0%, não jurídico 10%, digital 15% (`productType=marketplace`)
- Auto-allocate best-effort após pagamento de engagement marketplace
- Docs: `docs/commerce/SPLITS_OAB.md`

## Verificação
- `pnpm --filter @verasjuris/{validation,database,api} typecheck` — OK
- `vitest run apps/api/src/commerce.test.ts` — 6/6 OK

## Não feito (honesto)
- Homologação live / `PAYMENTS_LIVE=1`
- UI admin commerce
- NF-e/NFS-e
- Merge/deploy automático
