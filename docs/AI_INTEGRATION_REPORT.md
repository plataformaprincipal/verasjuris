# Relatório — Correção integral da IA (Juris One)

**Branch:** `fix/ai-juris-one-real-integration`  
**Data:** 2026-11-16  

## Critério de aceite (estado)

| # | Critério | Estado |
|---|----------|--------|
| 1 | Juris One público usa IA real (limites) | **Código pronto** — homologação live depende de `FEATURE_AI=1` + `AI_PROVIDER=openai` + chave no **runtime da API** |
| 2 | Juris One autenticado via backend | **Corrigido** — sem FAQ silencioso; contexto das últimas mensagens; erro honesto se provedor off |
| 3 | Assistente capacidades autorizadas | Parcial (tools existentes; chat exige IA configurada) |
| 4 | Ferramentas declaradas disponíveis | **Não homologadas nesta entrega** (auditoria: muitas ainda not_configured) |
| 5 | Documentos analisados de fato | **Não homologado** (OCR not_configured) |
| 6 | Custos limitados | Público: 5/dia + rate/min + max tokens; autenticado: rate + budgets org existentes |
| 7 | Permissões preservadas | Sim (isolamento org no assistant) |
| 8 | Testes obrigatórios | Unit/integração dos pontos alterados **OK**; live OpenAI **NÃO HOMOLOGADO** neste ambiente de desenvolvimento |
| 9 | Sem FAQ fingindo ser IA | **Corrigido** |
| 10 | Homologação produção com evidência | **Pendente** — requer deploy da branch + probe `/v1/juris-one/public/status` e chat mínimo |

## Tabela de funcionalidades

| Funcionalidade | Situação anterior | Correção realizada | Testes | Situação final |
|---|---|---|---|---|
| Juris One público | FAQ local (`jurisOneReply`) | `POST /v1/juris-one/public/chat` + AIGateway; UI chama API | unit OK | Pronto p/ homologar com chave |
| Juris One autenticado | FAQ silencioso se IA off/erro | Erro `AI_PROVIDER_NOT_CONFIGURED`; contexto 12 msgs | assistant test OK | Pronto p/ homologar |
| Assistente | FAQ fallback | Mesma política; tools intactas | OK | Parcial |
| Análise documental | Existente / OCR off | Sem mudança estrutural | — | Não homologado |
| Elaboração jurídica | Módulos existentes | Sem mudança | — | Não homologado |
| Pesquisa jurídica | Provider legal not_configured | Sem mudança | — | Não homologado |
| Ferramentas especializadas | Misto | Sem expansão falsa | — | Não homologado |
| Juris Work | Créditos + scaffold | Sem mudança nesta PR | — | Parcial / não homologado externo |
| Controle financeiro | Budgets org + micros | Limites públicos + feature `juris_one.public_chat` | OK | Parcial |

## Correção crítica de bootstrap

Em `apps/api/src/app.ts`, o fallback do gateway forçava `AI_PROVIDER: "not_configured"` mesmo com env correto.  
O entrypoint de produção (`createAppFromEnv`) já lia o env corretamente; o fallback foi alinhado a `process.env`.

## Endpoints

| Método | Path | Auth |
|--------|------|------|
| GET | `/v1/juris-one/public/status` | Público |
| POST | `/v1/juris-one/public/chat` | Público (rate limit IP+visitor) |

## Variáveis necessárias (servidor API)

```
FEATURE_AI=1
AI_PROVIDER=openai
OPENAI_API_KEY=***
OPENAI_DEFAULT_MODEL=gpt-4o-mini   # recomendado econômico
OPENAI_HEALTHCHECK=1               # opcional para /models
```

**Nunca** enviar a chave ao navegador.

## Limites públicos adotados

- 5 mensagens IA / visitante+IP / dia (servidor)
- 6 req / minuto
- Max 2000 chars/mensagem
- Max 800 tokens de saída
- Bloqueio de concorrência por visitante
- Sem inventar resposta se o provedor falhar

## Testes executados

```
pnpm --filter @verasjuris/api exec vitest run src/juris-one-public.test.ts src/assistant.test.ts
pnpm --filter @verasjuris/ai exec vitest run src/openai-provider.test.ts src/index.test.ts
pnpm --filter @verasjuris/web exec vitest run src/lib/juris-one.test.ts
```

Live OpenAI neste workspace de desenvolvimento: **não homologado** (chave/provider podem estar só no ambiente de produção/Vercel).

## Comandos de validação pós-deploy

```bash
curl -sS "$API/v1/juris-one/public/status"
curl -sS -X POST "$API/v1/juris-one/public/chat" \
  -H 'content-type: application/json' \
  -d '{"message":"Olá Juris One","visitorId":"probe_validate_01","locale":"pt-BR"}'
```

Esperado com IA configurada: `201` + `provider: openai` + `reply` não-FAQ.  
Esperado sem IA: erro `AI_PROVIDER_NOT_CONFIGURED` (não inventar texto).

## Riscos remanescentes

- Contadores diários públicos em memória (reset em cold start serverless) — reforçar com Redis/DB se necessário.
- Streaming HTTP ainda não ligado ao chat público.
- OCR / pesquisa jurídica / cobrança de IA ao usuário: fora do escopo homologado desta PR.
- Deploy Vercel deve expor as vars no **serviço da API**, não só no frontend.

## Arquivos principais

- `apps/api/src/modules/juris-one-public/*`
- `apps/api/src/modules/assistant/service.ts`
- `apps/api/src/app.ts`
- `apps/web/src/components/juris-one-chat.tsx`
- `apps/web/src/lib/juris-one-public-api.ts`
- `packages/ai/src/gateway.ts` (feature `juris_one.public_chat`)
- `packages/validation/src/juris-one-public.ts`
