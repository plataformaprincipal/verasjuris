# VerasJuris — Showroom `/ferramentas` (relatório)

**Data:** 2026-11-16  
**Escopo:** redesign do catálogo público + motor de demonstrações interativas locais.  
**Não alterado:** autenticação, banco de produção, pagamentos, APIs operacionais.  
**Deploy:** não realizado.

## 1. Auditoria (Etapa 1)

| Item | Achado |
|------|--------|
| Catálogo | `PUBLIC_CATALOG` em `public-catalog.ts` — fonte única preservada |
| UI antiga | Cards estáticos + link para `/explorar?view=` (tabelas read-only) |
| Demos | `explore-demo.tsx` permanece para `/explorar`; não removido |
| Auth | CTAs `RequireAuthCta` + redirect `next=` preservados |
| i18n | pt-BR / en-US / es-ES |

### Classificação A–D (por tipo de demo pública)

| Classe | Significado | Exemplos |
|--------|-------------|----------|
| **A** | Demo local funcional (CRUD fictício) | processos, clientes, agenda, prazos, tarefas, documentos |
| **B** | Interativa com lógica controlada | contratos, CRM, financeiro, relatórios, automação, marketplace |
| **C** | Prévia guiada (sem integração ativa) | previdenciário ilustrativo, IA preparada, integrações |
| **D** | Módulo autenticado real | links `/app/...` na ficha comercial / CTA |

Uma ferramenta pode ter demo pública A/B/C **e** módulo D autenticado.

## 2. Arquitetura implementada

- **Showroom** em `/ferramentas`: hero animado, nav lateral, busca, filtros (categoria, disponibilidade, público), grid/lista.
- **Detalhe** `/ferramentas/[slug]`: demonstração embutida (`#demonstracao`), ficha comercial, limitações, CTA cadastro/módulo.
- **Motor** `lib/tool-demos/{types,registry,engine}` + `components/tool-demos/*` com lazy `next/dynamic`.
- Estado **somente local** (sessão da página); reinício/desfazer; banner de modo demo; limites de itens.

## 3. Demonstrações funcionais

| Kind | Interações |
|------|------------|
| processos | CRUD, status, andamentos, timeline, busca |
| clientes | CRUD, notas de atendimento, vínculo a casos seed |
| agenda | criar, remarcar, excluir |
| prazos | data manual, urgência, painel (disclaimer oficial) |
| tarefas | Kanban acessível por botões |
| documentos | pastas/versão, busca, prévia textual |
| contratos | templates, variáveis, export `.txt` local |
| crm | pipeline com movimentação e filtro |
| financeiro | simulador honorários + fluxo (sem cobrança) |
| relatorios | barras dinâmicas por ação local |
| automacao | nós + execução simulada com log |
| previdenciario | math ilustrativa + avisos INSS |
| marketplace | filtro, carrinho, pedido fictício |
| ia | cenários preparados (não é IA em tempo real) |
| integracoes | etapas + erro ilustrativo (não conecta) |

## 4. Engenharia comercial

`getCommercialSheet(slug)` — problema, público, benefício, demo, features reais, limitações, deps, banda de custo (`previsivel|variavel|transacional|a_validar`), suporte, conformidade, modalidade sugerida, **`eligiblePlan: null`**, CTAs. Sem preços inventados.

## 5. Arquivos principais

- `apps/web/src/components/feature-catalog-ui.tsx`
- `apps/web/src/components/public-route-chrome.tsx`
- `apps/web/src/components/tool-demos/*`
- `apps/web/src/lib/tool-demos/*`
- `packages/ui/src/styles.css` (showroom + demo)
- `apps/web/src/lib/i18n/messages/{pt-BR,en-US,es-ES}.json`
- Auxiliares do agente paralelo mantidos: `configs.ts`, `seeds.ts`, `utils.ts` (não usados pelo loader atual)

## 6. Testes executados

- `tsc --noEmit` (@verasjuris/web) — OK
- `vitest` registry + public-catalog + i18n coverage — **9/9**

## 7. Limitações / pendências

- Tradução completa de todos os textos internos das demos (parte ainda em PT com fallback `t`).
- Lint/build monorepo completo não foi o foco desta entrega (typecheck + testes alvo OK).
- Demos não persistem entre reloads (intencional).
- `/explorar` ainda é read-only; showroom interativo está em `/ferramentas/[slug]`.
- Preços/planos comerciais: ainda `a_validar`.
- Não há deploy.

## 8. Critério de conclusão

Visitante pode filtrar o catálogo, abrir ferramenta, **operar** a demonstração elegível, ler limitações/ficha comercial e seguir para cadastro ou módulo autenticado — sem botões meramente decorativos nas demos implementadas e sem simular integrações externas como concluídas.
