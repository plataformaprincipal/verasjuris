# Provedores de IA, OCR e oportunidades públicas

## Princípio

Três contratos distintos, três factories a partir de variáveis de ambiente. Domínios de negócio **nunca** importam vendor SDK.

## AI — `AIProvider` / `AIGateway`

- **Interface:** `packages/ai/src/provider.ts`, fachada `AIGateway` em `gateway.ts`.
- **Implementação padrão:** `NotConfiguredAIProvider` — valida pedido, não abre socket, devolve erro mapeado (`AI_PROVIDER_NOT_CONFIGURED`).
- **Env:** `AI_PROVIDER=not_configured` \| `openai`. OpenAI só com `FEATURE_AI=1` **e** `OPENAI_API_KEY`. Opcionais: `AI_DEFAULT_MODEL` / `OPENAI_DEFAULT_MODEL`, `AI_REQUEST_TIMEOUT_MS`, `AI_MAX_RETRIES`, `AI_MAX_INPUT_TOKENS`, `AI_MONTHLY_BUDGET_MICROS`, `OPENAI_HEALTHCHECK` (`1` = GET `/v1/models` com timeout curto; padrão sem rede).
- **Capacidades:** catálogo `AICapability` (texto, structured output, embeddings, visão). Com `not_configured`, `describe().capabilities` é lista vazia. OpenAI declara `TEXT` + `STRUCTURED_OUTPUT`.
- **Features:** `DEFAULT_AI_FEATURES` amarra feature → capacidades exigidas + `outputDisposition` (quase sempre `requires_review`).

Adapter: `OpenAIProvider` (`packages/ai/src/openai-provider.ts`) via `fetch` — sem SDK. Nunca logar a chave. Deploy: `docs/PRODUCTION_DEPLOY.md`.

**Azure / outros:** não implementados.

## OCR — `OCRProvider`

- **Interface:** `packages/ai/src/ocr.ts`.
- **Padrão:** `NotConfiguredOCRProvider` → `OCR_PROVIDER_NOT_CONFIGURED` (503).
- **Env:** `OCR_PROVIDER=not_configured`.

Fluxo documental: extração tenta camada de texto nativa (PDF/texto) primeiro; OCR só quando `ocrRequired` e texto insuficiente (ver ADR 064 e `docs/DOCUMENT_INTELLIGENCE.md`).

## Oportunidades públicas — `PublicOpportunityProvider`

- **Interface:** `packages/ai/src/public-opportunity.ts`.
- **Padrão:** `NotConfiguredPublicOpportunityProvider` → `PUBLIC_OPPORTUNITY_PROVIDER_NOT_CONFIGURED`.
- **Env:** `PUBLIC_OPPORTUNITY_PROVIDER=not_configured`.

Permite listagem/cadastro **manual** no banco (`public_opportunities`). Sincronização ou busca em portal oficial (ex. PNCP) **não** existe nesta etapa.

## Health e status

`GET …/ai/status` agrega:

- `ai`: status do gateway, capacidades, política de saída (`autoApply: false`, `requiresReview: true`).
- `ocr`: status do provedor OCR.
- `publicOpportunityProvider`: status do provedor de oportunidades.

Com defaults de env, os três retornam `not_configured`.

## Testes

`@verasjuris/ai/testing` fornece provedores in-memory/determinísticos. Usados apenas em Vitest (API/worker). Não são selecionáveis via `.env` de produção.

## Integrações externas genéricas

`FEATURE_EXTERNAL_INTEGRATIONS` prepara flag; não há adapter PNCP, tribunal, órgão ou OpenAI registrado. Qualquer integração real exige contrato dedicado + ADR (ver ADR 070).
