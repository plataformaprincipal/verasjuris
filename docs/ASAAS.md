# Asaas — PaymentProvider / BillingProvider

## Princípio

Único adapter PSP concreto hoje: `AsaasPaymentProvider` (`packages/ai/src/asaas-payment-provider.ts`), via ADR 164. Assinaturas: `AsaasBillingProvider`. Default permanece `not_configured`.

## Ambiente

| Variável | Uso |
| --- | --- |
| `PAYMENT_PROVIDER` | `not_configured` (padrão) \| `asaas` |
| `BILLING_PROVIDER` | `not_configured` \| `asaas` |
| `ASAAS_API_KEY` | Chave (`access_token`). Sandbox: `$aact_hmlg_…` / Prod: `$aact_prod_…` |
| `ASAAS_ENVIRONMENT` | `sandbox` (padrão) \| `production` |
| `ASAAS_API_URL` | Override opcional da base (`…/v3`) |
| `ASAAS_WEBHOOK_TOKEN` | Token do header `asaas-access-token` (32–255 chars; **não** é a API key) |
| `ASAAS_USER_AGENT` | Default `VerasJuris` |
| `ASAAS_HEALTHCHECK` | `1` = ping de rede no health |
| `PAYMENTS_LIVE` | **Obrigatório `1`** para `ASAAS_ENVIRONMENT=production` |
| `FEATURE_PUBLIC_CHECKOUT` | `0` até homologação (padrão) |

Bases oficiais: `https://api-sandbox.asaas.com/v3` e `https://api.asaas.com/v3`.

## Capacidades

- **Pix:** cobrança `PIX` + `GET /payments/{id}/pixQrCode` → metadata `pixCopyPaste` / `pixQrCodeBase64`
- **Boleto:** `BOLETO` + `bankSlipUrl` / linha digitável
- **Cartão:** `CREDIT_CARD` **sem** PAN/CVV na nossa API — cliente paga na `invoiceUrl` Asaas
- **Assinaturas:** `POST /subscriptions` (MONTHLY / YEARLY)
- **Estorno / cancelamento:** `/payments/{id}/refund` e `DELETE /payments/{id}`
- **Webhook:** `POST /v1/webhooks/payments/asaas` com `asaas-access-token`

## Segurança

- Idempotência local em `payment_intents.idempotencyKey` + `payment_webhook_events.externalEventId`
- Webhook autenticado; eventos com `externalEventId` Asaas
- Isolamento multi-tenant nas rotas org-scoped existentes
- Sem armazenamento de cartão
- Assinatura `active` sem `externalSubscriptionId` vira `incomplete` se PSP configurado
- Checkout público (`metadata.publicCheckout`) bloqueado se `FEATURE_PUBLIC_CHECKOUT≠1`
- Produção Asaas bloqueada sem `PAYMENTS_LIVE=1`

## Homologação

1. Conta sandbox + chave + webhook apontando à API pública
2. `PAYMENT_PROVIDER=asaas` `ASAAS_ENVIRONMENT=sandbox` `ASAAS_WEBHOOK_TOKEN=…`
3. Testar Pix/boleto/cartão (fatura), estorno, cancelamento, webhook duplicado
4. Só então: produção + `PAYMENTS_LIVE=1` + autorização explícita de deploy

## Relacionado

`docs/PAYMENT_PROVIDER.md`, `docs/PAYMENT_WEBHOOKS.md`, `docs/PAYMENTS.md`, `docs/PRODUCTION_PAYMENTS_REPORT.md`
