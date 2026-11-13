# VerasJuris — Matriz de auditoria funcional (reform/platform-maturity)

Data de referência: 2026-11-11. Branch base: `fix/production-hardening-compilation` → `reform/platform-maturity-a11y-i18n-auth`.

## Inventário

| Escopo | Quantidade / Achado |
| --- | --- |
| Rotas `page.tsx` | 325 |
| Arquivos web com `useLocale`/`t(` | ~55 |
| Arquivos com strings PT hardcoded (amostra Entrar/Painel/…) | ~296 |
| Locales documentados antes | 3 (`pt-BR`, `en-US`, `es-ES`) |
| Lista canônica de 30 idiomas no repositório | **Ausente** (formalizada nesta reformulação) |
| Painel a11y | Presente, mas sync API↔cliente com contratos divergentes |
| Auth pages | `/entrar`, `/cadastro`, `/recuperar-conta`, `/redefinir-senha`, `/verificar-email` |

## Classificação por área

| Área | Status | Evidência / problema |
| --- | --- | --- |
| Homepage pública | PARCIALMENTE FUNCIONAL | Renderiza; texto desatualizado (“ainda não disponível” contradiz módulos existentes); pouco i18n |
| Login / cadastro / reset / verify | PARCIALMENTE FUNCIONAL | APIs reais; UI básica; sem show/hide senha; strings hardcoded; sem aceite de termos no cadastro |
| Sessão / logout / CSRF cookies | FUNCIONAL | Fluxos existentes nos forms/shell |
| OAuth Google/Apple | NÃO IMPLEMENTADO | Não expor botões falsos |
| Painel a11y | PARCIALMENTE FUNCIONAL | Controles locais; PUT remoto usa schema diferente (`fontScalePercent` vs `fontScale`) |
| Skip links / live region | FUNCIONAL | Componentes presentes |
| Seletor de idioma | PARCIALMENTE FUNCIONAL | 3 idiomas; catálogo mínimo; sem RTL |
| i18n integral | NÃO FUNCIONAL | Maioria das telas hardcoded PT |
| Dashboard `/app` | PARCIALMENTE FUNCIONAL | Dados reais de tasks/calendar/deadlines quando há permissão |
| App shell / nav | PARCIALMENTE FUNCIONAL | Labels PT fixos; menu móvel com dialog |
| CRM / casos / docs / agenda / prazos | PARCIALMENTE FUNCIONAL | Rotas + APIs existem; UX/i18n/a11y inconsistentes |
| IA | DEPENDENTE DE SERVIÇO EXTERNO | Provider NOT_CONFIGURED ou OpenAI conforme env |
| Marketplace / portal / control | PARCIALMENTE FUNCIONAL | Superfície ampla; maturidade desigual |
| E-mail transacional | DEPENDENTE DE SERVIÇO EXTERNO | Resend/local memory |
| Storage docs | DEPENDENTE DE SERVIÇO EXTERNO | local/supabase conforme env |
| axe-core automatizado | NÃO IMPLEMENTADO | Apenas nota em docs |
| Responsividade | PARCIALMENTE FUNCIONAL | Shell adapta; muitas tabelas densas |
| Segurança RBAC/LGPD/MFA | FUNCIONAL (preservar) | Não desativar nesta reforma |

Legenda: FUNCIONAL · PARCIALMENTE FUNCIONAL · NÃO FUNCIONAL · NÃO IMPLEMENTADO · DEPENDENTE DE SERVIÇO EXTERNO

## Lotes de correção

| Lote | Foco | Estado |
| --- | --- | --- |
| A | Fundação i18n 30 locales, a11y sync, design tokens, auditoria | Entregue (parcial: cobertura de strings ainda concentrada no chrome/auth) |
| B | Auth UX profissional + i18n | Entregue (forms + páginas; E2E homologação pendente) |
| C | Shell, dashboard, homepage, navegação | Parcial (homepage + shell i18n; dashboard ainda PT em breadcrumbs) |
| D–E | Módulos jurídicos/avançados | Pendente |
| F | Homologação gates + relatório | Em andamento (607 testes locais OK; a11y manual NÃO HOMOLOGADO) |

## Observações de execução

- Nenhuma lista prévia de 30 idiomas foi encontrada em `docs/` ou ADRs; a lista canônica é introduzida no código i18n desta branch.
- Não declarar WCAG AA integral só com axe; testes manuais VoiceOver/NVDA permanecem necessários.
- Conteúdo de usuário/documentos jurídicos **não** é traduzido automaticamente.
