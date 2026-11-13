# Relatório — Experiência pública VerasJuris

Data: 2026-11-12.

## Resumo das alterações

A camada pública deixou de ser um shell textual e passou a oferecer apresentação institucional, catálogo de funcionalidades com disponibilidade real, demonstração interativa com dados fictícios, soluções por público, redirecionamento pós-login seguro e navegação pública coerente com o design system existente.

## Arquivos principais

### Novos
- `apps/web/src/lib/public-catalog.ts` (+ teste)
- `apps/web/src/lib/demo-data.ts`
- `apps/web/src/lib/solutions.ts`
- `apps/web/src/lib/safe-redirect.ts` (+ teste)
- `apps/web/src/components/public-site-header.tsx`
- `apps/web/src/components/public-page-shell.tsx`
- `apps/web/src/components/home-landing.tsx`
- `apps/web/src/components/home-product-preview.tsx`
- `apps/web/src/components/explore-demo.tsx`
- `apps/web/src/components/feature-catalog-ui.tsx`
- `apps/web/src/components/require-auth-cta.tsx`
- Páginas: `/plataforma`, `/funcionalidades`, `/funcionalidades/[slug]`, `/explorar`, `/solucoes`, `/solucoes/[slug]`, `/inteligencia-artificial`, `/marketplace-juridico`, `/integracoes`, `/automacao`, `/idiomas`, aliases de gestão, `sitemap.ts`, `robots.ts`

### Modificados
- `apps/web/src/app/page.tsx`, `layout.tsx`
- `apps/web/src/components/auth-forms.tsx`, `brand-mark.tsx`, `institutional-footer.tsx`
- `apps/web/src/app/entrar/page.tsx`, `cadastro/page.tsx`, `planos/layout.tsx`, `institucional/ajuda/page.tsx`
- `packages/ui/src/styles.css`
- Ajustes pontuais em i18n (`pt-BR`, `en-US`)

## Componentes reutilizados
- `@verasjuris/ui` (Button, ButtonLink, Dialog, Menu, tokens)
- `LocaleProvider` / `LanguageSwitcher`
- `PlatformChrome`, painel de acessibilidade, skip links
- Fluxos de autenticação existentes (API inalterada)

## Componentes novos
- Shell/header público, landing, catálogo, demonstração, CTA de autenticação, prévia da home

## Módulos apresentados publicamente
37 funcionalidades em 10 categorias (gestão jurídica, atendimento, documentos, previdenciário, marketplace, financeiro, organizacional, automação, IA, integrações), além de 5 soluções por público.

## Disponibilidade declarada (honesta)

| Situação | Exemplos |
| --- | --- |
| Disponível (manual) | Processos, clientes, documentos, prazos, agenda, tarefas, organizações, permissões, marketplace interno |
| Em testes | Cobranças Asaas / pagamentos |
| Em desenvolvimento | Assistente IA, análise documental, petições assistidas, e-mail, agenda externa |
| Planejada | Tribunais/e-filing, protocolo oficial INSS |

## Autenticação
- `?redirect=` honrado após login/cadastro quando o caminho passa por `isSafeRedirectPath`
- Open-redirect bloqueado (protocolos, `//`, `..`, prefixes fora da allowlist)
- Ações reais na demo abrem diálogo Entrar / Criar conta

## Acessibilidade
- Header com menu móvel, foco e `aria-*`
- Skip links e painel existentes preservados
- Contraste e tokens do design system mantidos
- Homologação WCAG AA manual (VoiceOver/NVDA) **ainda pendente**

## Idiomas
- Infraestrutura de 30 locales intacta (cobertura de chaves chrome = 100%)
- Conteúdo novo da experiência pública está em português (fonte canônica do catálogo); tradução integral desses textos **pendente**
- Página `/idiomas` comunica cobertura progressiva

## Testes executados
- `vitest`: `safe-redirect`, `public-catalog`, `i18n.coverage` — **41 passed**
- `tsc -p apps/web` — **ok**
- `next build` — **ok** (rotas públicas geradas, incluindo SSG do catálogo)
- Manual/browser: home, explorar, diálogo de auth, `/entrar?redirect=`, `/funcionalidades`

## Problemas remanescentes / riscos
1. Políticas e páginas institucionais antigas ainda em RASCUNHO (conteúdo jurídico final)
2. i18n integral dos textos públicos (catálogo/demo) não expandido aos 30 JSONs
3. WCAG AA não homologada manualmente
4. API/produção e pagamentos live continuam bloqueados conforme auditorias anteriores — não anunciados como ativos
5. Logos oficiais ainda ausentes; marca pública usa texto VerasJuris (conforme `public/brand/README.md`)
6. Medição formal LCP/INP/CLS em produção não foi executada nesta entrega

## Pendências para lançamento público comercial
- Homologar API e banco de produção
- Homologar Asaas e só então habilitar checkout público
- Revisar/aprovar políticas
- Completar tradução dos textos públicos
- Testes a11y manuais + métricas Web Vitals em ambiente representativo
- Publicar ativos oficiais de marca
