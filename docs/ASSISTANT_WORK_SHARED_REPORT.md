# Assistente real + Work compartilhado — Relatório

**Branch:** `fix/assistant-work-shared-nucleus`  
**Data:** 2026-11-17  
**Merge/deploy:** **não** automático

## 1. Vercel — o que existe de fato

Inspeção no repositório (sem acesso à conta Vercel via MCP nesta sessão):

| Item | Situação |
|---|---|
| Projetos web/api/worker (`vercel.json`) | Presentes |
| `crons` em `vercel.json` | **Ausente** (exemplo só em `docs/PRODUCTION_DEPLOY.md`) |
| `@vercel/workflow` / Durable Functions | **Ausente** |
| Worker HTTP `POST /internal/jobs/run` | Presente (`apps/worker/src/vercel.ts`) |
| Fila contínua serverless | **Não suportada** — apenas invoke pontual |
| Workflows de produto (`/app/control/automacoes`) | Domínio interno distinto; **não** é Vercel Workflow nem Work do ChatGPT |

**Decisão:** não inventar Vercel Workflow. Continuação Work usa **PostgreSQL (status das etapas) + job `juris_work.continue`** no worker, invocável por cron/HTTP com `WORKER_INVOKE_SECRET`.

## 2. Assistente VerasJuris

| Antes | Depois |
|---|---|
| FAB apontava para `/api/v1/assistant/messages` (inexistente) → FAQ silencioso | FAB usa `/organizations/:orgId/assistant/*` com CSRF + cookies |
| Tools list* retornavam `items: []` stub | Consultas reais (RBAC) em casos, docs, prazos, tarefas, CRM |
| FAQ como se fosse IA | FAQ só como **conhecimento complementar** no prompt |
| Sem Work no chat | Tools `createWorkTask` / `getWorkTask` no núcleo juris-work |
| Streaming | **not_compatible** — `OpenAIProvider` sem `streamText`; UI mostra indicador de processamento |

## 3. Work compartilhado

- Mesmo executor (`juris-work/executor` + `service`) para **Assistente** e **Juris One**.
- Capacidades internas: plano multi-etapa, metadados documentais, relatórios/minutas assistidas, checklist/timeline.
- `prepareCommunicationDraft`: rascunho apenas; envio Resend = `NOT_CONFIGURED`.
- Externos (protocolo/pagamento/exclusão/envio): bloqueados.
- Retomada: job worker `juris_work.continue` (checkpoint = linhas `juris_work_steps`).
- Agendamento recorrente: **não homologado** (sem cron commitado).

## 4. Segurança

RBAC por ferramenta, isolamento org, auditoria Work existente, créditos, aprovação humana, sem execução de instruções embutidas em documentos como comandos (prompt + metadados-only).

## 5. Variáveis

```env
FEATURE_AI=1
AI_PROVIDER=openai
OPENAI_API_KEY=
# Worker (opcional para continue)
WORKER_INVOKE_SECRET=
# FEATURE_LOCAL_QUEUE / LOCAL_QUEUE só se fila local for desejada
```

## 6. Verificações (2026-11-17)

| Check | Resultado |
|---|---|
| `pnpm lint` | OK — 0 errors |
| `pnpm typecheck` | OK |
| `pnpm test` | OK — 819 passed / 1 skipped |
| `pnpm build` | OK (web/api/worker) |
| OpenAI live | NOT_HOMOLOGATED neste workspace (sem chave) |
| Streaming HTTP | NOT_COMPATIBLE (`OpenAIProvider` sem `streamText`) |
| Vercel Workflow | NÃO IDENTIFICADO — reuso de worker HTTP invoke |
