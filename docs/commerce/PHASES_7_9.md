# Fases 7–9

## Fase 7 — Design system comercial
- Átomo: `apps/web/src/components/commerce-offer-card.tsx` (`card` | `row` | `compact`)
- Sempre exibe `NOT_HOMOLOGATED` + `purchaseStatus`
- `commerce-catalog-ui.tsx` compõe a partir do átomo

## Fase 8 — Financeiro / NF
- Tabela `fiscal_documents` (mig `0032`)
- `FiscalDocumentService` + rotas `/organizations/:orgId/fiscal-documents*`
- Provider default `not_configured` — **nunca** inventa número/accessKey/autorização
- Status típico ao solicitar: `pending_homologation`

## Fase 9 — Homologação live (checklist)
- `GET /v1/platform/payments/homologation-checklist` (somente leitura)
- Resumo em `GET /v1/commerce/catalog/purchase-status`
- `readyForLive` é **sempre** `false` até sign-off humano externo
- Esta API **não escreve** `PAYMENTS_LIVE`

## Gates
`PAYMENTS_LIVE=0` · `purchaseReady: false` · `NOT_HOMOLOGATED`
