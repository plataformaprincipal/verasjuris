# Fases 5–6

## Fase 5 — Módulos IA + cobrança
- Mapa: `packages/validation/src/ai-module-features.ts` (24 SKUs → features gateway + créditos/call)
- Gate: `assertAndConsumeAiCredits` em `runStructuredAi`
- Franquia do plano (`ai.credits_monthly` / `ai.light_ops_monthly`) antes da carteira
- Env:
  - `FEATURE_AI_MODULE_GATES=1` — exige grant `module.AI_*` (default off no rollout)
  - `FEATURE_AI_CREDIT_BILLING=1` — habilita débito de créditos/franquia (default off)
  - `FEATURE_AI_CREDIT_UNMAPPED=1` — cobra features sem binding

## Fase 6 — Serviços SRV_* 30/70
- Tables: `commerce_service_projects`, `commerce_service_milestones` (mig `0031`)
- Fluxo: proposta → aceite → checkout 30% → entrega → aceite entrega → checkout 70%
- API sob `/v1/organizations/:orgId/commerce/services/*`
- Pagamento: `referenceType=commerce_service_milestone` no `confirmPayment`
- SRV_* **não** entram no carrinho universal (marcos dedicados)

## Gates permanentes
`PAYMENTS_LIVE=0` por padrão · `purchaseReady: false` · `NOT_HOMOLOGATED`
