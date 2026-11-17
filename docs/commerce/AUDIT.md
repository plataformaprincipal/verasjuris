# Auditoria comercial (resumo)

- **Preços:** sempre servidor (`product_prices` / catálogo). Cliente não define amount.
- **Marketplace cart:** serviços profissionais (`professionalServiceId`) — fluxo legado.
- **Commerce cart:** SKUs catálogo (`commerce_carts` / `commerce_orders`) — Fase 2.
- **Asaas:** provider + webhook; produção bloqueada sem `PAYMENTS_LIVE=1`.
- **Entitlements:** `EntitlementService` lê plano + `organization_commercial_grants`.
- **Splits:** regras OAB versionadas em `split_rules`; alocação cria payables.
- **Honestidade:** endpoints retornam `purchaseReady: false` / `NOT_HOMOLOGATED`.
