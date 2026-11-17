# Roadmap comercial

| Fase | Escopo | Status |
|------|--------|--------|
| 1 | Catálogo SKU 2026-09 + sync + API | Implementado (seed; não homologado) |
| 2 | Carrinho universal + checkout Asaas (planos/créditos/módulos) | Implementado (sandbox / `PAYMENTS_LIVE=0`) |
| 3 | Entitlement engine pós-pagamento | Implementado (`organization_commercial_grants` + créditos IA) |
| 4 | Splits/comissões OAB-safe (0% / 10% / 15%) | Implementado (seed + auto-allocate no webhook) |
| 5 | 24 módulos IA + cobrança/franquia no gateway | Implementado (gates env; sem PAYMENTS_LIVE) |
| 6 | Serviços SRV_* marcos 30/70 + proposta/aceite | Implementado (sandbox checkout) |
| 7+ | Design system, NF, homologação live | Pendente |

Nunca habilitar produção via catálogo. Gates: `PAYMENTS_LIVE`, `FEATURE_PUBLIC_CHECKOUT`.
