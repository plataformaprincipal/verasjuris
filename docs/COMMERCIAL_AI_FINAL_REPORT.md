# VerasJuris — Relatório final (Marketplace, Asaas, Chat, JurisOne, Resend)

**Data:** 2026-11-16
**Escopo:** etapa comercial/operacional + design system + Resend
**Deploy/merge:** **não executados** (aguardam aprovação dos critérios críticos)
**Pagamentos live:** `PAYMENTS_LIVE` permanece desabilitado; sem habilitação de cobrança real.

## Matriz de estados

| Recurso | Estado | Notas |
|---|---|---|
| Auth / sessões / RBAC / orgs | **FUNCIONAL** | Reutilizado |
| Marketplace catálogo / requests / proposals / engagements / deliveries / reviews | **FUNCIONAL** | Já existia; preservado |
| Thread de chat no aceite de proposta | **FUNCIONAL** | Wire-up novo: cria `conversationThreads` + participantes |
| Chat transacional (HTTP) | **PARCIAL** | Persistência e vínculo existem; sem realtime dedicado |
| Carrinho persistente | **PARCIAL** | Schema + API + `/carrinho`; checkout só preço fixo; UI de remoção/qty limitada |
| Checkout PSP marketplace | **PARCIAL** | `initiateMarketplaceProviderPayment` cria intent real via `PaymentProvider` existente |
| Confirmação financeira → liberação | **FUNCIONAL** (código) / **NÃO HOMOLOGADO** | Hook em `confirmPayment` ativa engagement `pending_payment → active` |
| Asaas sandbox/produção | **NÃO HOMOLOGADO** | Adapter existe; credenciais/webhooks/conciliação não comprovados neste ciclo |
| Repasses / split | **BLOQUEADO** | Não presumido; depende de conta/API e modelo comercial |
| JurisOne Chat | **PARCIAL** | FAQ/público + assistant autenticado; provedor AI depende de config |
| JurisOne Work | **PARCIAL** | Scaffold autenticado (`/app/juris-one/work` + API); ações externas bloqueadas |
| Resend HTML templates | **PARCIAL** | HTML versionado no provider; kinds ampliados; **NÃO HOMOLOGADO** em envio real |
| Webhooks Resend (bounce/complaint) | **AUSENTE** | Não implementados neste ciclo |
| Preferências de notificação / fila de e-mail | **PARCIAL** | Infra de envio existe; cobertura de eventos marketplace incompleta |
| Design system | **FUNCIONAL** | Páginas novas usam `@verasjuris/ui` / tokens existentes |
| Testes críticos E2E pagamento live | **NÃO HOMOLOGADO** | Sem sandbox real neste ciclo |
| Prontidão para lançamento comercial | **BLOQUEADO** | Falta homologação Asaas, Resend real, Work completo, conformidade OAB/comercial |

## Implementado neste ciclo (reutilizando arquitetura)

1. **Pagamento marketplace via PSP existente** (`PaymentProvider` / Asaas adapter) — sem segundo provider.
2. **Thread conversacional** criada no aceite da proposta.
3. **Ativação de engagement** apenas após `confirmPayment` confiável.
4. **Carrinho** (migration `0022`, API, página `/carrinho`).
5. **Resend**: envio com `html` + templates escapados.
6. **JurisOne Work scaffold** com plano, aprovação humana, passos internos e bloqueio de ações externas.
7. UI de pagamento na contratação e página Work autenticada.

## Rotas novas / relevantes

- `GET/POST .../marketplace/cart` (+ items, checkout)
- `POST .../marketplace/engagements/:id/payment/provider` (agora funcional quando provider configurado)
- `.../juris-work` (CRUD operacional de tarefas/passos)
- Web: `/carrinho`, `/app/juris-one/work`

## Modelos / migrations

- `marketplace_carts`, `marketplace_cart_items`
- `juris_work_tasks`, `juris_work_steps`
- Migration aditiva: `packages/database/drizzle/0022_marketplace_cart_juris_work.sql`

## Testes

Executados neste ciclo:

- `packages/email` templates + Resend provider — **9 testes OK** (junto com juris-one)
- `apps/web/src/lib/juris-one.test.ts` — Work público `available: false` — **OK**
- `apps/api/src/marketplace.test.ts` — **8/8 OK** (inclui thread no aceite + provider NOT_CONFIGURED)
- Typecheck API e validation — **OK**
- Typecheck web — **OK**
- Homologação Asaas/Resend live — **não executada**

## Pendências explícitas

### Segurança
- Homologar isolamento IDOR em cart/checkout/work com suíte dedicada.
- Webhooks Resend autenticados.
- Rate limits específicos de cart/checkout sob carga.

### Regulatório / comercial
- Separação advocacia × serviços tecnológicos na UX de catálogo (parcialmente coberta por categorias; falta revisão jurídica formal).
- Modelo de honorários / intermediação OAB — **não liberar** intermediação remunerada incompatível.
- Contratos de processamento de dados com provedores de IA/pagamento.

### Operacional
- Credenciais Asaas sandbox + webhook URL + replay/idempotência comprovados.
- Domínio Resend com SPF/DKIM/DMARC verificados e envio real.
- Staging completo dos fluxos: proposta → pagamento → ordem → entrega.

## Resultado da homologação

**NÃO APROVADO para lançamento comercial.**

O código avança os gaps críticos, mas **não** há evidência de fluxos completos com provedores reais. Compilação/testes locais **não** substituem homologação Asaas/Resend/IA em staging.

## Status de prontidão

**BLOQUEADO** até aprovação explícita após:

1. Homologação Asaas sandbox (Pix/boleto + webhook + conciliação + não-liberação indevida)
2. Homologação Resend com domínio verificado
3. Testes críticos de isolamento e pagamentos
4. Revisão regulatória do marketplace
5. Aprovação humana para merge/deploy
