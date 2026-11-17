# Splits marketplace OAB-safe

| Categoria (`serviceType`) | Platform bps | Nota |
|---------------------------|--------------|------|
| `legal_fees` | 0 | Honorários advocatícios — plataforma **não** comissiona |
| `non_legal_services` | 1000 (10%) | Serviços não jurídicos |
| `digital_courses` | 1500 (15%) | Cursos / produtos digitais |

`productType` das regras: `marketplace`. Seed: `ensureOabMarketplaceSplitRules` (orgId null).

Default de classificação: `legal_fees` (0%) — evita cobrança indevida de honorários.

Pós-pagamento marketplace: `PaymentService.confirmPayment` chama `allocatePaymentSystem` best-effort.
