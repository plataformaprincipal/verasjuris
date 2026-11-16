# VerasJuris — Correção de senhas e internacionalização

Data: 2026-11-16

## 1. Causa da exigência persistente de 12 caracteres

A política Zod/API em `packages/validation/src/password-policy.ts` já aceitava **BOA** com mínimo de **8** caracteres. O bloqueio restante vinha do **HTML `minLength={12}`** em:

- `apps/web/src/components/auth-forms.tsx` (cadastro legado e redefinição)
- `apps/web/src/app/app/conta/page.tsx` (troca de senha)

O atributo nativo do browser impedia o envio do formulário antes da validação Zod. Esses `minLength` foram corrigidos para **8**. Não restam `minLength={12}` em `apps`/`packages`.

Classificação **EXCELENTE** continua em 12+ caracteres (indicador visual, não barreira de cadastro).

## 2. Arquivos corrigidos (principais)

### Senha
- `packages/validation/src/password-policy.ts` (mensagens estáveis exportadas)
- `packages/validation/src/password-policy.test.ts` (8/9/10/11 BOA + 12+ EXCELENTE)
- `packages/validation/src/index.test.ts` (registerSchema aceita `Veras@12`)
- `apps/web/src/components/auth-forms.tsx`
- `apps/web/src/app/app/conta/page.tsx`
- `apps/web/src/lib/registration-wizard.ts` / `.test.ts` / `registration-wizard.tsx`

### i18n / erros
- Catálogos `apps/web/src/lib/i18n/messages/{pt-BR,en-US,es-ES}.json` (~952 chaves, paridade total)
- `apps/web/src/lib/i18n/api-errors.ts` (tradução por **código** e mensagens-fonte estáveis)
- Auth shells: `auth-page-chrome.tsx`, `auth-page-footer.tsx`, páginas `/entrar`, `/cadastro`, `/recuperar-conta`, `/redefinir-senha`, `/verificar-email`
- Wizard de cadastro (labels, passos, personas, senha, erros via `t()`/`te()`)
- Home comercial, nav pública, app-shell (parcialmente já existente + expansão)
- Conta (`/app/conta`)

## 3. Resultado dos testes de senha

| Caso | Resultado |
|------|-----------|
| 7 chars com composição | Rejeitada |
| 8–11 BOA (`Veras@12` … `Veras@12345`) | Aceita FE + schema |
| 12+ EXCELENTE | Aceita |
| Sem maiúscula/minúscula/número/especial | Rejeitada |
| Senha comum (`password1234`) | Rejeitada |
| `registerSchema` legado com 8 chars | Aceita |
| API `onboarding-register.test.ts` | 7/7 passed |

Comandos: `vitest` em password-policy, index validation, registration-wizard, i18n, onboarding-register.

## 4. Rotas auditadas (três idiomas)

Cobertura efetiva de UI própria (chrome + formulários + shells):

- Públicas: `/`, abas via `public-main-nav` / `public-page-shell`, home comercial
- Auth: `/entrar`, `/cadastro`, `/recuperar-conta`, `/redefinir-senha`, `/verificar-email`
- Autenticadas: app-shell (nav/menus), `/app/conta`, painel de acessibilidade (chaves `a11y.*`)
- Preferência de idioma: `LocaleProvider` + `localStorage` + sync de conta quando autenticado

Catálogos: **952** chaves idênticas em pt-BR / en-US / es-ES.

## 5. Ainda não traduzidos integralmente (honestidade)

Textos próprios ainda hardcoded em várias páginas de marketing/módulo, por exemplo:

- `/inteligencia-artificial`, `/marketplace-juridico`, `/plataforma`, `/automacao`, `/integracoes`, `/solucoes`, `/institucional/ajuda`, `/convite`
- Nomes/resumos de `PUBLIC_CATALOG` / `SOLUTIONS` / `DEMO_*` (conteúdo de catálogo/demo)
- Muitas páginas profundas de `/app/**` e `/portal/**` (títulos/empty states pontuais)
- Conteúdo jurídico de políticas (não deve ser autotraduzido como documento)

Navegação principal, auth, wizard, home e shells já reagem à troca de idioma.

## 6. Lint / typecheck / testes / build

| Check | Resultado |
|-------|-----------|
| Typecheck `apps/web` | OK |
| Typecheck `packages/validation` | OK (via testes/tsc) |
| Vitest senha + wizard + i18n | 46 passed |
| Vitest API onboarding-register | 7 passed |
| `biome check` (arquivos tocados) | Format aplicado; avisos de deps de `useEffect` pré-existentes |
| `pnpm --filter @verasjuris/web build` | OK |

Sem migrations e sem publish em produção nesta entrega.

## Critério de aprovação

- Senha válida de **8 caracteres** aceita ponta a ponta (HTML + Zod + API + wizard).
- Troca de idioma traduz a UI própria nas superfícies prioritárias (auth, cadastro, home, shells); catálogos e mapeamento de erros por código prontos para o restante.
