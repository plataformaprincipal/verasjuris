# Checklist de homologação de pagamentos (Asaas)

Fonte operacional: `GET /v1/platform/payments/homologation-checklist`.

| Evidência | Obrigatória | Como verificar |
|-----------|-------------|----------------|
| `PAYMENT_PROVIDER=asaas` | sim | env / checklist |
| `ASAAS_API_KEY` presente | sim | boolean (sem expor segredo) |
| `ASAAS_WEBHOOK_TOKEN` presente | sim | boolean |
| Payment healthCheck ok/degraded | sim | provider |
| Sandbox antes de production | sim | `ASAAS_ENVIRONMENT` |
| Catálogo `purchaseReady=false` | sim | até gate liberado |
| Sign-off humano | sim | fora da API |
| `PAYMENTS_LIVE` | report only | **nunca** setado por esta API |
| `FEATURE_PUBLIC_CHECKOUT` | report only | |

`readyForLive` permanece `false` enquanto qualquer item obrigatório falhar **ou** não houver sign-off humano.

Ver também: `docs/ASAAS.md`, `docs/commerce/PHASES_7_9.md`.
