# Carrinho, Checkout e Pagamentos Asaas — Relatório

**Branch:** `fix/marketplace-checkout-asaas`  
**Ambiente de cobrança:** sandbox (não ativar produção sem homologação)  
**Data:** 2026-11-16

## 1. Arquivos alterados

| Área | Arquivos |
|------|----------|
| Schema / migration | `packages/database/src/schema/marketplace.ts`, `packages/database/src/schema/index.ts`, `packages/database/drizzle/0027_marketplace_checkout_attempts.sql`, `packages/database/drizzle/meta/_journal.json` |
| Validação | `packages/validation/src/marketplace.ts` |
| Checkout API | `apps/api/src/modules/marketplace/cart.ts`, `routes.ts`, `service.ts` |
| Asaas | `packages/ai/src/asaas-client.ts`, `packages/ai/src/asaas-payment-provider.ts` |
| Webhook | `apps/api/src/modules/finance/payment-service.ts` (validação de valor) |
| Frontend | `apps/web/src/app/app/carrinho/page.tsx`, `apps/web/src/app/app/marketplace/checkout/[id]/page.tsx`, `apps/web/src/app/marketplace/contratacoes/[id]/page.tsx`, `apps/web/src/lib/marketplace.ts` |
| Testes | `apps/api/src/marketplace-cart-checkout.test.ts` |

## 2. Rotas utilizadas e criadas

**Preservadas**

- `GET/POST/PATCH/DELETE …/marketplace/cart…`
- `POST …/marketplace/cart/checkout`
- `POST …/marketplace/engagements/:engagementId/payment/provider`
- `POST /v1/webhooks/payments/:provider`

**Criada**

- `GET …/marketplace/checkouts/:checkoutId` — consulta tentativa sem gerar nova cobrança

## 3. Migrations

- `0027_marketplace_checkout_attempts` — tabelas `marketplace_checkout_attempts` e `marketplace_checkout_attempt_items`
- Não destrutiva

## 4. Fluxo completo de checkout

1. Carrinho recalcula preços no servidor (`unitPriceCents` / `lineTotalCents`).
2. Cliente envia `idempotencyKey` + `paymentMethod` + `acceptTerms`.
3. Backend persiste snapshot imutável e trava o carrinho (`checking_out`).
4. Por item (fora de TX longa): cria request/proposta/engagement → chama Asaas → grava `payment_intent`.
5. Itens já `payment_initiated` são pulados em retries.
6. Frontend abre `/app/marketplace/checkout/:id` com Pix QR / copia-e-cola / boleto.
7. Confirmação financeira somente via webhook autenticado → `activateMarketplaceEngagementOnPayment`.

## 5. Evidências dos testes

```text
pnpm --filter @verasjuris/api exec vitest run src/marketplace-cart-checkout.test.ts
Test Files  1 passed (1)
Tests  5 passed (5)
```

Cenários cobertos no arquivo: A (1 item + replay), B+D (multi + concorrência), C (falha parcial + resume), H (isolamento org), G (preço recalculado no GET).

Webhook duplicado / Asaas sandbox já cobertos em `asaas-payments.integration.test.ts` e `payments.test.ts` (existentes).

## 6. Situação do webhook

- Token `asaas-access-token` / `ASAAS_WEBHOOK_TOKEN` validado
- Idempotência por `(providerKey, externalEventId)`
- Associação ao `payment_intent`
- **Novo:** divergência de valor → `AMOUNT_MISMATCH` + `reconciliation_required` (sem confirmação automática)
- Ativação de contratação só após confirmação financeira no backend

## 7. Situação do Asaas

- Reuso de `AsaasPaymentProvider` / `AsaasClient` / `createPaymentProviderFromEnv`
- Deduplicação de cliente por e-mail / CPF / `externalReference` antes de `createCustomer`
- Pix/boleto enriquecidos em metadata; cartão só via fatura hospedada (sem PAN/CVV)
- **Sandbox** permanece o alvo operacional; `PAYMENTS_LIVE=0` / produção não ativados por este PR

## 8. Funcionalidades pendentes

- Homologação live Asaas + split de marketplace (não presumido habilitado)
- Parcelamento de cartão (só se o provedor expor na fatura)
- UI de estados vencido/cancelado com polling do provedor em tempo real além do status local
- Aplicar migration `0027` nos ambientes antes do uso

## 9. Riscos financeiros remanescentes

- Split/repasses automáticos **não** homologados — usar regras cadastradas, sem percentuais inventados
- Webhook com valor ausente usa o valor do intent (OK); valor divergente vai para conciliação
- Assinaturas SaaS permanecem no fluxo de billing separado (não misturadas ao checkout avulso)
- Cobranças reais exigem autorização explícita e `PAYMENTS_LIVE` / ambiente production

## 10. Critério de aceitação

Usuário autenticado consegue: adicionar serviço → checkout idempotente → cobrança sandbox → consultar pagamento → contratação atualizada só após webhook, sem duplicidade de cobrança na mesma chave de idempotência.
