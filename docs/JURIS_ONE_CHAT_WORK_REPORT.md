# Juris One — Chat CSRF + Agente Work

**Branch:** `fix/juris-one-chat-work-agent`  
**Data:** 2026-11-16  
**Merge/deploy produção:** **não** neste PR

## 1. Chat OpenAI — CSRF / proxy

| Item | Situação |
|---|---|
| Bug | `POST /api/v1/juris-one/public/chat` omitia `x-verasjuris-request: 1` → `AUTHORIZATION_ERROR` no Fastify |
| Correção | `apps/web/src/lib/juris-one-public-api.ts` envia `[CSRF_HEADER]: "1"` |
| Proxy BFF | `apps/web/src/app/api/v1/[...path]/route.ts` continua só repassando headers (não injeta CSRF) |
| Guards | Intactos: mutações exigem header `"1"`; Origin/Referer validados; webhooks isentos |
| Teste | `juris-one-public-http.test.ts` — sem header → 403; com header → 201 |

## 2. Agente Work

| Capacidade | Comportamento |
|---|---|
| Planejar | `planWorkSteps` — IA quando gateway ok; senão plano local honesto |
| Executar internos | `executeInternalWorkStep` via `AIGateway` feature `juris_one.work` |
| Documentos | Metadados org se `document.read`; sem OCR automático; não inventa arquivos |
| Relatórios / minutas | Texto assistivo + `humanReviewRequired: true` |
| Externos | `protocol_*`, pagamento, e-mail, exclusão → `NOT_CONFIGURED` mesmo com approve |
| Sem simulação | Removido `simulated_internal`; execução exige IA configurada |

Arquivos: `apps/api/src/modules/juris-work/{executor,service,routes}.ts`, UI `apps/web/src/app/app/juris-one/work/page.tsx`.

## 3. Interface pública Work

Botão desabilitado substituído por link:
- autenticado → `/app/juris-one/work`
- anônimo → `/entrar?redirect=%2Fapp%2Fjuris-one%2Fwork`  
Layout `/app` já redireciona anônimos para `/entrar`.

## 4. Segurança

- RBAC: `ai.use` (Work); `document.read` opcional para metadados
- Isolamento org no path + authorize (404 sem membership)
- Créditos: reserva / consumo / cancelamento (ledger existente)
- Auditoria: `juris_work.task_*` / `step_*`
- Persistência: `juris_work_tasks` / `juris_work_steps`
- Aprovação humana: tarefa + passos sensíveis; externos nunca auto-executam

## 5. Homologação live

Neste workspace **sem** `OPENAI_API_KEY`: chat/Work **código + testes OK**; live OpenAI **NOT_HOMOLOGATED**.

## 6. Verificações (2026-11-16)

| Check | Resultado |
|---|---|
| `pnpm lint` | OK — 0 errors |
| `pnpm typecheck` | OK |
| `pnpm test` | OK — 818 passed / 1 skipped |
| `pnpm build` | OK (web/api/worker) |
| Live OpenAI | NOT_HOMOLOGATED neste workspace (sem chave) |
