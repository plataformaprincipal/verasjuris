# VerasJuris — Marketplace na aba Início (relatório)

**Data:** 2026-11-16  
**Escopo:** Etapas A–G parciais, sem merge/deploy e sem pagamentos live.

## 1. Arquitetura implementada

- **Home institucional pública** (`/`, landing comercial) permanece intacta.
- **Início autenticado** (`/app`) passou a ser o hub operacional do marketplace, reutilizando APIs, schema e Asaas já existentes.
- Catálogo consultado no PostgreSQL via `GET /marketplace/catalog` (filtros + paginação SQL).
- Carrinho, checkout, engajamentos, disputas e chat de contratação continuam nos módulos já existentes; a UI do Início concentra a navegação.

## 2. Arquivos e módulos modificados (principais)

| Área | Arquivos |
|------|----------|
| Validação | `packages/validation/src/marketplace.ts` |
| Schema/migration | `packages/database/src/schema/marketplace.ts`, `packages/database/drizzle/0023_marketplace_inicio_hub.sql`, `meta/_journal.json` |
| API | `apps/api/src/modules/marketplace/service.ts`, `routes.ts`, `marketplace.test.ts` |
| Web hub | `apps/web/src/components/marketplace-inicio-hub.tsx`, `apps/web/src/app/app/page.tsx` |
| Carrinho app | `apps/web/src/app/app/carrinho/page.tsx` |
| Anúncios | `apps/web/src/app/app/marketplace/servicos/page.tsx` |
| Contratação | `apps/web/src/app/marketplace/contratacoes/[id]/page.tsx` |
| Client | `apps/web/src/lib/marketplace.ts` |
| UI/CSS/i18n | `packages/ui/src/styles.css`, `apps/web/src/lib/i18n/messages/{pt-BR,en-US,es-ES}.json`, `marketplace-ui.tsx` |

## 3. Endpoints criados ou reutilizados

**Novos**
- `GET /v1/marketplace/catalog` e `GET /v1/organizations/:orgId/marketplace/catalog`
- `POST …/engagements/:id/cancel`
- `POST …/engagements/:id/refunds`

**Reutilizados**
- Categories, professionals, services CRUD, requests/proposals, engagements, deliveries, disputes, reviews
- Cart CRUD + checkout
- Payment provider/manual + webhooks Asaas existentes
- Conversation threads vinculados a engajamentos

## 4. Tabelas e migrations

- Reuso: `professional_services`, `marketplace_*`, `marketplace_carts`, `payment_intents`, etc.
- **Nova migration (não aplicada em produção):** `0023_marketplace_inicio_hub.sql`
  - `marketplace_engagement_events`
  - `financial_status`, `cancelled_at`, `cancellation_reason` em engagements
  - índices de catálogo (`active+updated_at`, `lower(title)`)
- **0021:** histórico manual em produção permanece documentado no header da 0023 — exige backup/rollback antes de aplicar.

## 5. Integrações Asaas

- Checkout Pix via provider já configurado; confirmação **somente por webhook**.
- Cancelamento com pagamento conhecido marca `financialStatus=refund_requested` — **não** chama estorno PSP como confirmado.
- Live payments: **bloqueados** (`PAYMENTS_LIVE=0` / homologação pendente).

## 6. Fluxos de compra e venda

1. Explorar catálogo no Início (URL compartilhável com filtros).
2. Adicionar serviço `fixed` ao carrinho persistente.
3. Checkout → engajamento + intent Asaas (sandbox).
4. Comprador acompanha em contratações; fornecedor via propostas/oportunidades/serviços.
5. Cancelamento auditável; reembolso só como solicitação até confirmação externa.

## 7. Resultados dos testes

- `marketplace.test.ts`: **11/11** (inclui catálogo, cancelamento, refund request) — executado no ambiente de testes com PGlite.
- Typecheck API/validation/database: limpo no momento da entrega do backend de catálogo.
- Web: typecheck a validar após esta UI.

## 8. Funcionalidades concluídas

- [x] Auditoria e reuso (sem duplicar domínio)
- [x] Início autenticado como hub marketplace
- [x] Busca/filtros/ordenação/paginação reais
- [x] Publicação/pausa de anúncios (UI + API)
- [x] Carrinho persistente na área autenticada
- [x] Checkout Asaas sandbox (fluxo existente)
- [x] Detalhe de contratação com timeline, cancelamento e solicitação de reembolso
- [x] i18n pt-BR / en-US / es-ES (chaves principais do hub)

## 9. Bloqueadas por credenciais / dependências

- Pagamentos reais / cartão homologado
- Estorno automático Asaas (split/escrow/retenção não presumidos)
- Moderação administrativa completa e denúncias avançadas
- Chat UI rica com anexos (thread já criada no backend; UI de comunicação genérica)
- Migration 0023 em produção (requer backup + autorização)

## 10. Pendências para lançamento

1. Aplicar 0023 com backup recuperável e plano de rollback.
2. Homologar sandbox Asaas end-to-end (webhook autenticado + conciliação).
3. Validação jurídica OAB/publicidade/honorários antes de ativação comercial.
4. Completar painéis comprador/vendedor com filtros por papel e relatórios.
5. Testes E2E de UI do hub + regressão cadastro/login.
6. Não declarar homologação de produção sem autorização financeira explícita.
