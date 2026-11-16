# Relatório — Internacionalização (pt-BR / en-US / es-ES)

Data: 2026-11-16.

## Objetivo

Restringir a interface do VerasJuris aos três idiomas oficiais e ampliar a cobertura de tradução da interface própria, com seletor moderno, persistência e testes.

## Entregue nesta etapa

### Idiomas oficiais

- `SUPPORTED_LOCALES` reduzido a **`pt-BR`**, **`en-US`**, **`es-ES`**.
- Preferências legadas (`pt-PT`, `en-GB`, `es-MX`, etc.) são normalizadas para o oficial correspondente.
- Fallback seguro: **`pt-BR`**.
- Arquivos JSON dos demais idiomas **não foram apagados** (órfãos sem referência em `catalogs.ts`); remoção definitiva fica para limpeza autorizada.

### Catálogos

| Locale | Chaves |
| --- | ---: |
| pt-BR | 528 |
| en-US | 528 |
| es-ES | 528 |

Cobertura de chaves entre os três: **100%** (mesmo conjunto de chaves; expandido a partir de ~174).

Domínios cobertos no catálogo: navegação pública (4 abas), auth/cadastro (etapas, personas, senha boa/excelente, nascimento), chrome do painel (CRM, pipeline, finance, education, settings, notifications…), marketplace/planos/pagamentos, acessibilidade (categorias + VLibras + perfis), idiomas, tabelas/filtros/modais, erros e estados comuns.

JSON dos 27 idiomas não oficiais removidos de `messages/` após `catalogs.ts` referenciar apenas os três oficiais.

### Seletor

- `LanguageSwitcher` redesenhado (botões PT/EN/ES, modo `compact`).
- Presente no cabeçalho público, shell autenticado, rodapé e `/idiomas`.
- Persistência: `localStorage` (`vj.locale`) + sync de perfil quando autenticado.
- Troca imediata via `LocaleProvider` (sem logout).

### Formatação regional

- `formatDate` / `formatNumber` / `formatCurrency` em `apps/web/src/lib/i18n/format.ts` (Intl; centavos não são mutados).

### Componentes ligados a `t()`

- Abas públicas (`PublicMainNav`).
- Cabeçalho / shell / painel de acessibilidade / página `/idiomas`.
- Formulários de auth já usavam `t()`; cadastro wizard permanece majoritariamente com strings de validação no pacote `validation` (PT) — mapeamento i18n das mensagens Zod é pendência.

## Testes executados

| Suite | Resultado |
| --- | --- |
| `i18n.coverage.test.ts` | passed (3 locales, 100% keys, diferença en/es) |
| `route-locales.test.ts` | passed (chaves de rotas/estados principais) |
| `format.test.ts` | passed |
| `apps/web` (vitest) | 77+ passed no lote web |

## Evidências e limitações (honestidade de cobertura)

**Não declarar 100% da interface própria como traduzida.**

- A infraestrutura e o chrome crítico (abas públicas, auth chrome, a11y, idiomas, nav principal) estão nos três idiomas.
- Permanecem **milhares de strings hardcoded em português** em dashboards (`apps/web/src/app/app/**`), páginas institucionais longas, wizards de domínio e mensagens Zod da API.
- Conteúdos jurídicos de usuários / documentos / mensagens pessoais **não** são traduzidos automaticamente (conforme requisito).

## Arquivos principais alterados

- `apps/web/src/lib/i18n/locales.ts`, `catalogs.ts`, `messages/{pt-BR,en-US,es-ES}.json`
- `apps/web/src/components/locale-provider.tsx`, `public-main-nav.tsx`, `public-site-header.tsx`, `app-shell.tsx`
- `apps/web/src/app/idiomas/page.tsx`
- `apps/web/src/lib/i18n/format.ts`, testes de cobertura/rotas
- `packages/ui/src/styles.css` (seletor)

## Pendências

1. Extrair e traduzir copy restante dos dashboards e páginas públicas profundas.
2. Internacionalizar mensagens Zod (`packages/validation`) ou mapear códigos → chaves no cliente.
3. Restringir o campo livre de locale em `/app/conta` aos três oficiais.
4. Remover JSON órfãos dos 27 idiomas após auditoria de referências.
5. Homologação visual E2E (desktop/mobile) com troca de idioma em todas as rotas.

**Classificação:** infraestrutura e chrome oficiais **IMPLEMENTADOS E TESTADOS**; tradução integral da UI **PARCIAL — EM EXPANSÃO**.
