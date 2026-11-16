# Relatório — Acessibilidade avançada

Data: 2026-11-16.

## Referência EccoPet

Repositório consultado: `plataformaprincipal/ecopet` (clone local de referência em `.ecopet-ref/`, ignorado no git).

Padrões adaptados (não copiados cegamente):

- Preferências → CSS variables + `data-*` em `<html>`
- VLibras oficial gov.br com **init único** e show/hide sem remount
- Persistência local + sync opcional com API
- Toolbar/painel com anúncios `aria-live`

Não adotado: branding `ecopet-*`, auto-translate de 92 locales, filtros CSS globais destrutivos.

## Painel reorganizado

`AccessibilityPanel` em categorias:

| Categoria | Controles |
| --- | --- |
| **Visão** | Fonte ±, contraste, tema claro/escuro/**preto**, cursor ampliado, sublinhar links, destacar interativos |
| **Leitura** | Espaçamento letras/linhas, dislexia, linguagem simplificada, guia de leitura, reduzir distrações |
| **Navegação** | Foco reforçado, só teclado, UI simplificada, reduzir animações, zoom da interface |
| **Tecnologias assistivas** | Otimização leitor de tela, **VLibras** com status real, visão de cores |

- Botão **Restaurar configurações padrão**
- Preferências aplicadas imediatamente e persistidas (`vj.accessibility.preferences` + API quando autenticado)
- Campos novos locais (letterSpacing, uiZoom, highlightInteractive, reduceDistractions, simplifiedUi, tema black) preservados no merge com a API

## VLibras

| Item | Status |
| --- | --- |
| Script oficial `vlibras.gov.br` | Implementado |
| Init único do Widget | Implementado |
| Show/hide sem re-onload em rotas | Implementado |
| Status idle/loading/ready/error/unavailable | Implementado e exibido no painel |
| Montagem única no `PlatformChrome` | Implementado |
| Não declarar funcional se indisponível | Status honesto no painel |

Arquivos: `apps/web/src/lib/vlibras/*`, `apps/web/src/components/vlibras-widget.tsx`.

## Temas e tokens

- Temas via `data-theme` (`system` / `light` / `dark` / **`black`**)
- Escala tipográfica, letter-spacing, line-height e zoom via CSS variables
- Destaque de interativos e cursor ampliado via `data-*`
- Evita filtro CSS global que distorce imagens

## Testes

| Suite | Resultado |
| --- | --- |
| `vlibras-loader.test.ts` / outcomes | passed |
| i18n keys de a11y nos 3 idiomas | passed |
| vitest `apps/web` | passed no lote executado |
| tsc `apps/web` | ok após tipagem do DOM VLibras |

## Limitações (WCAG)

- A existência do painel **não** equivale a conformidade WCAG 2.2 AA.
- Auditoria manual (teclado, leitores de tela, contraste em todas as rotas, modais) permanece **pendente de homologação**.
- VLibras depende de CDN externa; offline → status `unavailable`/`error`.
- Mensagens de erro de domínio ainda majoritariamente em português (API/Zod).
- Testes E2E desktop/mobile de todos os controles: **não homologados visualmente neste ciclo**.

## Arquivos principais

- `apps/web/src/components/accessibility-panel.tsx`
- `apps/web/src/lib/accessibility.ts`
- `apps/web/src/components/vlibras-widget.tsx`
- `apps/web/src/lib/vlibras/*`
- `apps/web/src/components/platform-chrome.tsx`
- `packages/ui/src/styles.css`
- `apps/web/next.config.ts` (ajustes de CSP/carregamento quando presentes)

## Pendências

1. Auditoria WCAG 2.2 AA com evidências (axe + teclado + SR).
2. Expandir schema da API para persistir letterSpacing/uiZoom/tema black no servidor.
3. Smoke real do VLibras em staging (rede + CSP).
4. Verificar sobreposição do avatar VLibras com FAB/checkout em viewports móveis.
5. Homologar painel nos três idiomas ativos.

**Classificação:** painel categorizado + VLibras funcional com status honesto **IMPLEMENTADOS E TESTADOS (unidade)**; conformidade WCAG AA **NÃO HOMOLOGADA**.
