# Relatório — Integração Asaas e preparação para produção

Data: 2026-11-11  
Branch: `feature/payments-asaas-production` (preserva alterações de `reform/platform-maturity-a11y-i18n-auth`)

**Classificação: BLOCKED** (código Asaas + gates locais ok; infra de produção e cobrança real não liberadas)

## 1. Funcionalidades efetivamente implementadas

| Capacidade | Status |
| --- | --- |
| Adapter `AsaasPaymentProvider` (Pix QR + copia e cola, boleto, cartão via fatura hospedada) | Implementado |
| Adapter `AsaasBillingProvider` (assinaturas MONTHLY/YEARLY) | Implementado |
| Factory `createPaymentProviderFromEnv` / `createBillingProviderFromEnv` | Implementado |
| Webhook autenticado (`asaas-access-token`) + `externalEventId` idempotente | Implementado |
| Cancelamento e reembolso via API Asaas | Implementado |
| Persistência de metadata Pix/boleto/invoice no intent/checkout | Implementado |
| UI de instruções de pagamento (QR/copia-cola/boleto/fatura) | Implementado |
| Gate `FEATURE_PUBLIC_CHECKOUT=0` + aviso em `/planos` | Implementado |
| Gate `PAYMENTS_LIVE` para produção Asaas | Implementado |
| Assinatura `active` sem ID externo → `incomplete` com PSP | Implementado |
| Painel admin financeiro (histórico, inadimplência, conciliação) | Já existente; reutilizado |
| Cobranças reais / deploy / migrate produção | **Não executados** (proibido) |

Cartão: **não** recebe PAN/CVV na API VerasJuris — redireciona para `invoiceUrl` Asaas (PCI).

## 2. Arquivos principais

- `packages/ai/src/asaas-client.ts`
- `packages/ai/src/asaas-payment-provider.ts` (+ `.test.ts`)
- `packages/ai/src/asaas-billing-provider.ts` (+ `.test.ts`)
- `packages/ai/src/create-payment-provider.ts`
- `packages/ai/src/payment-provider.ts` (`externalEventId`)
- `packages/ai/src/index.ts`
- `packages/config/src/env.ts`, `.env.example`
- `apps/api/src/create-app-from-env.ts`
- `apps/api/src/modules/finance/{payment,checkout,billing}-service.ts`
- `apps/web/src/components/finance-ui.tsx`
- `docs/ASAAS.md`, `docs/PAYMENT_PROVIDER.md`, `docs/PRODUCTION_DEPLOY.md`, este relatório

## 3. Testes

| Gate | Resultado |
| --- | --- |
| Unit Asaas (10) | PASS |
| `payments.test.ts` + refunds (fake PSP / webhook / estorno) | PASS |
| Suite completa | **615 PASS** em 121 files; 1 erro flaky de worker Vitest em `supabase-storage.test.ts` (reexecução isolada PASS) |
| Typecheck workspace | PASS |
| Build api (`vercel.cjs`) / worker / web | PASS |
| Sandbox Asaas com chave real | **Não executado** (mocks only; sem cobrança real) |
| Lint Biome (arquivos tocados) | Format OK; warnings históricos `noNonNullAssertion` |

## 4. Variáveis necessárias (nomes apenas)

Ver `docs/ASAAS.md` / `.env.example`:

`PAYMENT_PROVIDER`, `BILLING_PROVIDER`, `ASAAS_API_KEY`, `ASAAS_ENVIRONMENT`, `ASAAS_API_URL`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_USER_AGENT`, `ASAAS_HEALTHCHECK`, `PAYMENTS_LIVE`, `FEATURE_PUBLIC_CHECKOUT`

Chave de produção Asaas na Vercel: **não inspecionada / não impressa**. Código espera `ASAAS_API_KEY` (não outros aliases). Confirmar no painel se o nome cadastrado coincide; se for outro nome, mapear ou renomear na Vercel **sem** colar o valor no repositório.

## 5. Pendências de infraestrutura

1. `https://api.verasjuris.com/health` → **404 `DEPLOYMENT_NOT_FOUND`** (Vercel sem deployment API válido).
2. Postgres local `127.0.0.1:5432` → **down** nesta sessão.
3. Postgres de produção / migrations → **não verificados / não aplicados** (sem autorização).
4. Webhook público Asaas → exige API deployada + `ASAAS_WEBHOOK_TOKEN` alinhado ao cadastro Asaas.
5. Comunicação Web→API→Worker → bloqueada enquanto API/worker não estiverem live (`docs/PRODUCTION_STABILITY_AUDIT.md`).

## 6. Status conectividade do banco

| Ambiente | Status |
| --- | --- |
| Local | ECONNREFUSED / down |
| Produção | Não testado (sem migrate/credenciais nesta etapa) |

## 7. Status do webhook

| Item | Status |
| --- | --- |
| Receptor código `POST /v1/webhooks/payments/asaas` | Pronto no código |
| Validação `asaas-access-token` | Pronto |
| Idempotência `payment_webhook_events` | Pronto (+ `externalEventId`) |
| Endpoint público alcançável | **Bloqueado** (API `DEPLOYMENT_NOT_FOUND`) |
| Cadastro webhook na conta Asaas | Pendente (operacional) |

## 8. Bloqueios para ativação de pagamentos reais

1. Deploy válido da API (`dist/vercel.cjs`) + `/health` 200.
2. Migrate + seed de referência em produção (autorização explícita).
3. `ASAAS_ENVIRONMENT=production` + `PAYMENTS_LIVE=1` + `PAYMENT_PROVIDER=asaas` + webhook token.
4. Homologação sandbox completa (Pix, boleto, cartão fatura, estorno, cancelamento, webhook duplicado).
5. `FEATURE_PUBLIC_CHECKOUT` permanece `0` até autorização.
6. Nenhuma cobrança real nesta entrega.

## Fundamentação BLOCKED

Evidência: health da API de produção ainda `DEPLOYMENT_NOT_FOUND`; Postgres local down; migrate/produção e sandbox live não executados; `PAYMENTS_LIVE`/`FEATURE_PUBLIC_CHECKOUT` em `0`. O código do adapter e os testes unitários/integração com fake PSP estão verdes, mas o sistema financeiro **não** está apto a cobrar em produção.
