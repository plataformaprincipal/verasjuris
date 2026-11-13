# Deploy de produção (Vercel)

Três projetos Vercel, cada um com **Root Directory** distinto. Segredos só em variáveis de servidor — **nunca** em `NEXT_PUBLIC_*`.

## Projetos

| Projeto | Root Directory | Build | Start / Output |
| --- | --- | --- | --- |
| **web** | `apps/web` | `pnpm --filter @verasjuris/web build` | Next managed (`apps/web/vercel.json`) |
| **api** | `apps/api` | `pnpm --filter @verasjuris/api build` → `dist/vercel.cjs` | `vercel.json` → `@vercel/node` |
| **worker** | `apps/worker` | `pnpm --filter @verasjuris/worker build` → `dist/vercel.cjs` | `vercel.json` → `@vercel/node` |

Os `vercel.json` de api/worker/web já definem `installCommand`/`buildCommand` a partir da raiz do monorepo (`pnpm install --frozen-lockfile`).

Arquivos de roteamento:

- `apps/api/vercel.json` — todas as rotas → `dist/vercel.cjs` (CJS para compatibilidade `@vercel/node`)
- `apps/worker/vercel.json` — idem
- `apps/web/vercel.json` — framework Next.js

O entry `src/main.ts` continua para Node longo (`pnpm start` / containers). Serverless usa `src/vercel.ts` (API via `app.inject`; worker com rotas `/health` e `/internal/jobs/run`).

O BFF Next em `/api/v1/[...path]` encaminha **GET/HEAD/POST/PUT/PATCH/DELETE/OPTIONS** para a API (necessário para preferências de acessibilidade, i18n e vários módulos).

## Variáveis por app

### Web (`apps/web`)

| Var | Obrigatória | Notas |
| --- | --- | --- |
| `API_INTERNAL_URL` | sim | URL interna da API (SSR/BFF). **Não** usar `NEXT_PUBLIC_API_URL` no servidor. |
| `NEXT_PUBLIC_API_URL` | não | Só se o browser precisar chamar a API direto; preferir proxy `/api/v1`. Sem segredos. |
| `DATABASE_URL` | não | Web não fala com o banco diretamente neste desenho. |

### API (`apps/api`)

| Var | Obrigatória | Notas |
| --- | --- | --- |
| `DATABASE_URL` | sim | Postgres (pode ser pooler). |
| `WEB_ORIGIN` | sim | Origem CORS do front (ex. `https://app.exemplo.com`). |
| `NODE_ENV` | sim | `production` |
| `EMAIL_PROVIDER` | não | `not_configured` (padrão) ou `resend`. `memory` é **proibido** em produção. |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | se resend | Sem chave → provider permanece `not_configured`. |
| `STORAGE_PROVIDER` | não | `not_configured` ou `supabase` (não use `local` em prod). |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE_BUCKET` | se supabase | Bucket **privado**. Service role só no servidor. Default bucket `VERASJURIS`. |
| `AI_PROVIDER` | não | `not_configured` ou `openai`. |
| `FEATURE_AI` | não | Deve ser `1` para habilitar IA. Sem isso, OpenAI **não** é registrado. |
| `OPENAI_API_KEY` / `OPENAI_DEFAULT_MODEL` / `OPENAI_HEALTHCHECK` | se openai | Health de rede só com `OPENAI_HEALTHCHECK=1`. |
| `DOCUMENT_DOWNLOAD_TOKEN_SECRET` | recomendado | ≥ 16 chars. |
| `PAYMENT_PROVIDER` | não | `not_configured` (padrão) ou `asaas`. |
| `BILLING_PROVIDER` | não | `not_configured` ou `asaas`. |
| `ASAAS_API_KEY` / `ASAAS_ENVIRONMENT` / `ASAAS_WEBHOOK_TOKEN` | se asaas | Ver `docs/ASAAS.md`. Sandbox padrão. |
| `ASAAS_API_URL` / `ASAAS_USER_AGENT` / `ASAAS_HEALTHCHECK` | opcional | URL override; UA default `VerasJuris`. |
| `PAYMENTS_LIVE` | produção asaas | Deve ser `1` para `ASAAS_ENVIRONMENT=production`. |
| `FEATURE_PUBLIC_CHECKOUT` | não | Manter `0` até homologação. |

### Worker (`apps/worker`)

| Var | Obrigatória | Notas |
| --- | --- | --- |
| `DATABASE_URL` | sim | Mesmo cluster da API. |
| `WORKER_INVOKE_SECRET` | sim no Vercel | Header `x-worker-invoke-secret` (comparação constant-time). |
| `FEATURE_LOCAL_QUEUE` / `LOCAL_QUEUE` | opcional | `1` / `enabled` para enqueue+processNext no mesmo processo (cron one-shot). |

## Migrações

1. Defina `DATABASE_URL` (runtime/pooler) e, se necessário, `DIRECT_URL` (conexão direta para DDL).
2. `pnpm db:migrate` usa `DIRECT_URL` quando presente; caso contrário `DATABASE_URL`.
3. Aplicar em produção **somente com aprovação explícita** e backup/ponto de recuperação.
4. Após migrate, a API exige papéis de referência (`assertReferenceData` / seed de permissões).
5. Não rode migrate destrutivo nem reset de schema.

## Limitações do worker no Vercel

- **Não há consumidor contínuo de fila.** Serverless não mantém polling.
- Cron ou HTTP autenticado chama `POST /internal/jobs/run` com `{ "type": "...", "payload": { ... } }`.
- Com `LocalInProcessQueueProvider`: enqueue + `processNext` uma vez.
- Sem fila local: executa o handler registrado **uma vez** e encerra.
- `GET /health` permanece disponível.

Exemplo de cron Vercel (projeto worker):

```json
{
  "crons": [{ "path": "/internal/jobs/run", "schedule": "0 * * * *" }]
}
```

O body/auth do cron precisa ser configurado (header `x-worker-invoke-secret`). Ajuste conforme o mecanismo de cron da conta.

## Honestidade de status dos providers

| Provider | Sem credencial / flag | Com credencial |
| --- | --- | --- |
| Email | `not_configured` | Resend → `configured` (envio real) |
| AI | `not_configured` / `FEATURE_AI≠1` | OpenAI registrado; health sem rede por padrão |
| Storage | `NOT_CONFIGURED` | Supabase privado; URLs só assinadas/temporárias |
| OCR / leilões / fontes legais | `not_configured` | Ainda sem adapter real |

A UI e `/health` não devem fingir “conectado” sem credencial. Falhas externas mapeiam para erros tipados (`NOT_CONFIGURED`, `EXTERNAL_SERVICE_ERROR`, `AI_PROVIDER_*`) sem vazar chaves.

## Checklist rápido

1. Três projetos Vercel com Root Directory corretos.
2. Env por app (tabelas acima); zero segredos em `NEXT_PUBLIC_*`.
3. Migrações aplicadas via `DATABASE_URL` / `DIRECT_URL`.
4. `EMAIL_PROVIDER=resend` + from verificado no Resend (ou deixe `not_configured`).
5. `STORAGE_PROVIDER=supabase` com bucket privado.
6. IA só com `FEATURE_AI=1` + `AI_PROVIDER=openai` + chave.
7. Worker: `WORKER_INVOKE_SECRET` + crons pontuais — sem esperar fila 24/7.
