# Juris One 2.0 — Auditoria, implementação e homologação

**Data:** 2026-11-16  
**Escopo:** Chat ilimitado (uso justo), Work com 5 créditos, gateway OpenAI, ferramentas, admin, segurança financeira.  
**Regra:** sem deploy, sem migration em produção, sem alteração Asaas, sem falsa homologação.

---

## 1. Auditoria técnica (Etapa 1)

### Teste controlado de conectividade OpenAI

Probe local sem expor segredos:

| Campo | Valor |
|-------|--------|
| `FEATURE_AI` | `false` (desligado) |
| `AI_PROVIDER` | `not_configured` |
| `OPENAI_API_KEY` presente | **não** |
| Healthcheck de rede | não executado |
| Resultado | **`not_configured`** — nenhum request externo |

**Modelos disponíveis na conta:** não listáveis — provedor não configurado neste ambiente.

### Inventário

| Área | Estado | Notas | Prioridade |
|------|--------|-------|------------|
| Gateway `@verasjuris/ai` | **Existente** | `AIGateway`, `OpenAIProvider`, budgets em micros, features catalog | — |
| Feature `juris_one.chat` | **Implementado** | Registrada no gateway; assistant prefere esta feature | P0 |
| Streaming (`streamText`) | **Parcial** | API no gateway; `OpenAIProvider` **sem** `streamText`; sem SSE HTTP | P1 |
| Chat autenticado (assistant) | **Existente + reforçado** | Conversas/mensagens persistidas; rename/archive/favorite/delete; rate limit; FAQ se not_configured | P0 |
| Chat público `/juris-one` | **Existente** | FAQ local, limite 5 turns guest — **não** é OpenAI | — |
| Hub autenticado `/app/juris-one` | **Implementado** | Sidebar, histórico, créditos, status IA, prefs locais | P0 |
| Work tasks/steps | **Existente** | Plano local, aprovação humana, bloqueio de ações externas | — |
| Ledger 5 créditos Work | **Implementado** | Migration `0025`, reserva atômica, grant idempotente | P0 |
| Filas/workers distribuídos | **Ausente / local** | Jobs AI `local_in_process`; Work ainda request-driven | P1 |
| Orçamentos AI (`ai_budgets`/`ai_usage`) | **Existente** | Tetos por org; restantes micros no status | — |
| OCR / documentos IA | **Existente (parcial)** | Providers + `/app/ia`; depende de FEATURE_AI/OCR | P1 |
| Admin IA `/app/ia` | **Existente** | Status, models, prompts, usage, jobs, budgets | — |
| Venda de créditos / Asaas | **Bloqueado** | Não ativado; PAYMENTS_LIVE permanece off | — |
| Autenticação / org / RBAC | **Reutilizado** | Sem segundo sistema | — |

### Dependências

- `FEATURE_AI=1` + `AI_PROVIDER=openai` + `OPENAI_API_KEY` válida para Chat/Work com modelo real.
- Migration `0025_juris_work_credits.sql` aplicada **somente** após backup (não aplicada aqui).
- Permissões: `assistant.use`, juris-work, `ai.use`.

### Custo operacional (estimativa — sem preços de conta)

| Produto | Gatilho de custo | Controle atual |
|---------|------------------|----------------|
| Chat | tokens por mensagem quando OpenAI ativo | rate limit + budgets org + fallback FAQ |
| Work | até 1 crédito/tarefa + micros por passo AI | reserva atômica + `budgetMicros` por tarefa |
| OCR / docs | por página/job | status OCR separado |
| Storage / pesquisa externa | N/A nesta entrega | — |

**Risco:** com OpenAI ligado sem tetos rígidos globais bem calibrados, 5 créditos Work ≠ 5 tarefas de custo limitado se `budgetMicros`/passos forem altos demais. Mitigação: `budgetMicros` default na criação + `maxSteps` + budgets org.

### Riscos técnicos

1. OpenAI desligado → Chat autenticado cai em FAQ (honesto via `providerKey`).
2. Streaming e cancelamento mid-generation incompletos.
3. Work ainda sem fila distribuída para execuções longas.
4. Migration 0025 pendente de apply com backup.
5. Preferências de tom/detalhe ainda localStorage (não desativam políticas).

---

## 2. Arquitetura implementada

```
Browser (/app/juris-one)
  → BFF /api/v1
    → AssistantService (conversas + generateText feature juris_one.chat)
    → JurisWorkService + credits ledger
    → AI module (status/models/prompts/usage/budgets/jobs)
  → AIGateway → OpenAIProvider | NotConfiguredAIProvider
```

- Isolamento por `userId` + `organizationId`.
- Créditos Work **nunca** mutáveis pelo frontend (só via API ledger).
- Ações externas (protocolo, pagamento, assinatura, exclusão) exigem aprovação e permanecem bloqueadas no plano.

---

## 3. Modelos OpenAI utilizados

**Nenhum modelo homologado neste ambiente** — `FEATURE_AI=0`, chave ausente.

Quando configurado, o gateway usa `OPENAI_DEFAULT_MODEL` (env) e catálogo `ai_models` — nomes/preços não fixados no código desta entrega.

---

## 4. Funcionalidades do Chat

| Capacidade | Status |
|------------|--------|
| Criar / listar / continuar conversas | Sim (API + hub) |
| Mensagens persistidas | Sim |
| Streaming HTTP | **Não** (gateway parcial; provider sem stream) |
| Renomear / arquivar / favoritar / excluir | Sim |
| Feedback | Sim |
| Copiar / regenerar (UI) | Sim (hub) |
| Preferências (nome, tom, detalhe) | Local (não enfraquecem segurança) |
| Uso justo anunciado | Sim (“ilimitadas sob uso justo”) |
| Rate limit | Sim (MemoryRateLimiter no assistant) |
| Guest público FAQ | Mantido (5 turns) |

---

## 5. Funcionalidades do Work

| Capacidade | Status |
|------------|--------|
| Criar plano multi-etapas | Sim |
| Aprovação humana | Sim |
| Execução passo a passo interna | Sim (scaffold) |
| Bloqueio ações externas | Sim |
| 5 créditos iniciais idempotentes | Sim |
| Reserva / consume / release | Sim |
| Orçamento micros por tarefa | Sim (`budgetMicros`) |
| Fila assíncrona longa | **Não** (pendente) |
| Conectores tribunal/INSS | **Não** (não afirmados) |

---

## 6. Sistema de cinco créditos

- Tabelas: `juris_work_credit_balances`, `juris_work_credit_ledger`.
- Grant inicial: idempotency `work-credits:initial:{org}:{user}` → +5 uma vez.
- Reserva na criação da tarefa; release se cancelamento pré-execução; consume após trabalho significativo.
- Endpoints: `GET .../juris-work/credits`, `POST .../credits/ensure-initial`.

---

## 7. Ferramentas de IA integradas

Já roteáveis via módulo AI / documentos / análises legais existentes (`/app/ia`, document intelligence). **Não** reescritas nesta entrega; hub Juris One aponta para Ferramentas e Administração de IA. Integração completa de cada tool UI especializada no hub permanece **parcial** até OpenAI homologado.

---

## 8. Endpoints principais

- `GET/POST /organizations/:orgId/assistant/conversations`
- `GET .../conversations/:id/messages`
- `PATCH/DELETE .../conversations/:id`
- `POST .../assistant/messages`
- `POST .../assistant/feedback`
- `GET/POST .../juris-work`, approve, run-next, cancel
- `GET .../juris-work/credits`, `POST .../credits/ensure-initial`
- `GET .../ai/status|models|prompts|usage|budgets|jobs`

---

## 9. Componentes frontend

- `juris-one-chat.tsx` — superfície pública
- `juris-one-app.tsx` — hub autenticado 2.0
- `/app/juris-one`, `/app/juris-one/work`
- `/app/ia` — admin (reutilizado)
- `lib/juris-one-api.ts`, estilos `.vj-juris-app-*`

---

## 10. Migrations

| Arquivo | Status |
|---------|--------|
| `0025_juris_work_credits.sql` | **Criada, não aplicada em produção** |

Aplicar somente com backup recuperável e plano de rollback.

---

## 11. Limites operacionais

- Guest: 5 turns FAQ.
- Chat autenticado: rate limit + budgets org + fallback se provedor off.
- Work: 5 créditos/usuário/org (grant único); 1 crédito/tarefa; `maxSteps` e `budgetMicros` por tarefa.
- Sem renovação automática comercial; sem venda de créditos.

---

## 12. Testes executados

| Suite | Resultado |
|-------|-----------|
| `juris-work-credits.test.ts` | Passou |
| `assistant.test.ts` | Passou |
| `juris-one.test.ts` (web) | Passou |
| Probe OpenAI | `not_configured` (esperado) |

Não executados nesta sessão (pendentes de homologação com provider): streaming E2E, isolamento multi-org em DB prod, OCR live, prompt-injection adversarial completo, lint/typecheck/build monorepo completo, i18n 3 locales no hub autenticado.

---

## 13. Recursos efetivamente homologados

- Ledger de créditos Work (código + testes unitários).
- Hub autenticado Chat/Work UI (código).
- Assistant CRUD + rate limit + feature `juris_one.chat`.
- Honestidade de status: OpenAI **não** configurado.

**Não homologados para produção comercial:** OpenAI live, streaming, filas Work, venda de créditos, migrations aplicadas, deploy.

---

## 14. Pendências para produção

1. Configurar `FEATURE_AI` + chave OpenAI em segredo de servidor; rodar probe `/v1/models` e registrar modelos reais.
2. Aplicar migration `0025` com backup.
3. Implementar `streamText` no `OpenAIProvider` + endpoint SSE/cancel.
4. Worker/fila para Work de longa duração.
5. Calibrar tetos diário/mensal/global e alertas admin.
6. Completar i18n do hub autenticado (pt-BR / en-US / es-ES).
7. Homologar ferramentas especializadas sob gateway com custos reais.
8. Política comercial de renovação/venda de créditos (Asaas) — **não ativar** até aprovação.
9. Lint, typecheck, testes e build completos antes do go-live.

---

## Critério final (avaliação honesta)

O Juris One passou a ser o **núcleo autenticado** de Chat + Work com créditos e reutilização do gateway/admin existentes. O Chat é **ilimitado em quantidade de conversas** no produto autenticado, sob rate limit e orçamentos; o guest público permanece limitado. O Work concede **5 créditos** com ledger auditável.

**Integração OpenAI completa não está homologada** neste ambiente (`not_configured`). Não declarar produção completa até as pendências da seção 14.
