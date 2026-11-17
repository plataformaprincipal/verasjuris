# Integração Resend — Relatório

**Branch:** `fix/resend-email-homologation`  
**Data:** 2026-11-16  
**Homologação live:** `NOT_HOMOLOGATED` (sem evidência de envio real neste ambiente; `RESEND_API_KEY` / `EMAIL_PROVIDER` não disponíveis no runtime local do agente)

## Tabela de módulos

| Módulo | Situação inicial | Correção | Teste | Situação final |
|---|---|---|---|---|
| Provedor Resend | FUNCTIONAL (código) / NOT_CONFIGURED (default) | messageId, timeout, retry, statuses | unit + integração | FUNCTIONAL (código); ops depende de env |
| Cadastro | PARTIAL (não enviava verificação) | dispara verificação + `emailDelivery` honesto | identity/onboarding | FUNCTIONAL (c/ Memory); live NOT_HOMOLOGATED |
| Recuperação de senha | FUNCTIONAL código; status público errado | `publicProviderDeliveryStatus` + aviso pós-reset | email-resend | FUNCTIONAL (c/ Memory); live NOT_HOMOLOGATED |
| Convites | FUNCTIONAL código | outbox idempotente | identity (existente) | FUNCTIONAL (código) |
| CRM / prazos / docs | NOT_IMPLEMENTED | — | — | NOT_IMPLEMENTED (templates prontos) |
| Marketplace | NOT_IMPLEMENTED | e-mail pós-pagamento confirmado (idempotente) | — | PARTIAL |
| Asaas | N/A e-mail | notificação só após confirmação financeira | — | PARTIAL |
| Juris One | NOT_IMPLEMENTED | — | — | NOT_IMPLEMENTED |
| Webhooks Resend | NOT_IMPLEMENTED | `/v1/webhooks/email/resend` + Svix | email-resend | FUNCTIONAL (código); secret ops |
| Central de notificações | in-app only | despachos `email_dispatches` + admin stats | — | PARTIAL |

## Arquivos principais

- `packages/email/*` — provider, templates, `createEmailProviderFromEnv`, verificação Svix
- `packages/database` — migration `0027_email_delivery_tracking`
- `apps/api/src/modules/email/*` — dispatch, webhook, rotas admin
- `apps/api/src/modules/auth/*` — verify/reset/security
- `apps/api/src/modules/organizations/invitations.ts`
- `apps/api/src/modules/finance/payment-service.ts`
- `docs/RESEND_EMAIL_INTEGRATION_REPORT.md`

## Endpoints

- Preservados: `/auth/register`, `/auth/email-verification/*`, `/auth/password-reset/*`, convites
- Novos: `POST /v1/webhooks/email/resend`, `GET /v1/admin/email/stats`, `GET /v1/admin/email/dispatches/:id`

## Variáveis

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=<segredo>
RESEND_FROM_EMAIL=<remetente>
RESEND_WEBHOOK_SECRET=whsec_...   # novo; ausente = webhook NOT_CONFIGURED
```

Não sobrescritas neste PR.

## Testes

```text
packages/email vitest: 6 passed
apps/api: email-resend + identity + onboarding-register: 17 passed
tsc @verasjuris/api: ok
```

## Evidências de envio real

**Ausentes neste ambiente.** Classificação: `NOT_HOMOLOGATED`.

Para homologar em staging: `EMAIL_PROVIDER=resend` + chave + from + webhook secret; enviar recuperação para destinatário autorizado; confirmar `providerMessageId` e evento `email.delivered`.

## Limitações

- Omnichannel `@verasjuris/ai` EmailChannel ainda separado (NOT_CONFIGURED por padrão)
- CRM/prazos/documentos/Juris One: templates existem; disparos de produto não ligados
- Recebimento de e-mail (inbound) não habilitado
- Planos/limites comerciais Resend: não inventados; rate limit local em auth (5/15min)

## Riscos

- Sem `RESEND_WEBHOOK_SECRET`, entrega fica em `sent_to_provider` sem `delivered`
- Conteúdo sensível: e-mails usam links autenticados, sem documentos anexos
