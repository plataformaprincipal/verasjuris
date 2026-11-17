# 05 — Roadmap Fases 2–9

Dependências transversais: Asaas sandbox → live, Resend, OpenAI budget, entitlements, NF.

## Fase 2 — Carrinho universal + checkout Asaas
- Carrinho para planos, créditos, módulos, adicionais
- Server-authoritative pricing (já parcial no marketplace)
- Sandbox only até checklist; **sem `PAYMENTS_LIVE=1` prematuro**

## Fase 3 — Entitlement engine pós-pagamento
- Aplicar `commercial_entitlements` / `billing_plan_features` após confirmação
- Upgrade/downgrade/prorrata/cancelamento

## Fase 4 — Marketplace splits / comissões OAB-safe
- 15% digital, 10% não jurídico, 0% honorários
- Split + repasse + conciliação

## Fase 5 — 24 módulos IA utilizáveis + cobrança
- Ligar SKUs AI_* a features reais do gateway
- Consumo de créditos + franquias

## Fase 6 — Serviços avançados / projetos
- SRV_* com marcos 30/70, propostas, aceite

## Fase 7 — Design system comercial
- Superfícies de oferta consistentes

## Fase 8 — Financeiro / NF
- NFS-e/NF-e (hoje NOT_CONFIGURED)

## Fase 9 — Homologação live
- Checklist Asaas live; `PAYMENTS_LIVE` só após evidência

## Critério de saída Fase 1 (esta entrega)
- [x] Catálogo 2026-09 versionado
- [x] API server-side
- [x] Matrizes publicadas
- [x] Sem cobrança de produção
- [ ] PR aberto sem merge automático
