# Relatório — Cadastro, autenticação e onboarding (sem confirmação de e-mail)

Data: 2026-11-13.

## Diagnóstico do erro atual (produção + produto)

1. **BFF apontava para localhost** quando `API_INTERNAL_URL` faltava no Web Vercel; `NEXT_PUBLIC_API_URL` sozinha não alimentava o proxy (`apps/web/src/lib/types.ts` → `apiInternalUrl`).
2. **Cadastro legado** criava usuário `pending_verification`, **não abria sessão** e **exigia** `emailVerifiedAt` em `loginAccount` / `findSession`, deixando o usuário preso sem e-mail configurado.

## Arquitetura implementada

- Identidade única (`users` + `profiles` + `professional_profiles`).
- Cadastro cria conta **`active`**, `emailVerifiedAt = null`, **sem envio de e-mail**.
- Emite **sessão + cookie** imediatamente.
- Cria **organização** + papel `owner` na mesma transação.
- Persona de onboarding em `profiles.onboardingPersona` (+ CPF, telefone E.164, endereço JSON, aceites).
- Advogado/escritório: `lawyer_profiles` com OAB `informed` e verificação profissional `pending`.
- Parceiros: `partner_profiles`.
- Colaborador: apenas `/convite` (sem autodeclaração).
- Administrador: sem cadastro público.

## Fluxo por persona

| Persona | Destino | Org | Extras |
| --- | --- | --- | --- |
| `client_pf` | `/portal` | pessoal | CPF, nascimento |
| `client_pj` | `/app` | empresa (CNPJ) | declaração de representação |
| `lawyer` | `/app` | escritório pessoal | OAB + UF |
| `law_firm` | `/app` | sociedade | CNPJ + OAB representante |
| `corporate_legal` | `/app` | departamento | CNPJ + declaração |
| `partner_legal` / `partner_service` | `/app` | espaço profissional | categoria |

## Campos

- **Obrigatórios comuns:** nome, e-mail, telefone, endereço, senha (≥12), termos + privacidade.
- **Por persona:** CPF/CNPJ/OAB/org conforme schema `onboardingRegisterSchema`.
- **Opcionais:** nome social, complemento, marketing (desmarcado), descrição/áreas.

## Arquivos principais

- API: `apps/api/src/modules/auth/service.ts`, `routes.ts`
- Sessão: `packages/auth/src/session.ts`
- Validação: `packages/validation/src/onboarding.ts`, `br-documents.ts`
- Schema/migration: `packages/database/src/schema/identity.ts`, `drizzle/0021_onboarding_profile_fields.sql`
- Web: `registration-wizard.tsx`, `registration-wizard.ts`, `cadastro/page.tsx`, `api/address/cep/[cep]/route.ts`
- BFF URL: `apps/web/src/lib/types.ts` (`apiInternalUrl`)

## Migrations

- **0021_onboarding_profile_fields** — colunas de onboarding em `profiles`.
- **Não executar em produção sem autorização.** Em local/testes: migrate via fluxo usual do pacote database.

## Testes executados

| Suite | Resultado |
| --- | --- |
| `apps/api/src/identity.test.ts` | 5 passed |
| `apps/api/src/onboarding-register.test.ts` | 3 passed |
| `packages/validation/src/br-documents.test.ts` | passed |
| `apps/web/src/lib/registration-wizard.test.ts` | passed |
| `tsc` apps/web + apps/api + validation | ok |

Evidências automatizadas: persistência `users.status=active`, `emailVerifiedAt=null`, cookie de sessão no 201, ausência de e-mail de verificação, redirect `/portal` ou `/app`.

## Classificação

| Item | Status |
| --- | --- |
| Cadastro sem e-mail + sessão | **IMPLEMENTADO E TESTADO** (ambiente de teste) |
| Wizard multi-etapa UI | **IMPLEMENTADO NÃO HOMOLOGADO** (browser E2E completo pendente) |
| CPF/CNPJ/telefone/senha | **IMPLEMENTADO E TESTADO** |
| CEP ViaCEP | **IMPLEMENTADO NÃO HOMOLOGADO** (depende de rede) |
| Personas + org + OAB/parceiro | **IMPLEMENTADO E TESTADO** (amostra PF + advogado) |
| Correção `API_INTERNAL_URL` código | **IMPLEMENTADO NÃO HOMOLOGADO** |
| Env Vercel Web `API_INTERNAL_URL` | **PENDENTE** (ops) |
| Migration 0021 em produção | **BLOQUEADO** até autorização |
| Recuperação de senha sem e-mail provider | **PENDENTE** (continua dependente de provider; não há atalho inseguro) |
| Verificação OAB oficial | **PENDENTE** / provider `not_configured` |
| Homologação produção cadastro | **BLOQUEADO** até env + migrate + smoke autorizado |

## Riscos

- Contas sem e-mail verificado aumentam abuso → rate limit de register mantido; ações sensíveis devem continuar exigindo verificação adicional.
- CPF único em `profiles` — colisões tratadas como CONFLICT genérico.
- Declaração de representação PJ **não** verifica poderes legais.

## Implantação

1. Autorizar e aplicar migration `0021` no banco alvo.
2. No projeto **Web** Vercel: `API_INTERNAL_URL=https://api.verasjuris.com` (e opcionalmente `NEXT_PUBLIC_API_URL` HTTPS).
3. Deploy API + Web.
4. Smoke: `POST /api/v1/auth/register` (wizard) → cookie → `/portal` ou `/app`.
5. Confirmar que nenhum e-mail de verificação é exigido.

**Não classificar como pronto para produção** até smoke autorizado no ambiente real.
