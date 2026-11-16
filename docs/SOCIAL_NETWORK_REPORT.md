# VerasJuris — Rede social `/explorar` (relatório)

**Data:** 2026-11-16  
**Deploy:** não realizado  
**Migration 0024:** criada; **não aplicar em produção** sem backup e rollback

## 1. Auditoria

| Item | Situação |
|------|----------|
| `/explorar` | Antes: `ExploreSocial` com posts demo + CTAs de login |
| Lab demo | Preservado em `/explorar?view=painel` (`ExploreDemo`) |
| Auth | Sessão opaca existente (`/auth/session`) — sem segundo login |
| Conta | Perfil pessoal/profissional/privacidade continua em `/app/conta` |
| Mensagens | Reuso de `/app/comunicacao` (sem segundo chat) |
| Schema social | **Não existia** — criado do zero |

## 2. Arquitetura

- **PostgreSQL / Drizzle:** `packages/database/src/schema/social.ts`
- **Migration:** `0024_social_network.sql` (+ journal)
- **Validação Zod:** `packages/validation/src/social.ts`
- **API Fastify:** `/v1/social/*` em `apps/api/src/modules/social/{service,routes}.ts`
- **Web:** `apps/web/src/lib/social.ts` + `explore-social.tsx` (layout 3 colunas / mobile bottom nav)

Leituras públicas (feed, trending, post, perfil) usam sessão **opcional**. Escritas exigem autenticação.

## 3. Endpoints

`GET/POST /social/feed|trending|posts|…` conforme plano (likes toggle, comments, reposts, bookmarks, hide, reports, follow, connections, me, notifications).

## 4. Tabelas

`social_profiles`, `social_posts`, `social_post_likes`, `social_comments`, `social_reposts`, `social_bookmarks`, `social_follows`, `social_connections`, `social_hides`, `social_blocks`, `social_reports`, `social_notifications` — com unique constraints de curtida/follow/bookmark/repost.

## 5. UI `/explorar`

- Composer real (texto, categoria, hashtags, visibilidade público/conexões/rascunho)
- Feed com modos: recentes, para você, seguindo, salvos
- Interações: curtir, comentar, republicar, compartilhar (link/nativo), salvar, ocultar, denunciar, excluir próprio
- Abas: Feed, Tendências, Conexões, Notificações, Perfil
- Rail: temas, em alta, atalhos marketplace
- Lab demonstrativo separado e identificado

## 6. Testes

- `apps/api/src/social.test.ts` → **10/10**
- `tsc` web → OK  
- Cobertura API: criar/listar, like toggle, comentário+profundidade, edição alheia bloqueada, delete, follow, conexão, report, bookmark, trending

## 7. Pendências reais

- Upload de imagens/vídeos (storage + processamento) ainda não habilitado
- MFA / exportação LGPD: permanecem no módulo de conta (não duplicados)
- Painel admin de moderação de denúncias (API registra; UI admin limitada)
- Algoritmo “para você” ainda próximo de recentes + score (sem ML)
- i18n completo de todas as strings do composer (chaves principais adicionadas)
- Aplicar migration 0024 em ambientes com backup
- Homologação E2E browser + regressão cadastro/login em staging

## 8. Critério de conclusão

Usuários autenticados publicam com persistência; feed lista conteúdos reais; curtidas/comentários/republicações/salvamentos/seguidores/conexões/denúncias/notificações operam via API; demo de módulos permanece em `?view=`; sem deploy automático.
