# Auditoria técnica — estabilização de produção

Data: 2026-11-11  
Branch: `reform/platform-maturity-a11y-i18n-auth` (inclui hardening prévio `7c9b183`)

Escopo: três projetos Vercel (web/api/worker), adapters, env, PostgreSQL/migrations, auth/BFF, builds locais.  
**Não** foram aplicadas migrations de produção, **não** houve alteração de credenciais, **não** houve deploy.

## Evidências de ambiente

| Checagem | Resultado |
| --- | --- |
| `https://api.verasjuris.com/health` | **404** `DEPLOYMENT_NOT_FOUND` (Vercel) |
| `https://www.verasjuris.com/` | **200** (site público responde) |
| `https://verasjuris.com/` | **308** redirect |
| `https://app.verasjuris.com` / `worker.verasjuris.com` | DNS timeout neste ambiente |
| Postgres local `127.0.0.1:5432` | **ECONNREFUSED** (docker/postgres parado) |
| Migrations em produção | **Não aplicadas nesta etapa** (conforme restrição) |

## Correções aplicadas nesta auditoria

| Defeito | Severidade | Correção | Arquivos |
| --- | --- | --- | --- |
| BFF `/api/v1` sem `PUT` (quebra a11y, i18n, perfis, CRM, etc.) | HIGH | Exportar GET/HEAD/POST/PUT/PATCH/DELETE/OPTIONS + 503 tipado | `apps/web/src/app/api/v1/[...path]/route.ts` |
| Handler API Vercel via `server.emit("request")` frágil | HIGH | Bootstrap com Fastify `inject` + 503 de boot | `apps/api/src/vercel.ts` |
| Artifact ESM `dist/vercel.js` pouco previsível no `@vercel/node` | HIGH | Build CJS `dist/vercel.cjs` + `vercel.json` atualizado | `apps/api/tsup.config.ts`, `apps/worker/tsup.config.ts`, `vercel.json` |
| Ausência de `apps/web/vercel.json` / install monorepo | MEDIUM | `installCommand`/`buildCommand` na raiz pnpm | `apps/web/vercel.json`, api/worker `vercel.json` |
| Docs desalinhados com artifact CJS | LOW | Atualização | `docs/PRODUCTION_DEPLOY.md` |

## Gates locais (pós-correção)

| Gate | Resultado |
| --- | --- |
| typecheck (workspace) | OK |
| test | **120 files / 610 tests PASS** |
| build web | OK |
| build api (`main.js` + `vercel.cjs`) | OK |
| build worker (`main.js` + `vercel.cjs`) | OK |
| lint (erros format) | limpos nos arquivos tocados; warnings históricos de `noNonNullAssertion` permanecem |

## Pendências classificadas

### BLOCKER
1. **API Vercel sem deployment** (`DEPLOYMENT_NOT_FOUND` em `api.verasjuris.com`) — web/BFF não tem backend de produção.
2. **Migrations de produção não homologadas/aplicadas** — API exige `assertReferenceData` no boot; sem migrate+seed de papéis a API não sobe.
3. **Postgres de produção não verificado nesta sessão** — conectividade/migrations pendentes de autorização.

### HIGH
1. **Worker sem consumidor contínuo** no Vercel — apenas cron/HTTP com `WORKER_INVOKE_SECRET`; jobs assíncronos não processam 24/7 sem cron.
2. **`API_INTERNAL_URL` / `WEB_ORIGIN` / providers** precisam estar corretos no painel Vercel após o redeploy (não auditáveis sem acesso às envs remotas).
3. **Email/Storage/AI** em `not_configured` até credenciais — fluxos de verificação/reset/upload/IA ficam degradados (comportamento esperado, não simulado).

### MEDIUM
1. Cookie de sessão `SameSite=lax` via BFF é adequado same-site; cenários cross-site puro exigem revisão.
2. Cold start serverless + `assertReferenceData` pode gerar 503 até o pool/DB responder.
3. Domínios `app.` / `worker.` não resolvidos neste ambiente — confirmar DNS/projetos Vercel.

### LOW
1. Warnings Biome legados (`noNonNullAssertion` em testes/API).
2. Homepage/i18n maturity (trabalho paralelo) não bloqueia API deploy, mas UX ainda parcial.

## Riscos residuais

- Redeploy da API com artifact antigo (`vercel.js` ESM) falharia — usar **`dist/vercel.cjs`** e `vercel.json` desta branch.
- Aplicar migrate em produção **somente com autorização** + backup; usar `DIRECT_URL` se houver pooler.
- Não commitar `.env`; manter segredos fora de `NEXT_PUBLIC_*`.

## Procedimento sugerido (sem executar agora)

1. Merge/revisão desta branch + hardening.
2. Configurar 3 projetos Vercel (Root Directory + envs conforme `docs/PRODUCTION_DEPLOY.md`).
3. Autorizar migrate produção (`DATABASE_URL`/`DIRECT_URL`) + seed de referência.
4. Deploy API → validar `/health` e `/v1/auth/session`.
5. Deploy Worker → `/health` + cron com `WORKER_INVOKE_SECRET`.
6. Deploy Web → `API_INTERNAL_URL` apontando à API; smoke login/cadastro via BFF PUT/POST.
