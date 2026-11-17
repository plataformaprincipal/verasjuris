# Consolidação Resend + OpenAI + Asaas — Relatório

**Branch:** `fix/integrations-resend-openai-asaas`  
**Data:** 2026-11-16  
**Produção / merge:** **não** — aguarda homologação live com evidência  
**Pagamentos reais:** **não** — `PAYMENTS_LIVE` permanece desligado; alvo Asaas = sandbox

## 1. Escopo consolidado

| Branch origem | Conteúdo | Merge |
|---|---|---|
| `fix/resend-email-homologation` | Outbox, webhooks Svix, auth e-mails, CI Biome | Sim |
| `fix/ai-juris-one-real-integration` | Juris One público/auth via AIGateway, sem FAQ silencioso | Sim |
| `fix/marketplace-checkout-asaas` | Checkout idempotente, Pix/boleto UI, webhook valor | Sim |

CI Biome (23 erros) commitado em `fix/resend-email-homologation` (`3e8f63d`) e incluído nesta branch.

## 2. Migrations (sem perda de dados)

| Nº | Tag | Conteúdo |
|---|---|---|
| 0027 | `0027_email_delivery_tracking` | `email_dispatches`, `email_provider_events` |
| 0028 | `0028_marketplace_checkout_attempts` | `marketplace_checkout_attempts` (+ items) |

Conflito de número `0027` resolvido **renomeando** a migration de checkout para `0028` (SQL e journal). Ambas as tabelas são criadas com `IF NOT EXISTS` / `DO $$ … EXCEPTION WHEN duplicate_object`. Nenhuma migration destrutiva.

Se algum ambiente já aplicou a antiga `0027_marketplace_checkout_attempts` **antes** desta consolidação:

1. Não reaplicar o SQL antigo sob o novo nome sem checar `__drizzle_migrations`.
2. Preferir: registrar manualmente `0028_marketplace_checkout_attempts` como aplicada se as tabelas já existem, e aplicar só `0027_email_delivery_tracking` (ou o inverso, conforme o que já rodou).
3. Em ambientes limpos / ainda sem `0027` de marketplace: aplicar `0027` e `0028` em ordem.

## 3. Homologação por provedor

### Resend — `NOT_HOMOLOGATED` (live)

| Fluxo | Código | Testes automatizados | Live |
|---|---|---|---|
| Cadastro + verificação | Sim | identity / onboarding / email-resend | Sem `RESEND_API_KEY` neste workspace |
| Esqueci minha senha | Sim | email-resend | Idem |
| Password changed | Sim | unit/integration | Idem |
| Notificações (pagamento confirmado, convites) | Parcial | existentes | Idem |
| Webhook Svix `/v1/webhooks/email/resend` | Sim | email-resend (401/403 sem secret) | Sem `RESEND_WEBHOOK_SECRET` |

**Evidência local:** `.env` não contém `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET` nem `EMAIL_PROVIDER=resend`.  
**Não inventado envio.** Classificação: `NOT_HOMOLOGATED`.

Relatório detalhado: `docs/RESEND_EMAIL_INTEGRATION_REPORT.md`.

### OpenAI / Juris One — `NOT_HOMOLOGATED` (live)

| Fluxo | Código | Testes | Live |
|---|---|---|---|
| Público `GET/POST /v1/juris-one/public/*` | Sim | juris-one-public | Sem `OPENAI_API_KEY` / `AI_PROVIDER=openai` no runtime |
| Autenticado (assistant) | Sim — erro honesto se off | assistant | Idem |
| Limites consumo público | 5/dia, rate/min, max tokens | unit | — |
| FAQ silencioso | Removido | unit | — |

`.env` local tem `FEATURE_AI` (1 char) mas **não** `OPENAI_API_KEY`.  
Probe: `scripts/openai-connectivity-probe.mjs` (requer chave).  
Relatório: `docs/AI_INTEGRATION_REPORT.md`.

### Asaas — `NOT_HOMOLOGATED` (sandbox live); código sandbox-ready

| Fluxo | Código | Testes | Live sandbox |
|---|---|---|---|
| Carrinho → checkout idempotente | Sim | marketplace-cart-checkout | Sem `ASAAS_API_KEY` |
| Pix / boleto UI | Sim | — | Idem |
| Webhook + idempotência + amount mismatch | Sim | payments / asaas integration existentes | Sem token |
| Produção / `PAYMENTS_LIVE` | **Não ativado** | — | Proibido neste PR |

Relatório: `docs/MARKETPLACE_CHECKOUT_ASAAS_REPORT.md` (migration atualizada para `0028`).

## 4. Variáveis necessárias (staging — não commitadas)

```env
# Resend
EMAIL_PROVIDER=resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_WEBHOOK_SECRET=

# OpenAI
FEATURE_AI=1
AI_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_DEFAULT_MODEL=gpt-4o-mini

# Asaas sandbox only
ASAAS_API_KEY=
ASAAS_BASE_URL=https://sandbox.asaas.com/api/v3
ASAAS_WEBHOOK_TOKEN=
ASAAS_ENV=sandbox
PAYMENTS_LIVE=0
```

Nenhuma credencial foi impressa, commitada ou exposta neste relatório.

## 5. Verificações (execução nesta branch — 2026-11-16)

| Check | Resultado |
|---|---|
| `pnpm lint` | OK — 0 errors (warnings pré-existentes de `noNonNullAssertion` etc.) |
| `pnpm typecheck` | OK — todos os packages |
| `pnpm test` | OK — 814 passed, 1 skipped (151 files) |
| `pnpm build` | OK — web + api + worker + `test:artifacts` |
| Segurança | Sem credenciais live no diff; `PAYMENTS_LIVE=0` no `.env.example`; único `password:` literal é fixture de teste (`Veras@Local13`) |

## 6. Pendências explícitas

1. Configurar secrets em staging (Resend, OpenAI, Asaas sandbox) sem produção.
2. Rodar migrations `0027` + `0028` com plano de journal se houver `0027` antigo de checkout.
3. Homologar Resend com destinatário autorizado + evento `email.delivered`.
4. Homologar Juris One público/auth com resposta real e falha honesta sem chave.
5. Homologar Asaas sandbox: Pix, boleto, webhook duplicado, idempotência de checkout.
6. Só então avaliar merge / deploy — **fora deste PR automático**.

## 7. Critério de não-mentira

- Sem simular entrega de e-mail, chat IA ou pagamento como “homologado” sem evidência.
- Sem merge/deploy de produção nesta missão.
- Sem `PAYMENTS_LIVE=1`.
