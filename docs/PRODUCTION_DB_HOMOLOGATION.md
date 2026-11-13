# Homologação PostgreSQL remoto + preparação Asaas

Data: 2026-11-11  
**Resultado geral: FAIL** (sem evidência de conexão API↔banco de produção; migrations remotas não auditáveis daqui)

Nenhuma migration, seed ou alteração de dados foi executada.

---

## 1. Conexão API ↔ Postgres de produção

| Checagem | Evidência | Resultado |
| --- | --- | --- |
| `GET https://api.verasjuris.com/health` | HTTP **404** `x-vercel-error: NOT_FOUND` | **FAIL** |
| `GET https://api.verasjuris.com/v1/health` | idem NOT_FOUND | **FAIL** |
| BFF `www…/api/v1/health` | HTTP **500** | **FAIL** |
| `/health` com DB ok | App devolveria **200** + `{ database: "ok" }` | não observado |
| `/health` com DB down | App devolveria **503** (ou boot 503) | não observado |
| `.env` local `DATABASE_URL` | apenas `127.0.0.1` (local down) | não é prod |
| Credenciais remotas neste ambiente | ausentes | sem probe SQL remoto |

**Conclusão:** deployment pode estar “Ready” no painel, mas o domínio público da API **não roteia** para o handler Fastify. Sem `/health` real, **não há evidência** de conexão com o Postgres remoto.

Diferença vs auditoria anterior: antes `DEPLOYMENT_NOT_FOUND`; agora `NOT_FOUND` — domínio/projeto existem, porém **rota/função não encontrada**.

---

## 2. Histórico de migrations / pendentes

### Repo (journal)

- **21** migrations: `0000_tricky_retro_girl` … `0020_etapa26_33_platform_hardening`
- Tabelas financeiras relevantes: `payment_intents`, `payment_webhook_events`, `payments`, billing/ledger em `0017`+

### Produção

**Desconhecido** — requer `SELECT` em `drizzle.__drizzle_migrations` no host remoto.

Script **somente leitura** preparado (não altera banco):

```bash
# Com URL de produção injetada no shell (não commitar):
DIRECT_URL='postgresql://…' pnpm --filter @verasjuris/database run db:status
# ou
DATABASE_URL='postgresql://…' pnpm --filter @verasjuris/database run db:status
```

Exit codes: `0` alinhado · `2` pendências · `1` erro de conexão · `3` drift.

---

## 3. Backup recuperável

| Item | Status |
| --- | --- |
| Snapshot/PITR no provedor (Supabase/Neon/etc.) | **NÃO VERIFICADO** (sem acesso ao painel do DB) |
| Evidência de restore testado | **ausente** |

**FAIL / UNKNOWN** até o operador confirmar no provedor: backup automático ativo + ponto de restauração recente.

---

## 4. Auditoria migrate / seed (destrutivo?)

| Artefato | Avaliação |
| --- | --- |
| `packages/database/src/migrate.ts` | Só `drizzle migrate` — **não** há `DROP DATABASE` / `TRUNCATE` / reset |
| `seedReferenceData` | **Idempotente** (insert se ausente); não apaga dados |
| `seedDevelopmentUser` | Cria user só se `SEED_USER_*` preenchidos; **não usar em produção** |
| `assertReferenceData` | Só lê role `owner`; falha o boot se seed não rodou |
| SQL histórico | `ON DELETE cascade` em FKs (normal); em `0006`: `DROP COLUMN status`, `DROP TYPE legal_case_status` (migração de evolução — **já no histórico**, risco se reaplicada em DB parcial) |
| `db:generate` | Não rodar em prod |

**PASS** para o pipeline padrão migrate+seed de referência: não é wipe.  
**Atenção:** não passar `SEED_USER_*` em produção.

---

## 5. Execução segura (preparada — aguardando autorização)

Ordem sugerida **após** `/health` da API responder e backup confirmado:

```bash
# 1) Status somente leitura
DIRECT_URL='…' pnpm --filter @verasjuris/database run db:status

# 2) Backup/snapshot no painel do provedor (manual)

# 3) SOMENTE com autorização explícita:
DIRECT_URL='…' pnpm db:migrate
DATABASE_URL='…' pnpm db:seed
# (seed sem SEED_USER_* → só papéis/permissões)

# 4) Revalidar
curl -i https://api.verasjuris.com/health
# esperar 200 e database ok
```

Gates Asaas a manter: `PAYMENTS_LIVE=0`, `FEATURE_PUBLIC_CHECKOUT=0`.

---

## 6. Asaas / webhook — preparação

| Item | Status |
| --- | --- |
| Testes integração mock | `apps/api/src/asaas-payments.integration.test.ts` — **4 PASS** (1 skip live) |
| Coberturas | provider status, intent Pix+QR metadata, webhook 403, confirm, idempotência `already_processed`, event ids paid≠refunded, factory `PAYMENTS_LIVE` |
| Live sandbox opt-in | `RUN_ASAAS_SANDBOX=1 ASAAS_API_KEY=… pnpm exec vitest run apps/api/src/asaas-payments.integration.test.ts` |
| Rota webhook | `POST https://api.verasjuris.com/v1/webhooks/payments/asaas` + header `asaas-access-token` |
| Pagamentos públicos | **desabilitados** |

Webhook operacional depende da API deixar de retornar `NOT_FOUND`.

---

## Veredito

| Critério | PASS/FAIL |
| --- | --- |
| Conexão real API↔Postgres prod | **FAIL** |
| Migrations pendentes identificadas em prod | **FAIL** (não consultável) |
| Backup recuperável confirmado | **FAIL** / UNKNOWN |
| Scripts auditados (sem wipe) | **PASS** |
| Plano de migrate seguro documentado | **PASS** |
| Banco modificado nesta sessão | **PASS** (nenhuma alteração) |
| Testes Asaas/webhook preparados | **PASS** (mock) |

### Próxima ação operacional exata

1. No projeto Vercel da API: corrigir rotas para o handler (`dist/vercel.cjs` / Root `apps/api`) até `GET /health` deixar de ser `NOT_FOUND`.
2. Confirmar backup no provedor Postgres.
3. Exportar `DIRECT_URL` de produção no shell e rodar `pnpm --filter @verasjuris/database run db:status`.
4. Autorizar explicitamente `db:migrate` + `db:seed` (sem `SEED_USER_*`).
5. Revalidar `/health` e só então configurar webhook Asaas sandbox.
