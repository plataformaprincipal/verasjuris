# Relatório — Desbloqueio urgente de produção

Data: 2026-11-11  
Branch de trabalho: `feature/payments-asaas-production`  
Classificação: **BLOCKED** (falha de roteamento Vercel na API; sem evidência de app Fastify respondendo)

Nenhuma migration, deploy, cobrança ou alteração irreversível foi executada.

---

## Fase 1 — Diagnóstico do deployment

### Evidência HTTP (`https://api.verasjuris.com/health`)

| Campo | Valor |
| --- | --- |
| Status | **404** |
| `server` | `Vercel` |
| `x-vercel-error` | **`DEPLOYMENT_NOT_FOUND`** |
| `x-vercel-id` | `gru1::…` (edge BR) |
| Body | `The deployment could not be found on Vercel.` |

**Interpretação:** falha de **roteamento/plataforma Vercel**, não da aplicação Fastify.  
Se a app estivesse up e quebrasse no boot (ex.: Postgres), o handler atual devolveria **503 JSON** (`SERVICE_UNAVAILABLE`), não este 404 tipado pela edge.

`https://api.verasjuris.com/` → mesmo `DEPLOYMENT_NOT_FOUND`.

### DNS / domínio

| Host | DNS | HTTP |
| --- | --- | --- |
| `www.verasjuris.com` | CNAME → `aa1598aca9f847fc.vercel-dns-016.com` | **200** |
| `api.verasjuris.com` | CNAME → `578604d3b72e1453.vercel-dns-016.com` | **404 DEPLOYMENT_NOT_FOUND** |
| `worker.verasjuris.com` | **NXDOMAIN** | — |
| `app.verasjuris.com` | **NXDOMAIN** | — |

`api` e `www` apontam para **hashes Vercel-DNS diferentes** → projetos Vercel distintos. O domínio da API está associado a um projeto **sem deployment de produção válido** (ou deployment removido / nunca publicado com sucesso).

### Commits / branches

| Ref | Commit | Observação |
| --- | --- | --- |
| `origin/main` | `6a1b967` (2026-10-30) | **Sem** `apps/api/vercel.json`, **sem** `apps/api/src/vercel.ts`; tsup só `main.ts` ESM |
| `origin/fix/production-hardening-compilation` | `7c9b183` | Introduz `vercel.ts` + `vercel.json` apontando a **`dist/vercel.js` (ESM)** |
| HEAD local `feature/payments-asaas-production` | `7c9b183` + **~55 arquivos não commitados** | Working tree: `dist/vercel.cjs` + `inject` + Asaas/a11y/i18n |

**Conclusão:** produção web pode estar em `main` (ou outro deploy). A API **não** tem deployment alcançável. O hardening CJS/`inject` e Asaas ainda **não** estão em commit único implantável em `main`.

### Root Directory / `vercel.json` (código)

Configuração **esperada** (working tree):

- Root Directory do projeto API: **`apps/api`**
- `installCommand`: `cd ../.. && pnpm install --frozen-lockfile`
- `buildCommand`: `cd ../.. && pnpm --filter @verasjuris/api build`
- Artifact: **`dist/vercel.cjs`** (`@vercel/node`)

No commit `7c9b183` (já no remote de hardening) o artifact ainda é `dist/vercel.js` ESM — menos previsível no `@vercel/node`. A correção CJS está só no working tree.

### Painel Vercel / logs

**Não auditável nesta sessão:** CLI Vercel sem credenciais (`vercel whoami` → no credentials). Sem acesso a project id, deployment list ou logs de build.

### Cascata Web → API

`https://www.verasjuris.com/api/v1/health` e `/api/v1/auth/session` → **HTTP 500** (BFF Next).  
O BFF faz proxy para `API_INTERNAL_URL` + `/v1/...`. Com API em `DEPLOYMENT_NOT_FOUND`, o front autenticado/financeiro fica inutilizável mesmo com site 200.

---

## Fase 2 — PostgreSQL

| Checagem | Resultado |
| --- | --- |
| `.env` local `DATABASE_URL` | **SET**, host **`127.0.0.1:5432`** (dev) |
| Postgres local | **down** (`nc` recusou) |
| `DIRECT_URL` local | **MISSING** |
| Postgres **remoto** (Vercel) | **Não verificado** — credenciais remotas não estão no `.env` local; sem token Vercel para ler envs do projeto |
| Migrations no repo | **21** entradas no journal (`0000` … `0020_etapa26_33_platform_hardening`) |
| Aplicação remota | **Desconhecida** (requer `SELECT` em `__drizzle_migrations` no host de produção) |
| Backup / restore | **Não verificado** (requer painel do provedor: Supabase/Neon/etc.) |

**Preparação (sem executar):**

1. Confirmar no projeto API Vercel: `DATABASE_URL` (pooler ok para runtime) + `DIRECT_URL` (direto para DDL).
2. Backup/snapshot antes de qualquer `pnpm db:migrate`.
3. Migrate com `DIRECT_URL` → depois `pnpm db:seed` (papéis; `assertReferenceData` no boot da API).
4. Só com **autorização explícita**.

Não confundir: local down ≠ remoto indisponível.

---

## Fase 3 — Asaas

### Variáveis que o código usa (nomes)

`PAYMENT_PROVIDER`, `BILLING_PROVIDER`, `ASAAS_API_KEY`, `ASAAS_ENVIRONMENT`, `ASAAS_API_URL`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_USER_AGENT`, `ASAAS_HEALTHCHECK`, `PAYMENTS_LIVE`, `FEATURE_PUBLIC_CHECKOUT`

### Estado local

Todas as vars Asaas / payments: **MISSING** no `.env` local (esperado para não vazar prod).

### Estado Vercel

Usuário indica chave de produção cadastrada — **nome efetivo no painel não confirmável** daqui. Se o nome não for exatamente `ASAAS_API_KEY`, o factory permanece `not_configured`.

### Gates de segurança (manter)

- `PAYMENTS_LIVE=0`
- `FEATURE_PUBLIC_CHECKOUT=0`
- Homologação: `PAYMENT_PROVIDER=asaas` + `ASAAS_ENVIRONMENT=sandbox` (+ chave sandbox)

### Webhook

| Item | Valor |
| --- | --- |
| Rota pública exata | `POST https://api.verasjuris.com/v1/webhooks/payments/asaas` |
| Auth | Header `asaas-access-token` = `ASAAS_WEBHOOK_TOKEN` |
| Idempotência | `payment_webhook_events` + `externalEventId` |
| Status operacional | **Bloqueado** — API sem deployment |

### Sandbox / teste real

- Unit/integration locais: já verdes na entrega anterior (mocks).
- Sandbox HTTP real: **não executado** (API pública down + sem chave sandbox neste ambiente).
- Teste real controlado: **proibido** até API up + `PAYMENTS_LIVE` autorizado.

---

## Fase 4 — Síntese objetiva

| Pergunta | Resposta com evidência |
| --- | --- |
| URL real da API | Pretendida: `https://api.verasjuris.com` — **não operacional** |
| Commit/branch implantados (API) | **Indeterminado** (sem CLI); domínio sem deployment; `main` sequer tem entry serverless |
| Status do domínio API | DNS Vercel OK; **sem deployment** associado |
| Health check | **404 `DEPLOYMENT_NOT_FOUND`** (edge), não 503 de app |
| PostgreSQL | Local down; remoto **não auditado** |
| Migrations pendentes | Repo tem até `0020`; aplicadas em prod = **desconhecido** |
| Webhook | Código pronto; endpoint público **unreachable** |
| Bloqueios restantes | (1) Deploy API válido (2) Envs DB (3) migrate+seed autorizados (4) BFF `API_INTERNAL_URL` (5) Asaas sandbox (6) DNS worker opcional |

### Próxima ação operacional exata

1. **No painel Vercel → projeto da API** (o que possui domínio `api.verasjuris.com` / CNAME `578604d3b72e1453…`):
   - Confirmar Root Directory = `apps/api`.
   - Verificar se existe Production Deployment; se não, o domínio explica o 404.
2. **Commitar** working tree de estabilidade (`vercel.cjs` + `inject` + monorepo build) **antes** de redeploy — não publicar só `7c9b183` com `vercel.js` ESM se a correção CJS for o alvo.
3. **Redeploy** Production desse projeto (após merge/autorização da branch correta).
4. Validar: `curl -i https://api.verasjuris.com/health` → esperar **200** ou **503** de app (nunca mais `DEPLOYMENT_NOT_FOUND`).
5. Só então: validar `DATABASE_URL`/`DIRECT_URL` (nomes), backup, autorização de migrate+seed.
6. Só então: sandbox Asaas (`PAYMENTS_LIVE=0`, `FEATURE_PUBLIC_CHECKOUT=0`).

**PRODUCTION READY: não.**
