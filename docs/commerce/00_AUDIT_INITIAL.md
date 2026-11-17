# 00 — Auditoria inicial comercial (Fase 1)

**Versão comercial:** `2026-09`  
**Fonte de preços:** prompt mestre set/2026 (operacional).  
**PDFs oficiais:** presentes em Downloads — **PDF presente / texto não parseado** (image/compressed).

## Matriz Implementado / Parcial / Não / Depende externo

| Área | Status | Evidência |
|---|---|---|
| Catálogo SKU 2026-09 versionado | **Implementado** | `packages/validation/src/commercial-catalog.ts` + seed |
| Persistência `monetization_products` / `product_prices` | **Implementado** | sync idempotente + migration `0029` |
| API `GET /v1/commerce/catalog` | **Implementado** | público filtrado; sem credenciais |
| Sync admin `POST …/commerce/catalog/sync` | **Implementado** | org admin ou platform staff |
| UI `/planos` | **Parcial** | consome catálogo; sem checkout |
| UI módulos IA | **Parcial** | lista preço + status; sem compra |
| Juris One links comerciais | **Parcial** | ofertas relacionadas; sem checkout live |
| Carrinho universal / Asaas para todos SKUs | **Não** | Fase 2 |
| Entitlement engine pós-pagamento | **Parcial** | serviço existe; enforcement estreito |
| Marketplace splits/comissões OAB-safe | **Parcial** | regras no catálogo; execução Fase 4 |
| 24 módulos IA utilizáveis + cobrança | **Não** | SKUs catalogados; uso real Fase 5 |
| NFS-e/NF-e | **Não** / Depende externo | NOT_CONFIGURED |
| Admin commerce UI | **Não** | Placeholder AdminUnavailable |
| Créditos Work/AI wallets | **Parcial** | ledger existe; compra Asaas não |
| `PAYMENTS_LIVE=1` | **Proibido nesta fase** | purchaseReady=false |

## Homologação desta fase

Cada SKU: `CATALOG_SEEDED` / `NOT_READY_FOR_PURCHASE`.

Legacy keys desativadas no sync: `plan_individual`, `plan_professional`, `plan_office`, `plan_business`, `plan_enterprise`, `plan_white_label`.
