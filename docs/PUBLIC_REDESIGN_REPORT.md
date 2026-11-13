# Relatório — Redesign integral da plataforma pública VerasJuris

Data: 2026-11-13.

## 1. Auditoria do frontend anterior

- Navegação pública fragmentada (links institucionais sem quatro abas claras).
- Home ainda híbrida entre landing antiga e catálogo.
- `/ferramentas` e `/juris-one` inexistentes como abas principais.
- Explorar era laboratório de demos, sem feed social.
- Assistente público limitado ao FAB; sem superfície Juris One.
- Marketplace sem integração comercial forte na home.
- Sem feed social no backend (sem schema/API de publicações).

## 2. Problemas identificados

- Hierarquia visual inconsistente e pouca microinteração.
- Rotas legadas `/funcionalidades` competindo com a nova taxonomia.
- Risco de “falso operacional” se IA/Work/feed fossem simulados como reais.
- Bottom nav e FABs podiam colidir em mobile (corrigido com safe-area).

## 3. Design system criado / reforçado

- Tokens existentes navy/azul/neutros em `packages/ui/src/styles.css`.
- Extensão “Public 4-tab redesign”: hero comercial, service cards, feed layout, Juris shell, bottom nav, hover transitions, `prefers-reduced-motion`.
- Tipografia Source Sans 3 (identidade já adotada; não forçada troca para Inter/Geist).

## 4. Componentes implementados

| Componente | Papel |
| --- | --- |
| `public-nav.ts` / `public-main-nav.tsx` | Quatro abas desktop + bottom mobile |
| `public-site-header.tsx` | Marca, abas, Mais, auth, a11y/idioma |
| `home-commercial.tsx` | Home comercial + marketplace integrado |
| `feature-catalog-ui.tsx` | Catálogo (links em `/ferramentas`) |
| `explore-social.tsx` | Feed social demonstrativo |
| `explore-demo.tsx` | Laboratório (`?view=`) |
| `juris-one-chat.tsx` / `juris-one.ts` | Chat público com limites honestos |
| Footer atualizado | Quatro abas + marketplace/planos |

## 5. Quatro abas

1. **Início** `/` — comercial, serviços, marketplace, ferramentas, soluções, Juris One, FAQ.
2. **Ferramentas** `/ferramentas` — catálogo + detalhes `/ferramentas/[slug]`.
3. **Explorar** `/explorar` — feed social demo; `?view=` abre laboratório.
4. **Juris One** `/juris-one` — chat FAQ/orientação + limite de sessão.

Compat: `/funcionalidades` e `/funcionalidades/[slug]` redirecionam para `/ferramentas`.

## 6. Marketplace na home

Seção com busca/CTA para `/marketplace-juridico`, cards demonstrativos rotulados, CTA autenticado para proposta. Sem quinta aba.

## 7. Catálogo de ferramentas

Reutiliza `PUBLIC_CATALOG` com disponibilidade real. Demos via Explorar laboratório / prévia da home.

## 8. Feed social

**Demonstração.** Posts fictícios claramente identificados. Curtir/comentar/publicar/seguir/denunciar → `RequireAuthCta`. Sem API de feed; sem métricas inventadas.

## 9. Juris One

- Chat operacional como **orientação FAQ** (sem provedor pago no cliente).
- Etapa gratuita: 5 interações/`sessionStorage` (configurável em código).
- Work: **indisponível** (botão desabilitado + texto honesto).
- Objetivos opcionais personalizam encaminhamentos, não permissões.
- Encaminha para marketplace, ferramentas, planos, auth.

## 10–11. Demonstrativo vs real

| Item | Classificação |
| --- | --- |
| Navegação 4 abas + bottom nav | Implementado e testado (unit) |
| Home comercial + marketplace CTA | Implementado, não homologado em produção |
| Catálogo `/ferramentas` | Implementado e testado (catálogo existente) |
| Feed Explorar | Demonstração |
| Laboratório Explorar `?view=` | Demonstração |
| Juris One Chat FAQ + limite | Implementado, não homologado (sem AI paga pública) |
| Juris One Work | Indisponível |
| Feed real / moderação / likes | Em desenvolvimento / infraestrutura pendente |
| Assistente org autenticado (API) | Existente no backend; fora desta superfície pública |

## 12. Integrações pendentes

- Schema/API de feed, denúncias, follows, composer com mídia.
- Limites administrativos de IA gratuita (tokens/custo) no servidor.
- Modo Work com estado de tarefas.
- Homologação visual multi-browser/dispositivo.

## 13. Resultados de testes

Executados nesta entrega:

| Comando | Resultado |
| --- | --- |
| `vitest run` `public-nav.test.ts` + `juris-one.test.ts` | 5/5 passou |
| `pnpm --filter @verasjuris/web typecheck` | OK |
| `pnpm --filter @verasjuris/web build` (`next build --webpack`) | OK — rotas `/`, `/ferramentas`, `/explorar`, `/juris-one` geradas |

Ajuste de build: `transpilePackages` + `extensionAlias` em `apps/web/next.config.ts` para resolver imports ESM `.js`→`.ts` de `@verasjuris/validation`/`types` (necessário após o wizard de cadastro consumir o pacote no web).

Não houve matriz completa Chrome/Safari/Firefox/iOS/Android nesta sessão.

## 14. Responsividade

- Desktop: tabs superiores.
- Mobile: bottom nav 4 itens + safe-area; FABs elevados.
- Feed: 3 colunas ≥961px; coluna única no mobile.

## 15. Pendências de infraestrutura

- `API_INTERNAL_URL` em Vercel (BFF).
- Migration onboarding se ainda não aplicada em produção.
- Provedor de IA + billing de uso para etapa gratuita real.

## 16. Riscos

- Custo de IA se API pública for aberta sem rate limit servidor.
- Confusão usuário se demo feed for lido como conteúdo real (mitigado por banner).
- Work anunciado prematuramente (mitigado: disabled).

## 17. Deploy

1. Garantir envs (`NEXT_PUBLIC_APP_URL`, `API_INTERNAL_URL`, DB).
2. `pnpm build` e deploy web.
3. Smoke: `/`, `/ferramentas`, `/explorar`, `/juris-one`, redirect `/funcionalidades`.
4. Validar auth Entrar/Cadastro e CTAs `RequireAuthCta`.
