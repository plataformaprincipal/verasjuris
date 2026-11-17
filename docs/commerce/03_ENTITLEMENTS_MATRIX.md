# 03 — Matriz de entitlements (2026-09)

Tabela aditiva `commercial_entitlements` (SKU → featureKey/limit). Enforcement pós-pagamento = Fase 3.

| SKU | featureKey | limitType | limitValue |
|---|---|---|---|
| `PLAN_CIDADAO_LIVRE` | `juris_one.public_chat` | boolean | 1 |
| `PLAN_CIDADAO_LIVRE` | `marketplace.browse` | boolean | 1 |
| `PLAN_PROFISSIONAL_LIVRE` | `seats` | count | 1 |
| `PLAN_PROFISSIONAL_LIVRE` | `clients.active` | count | 15 |
| `PLAN_PROFISSIONAL_LIVRE` | `matters.active` | count | 10 |
| `PLAN_PROFISSIONAL_LIVRE` | `processes.monitored` | count | 5 |
| `PLAN_PROFISSIONAL_LIVRE` | `storage.gb` | storage | 2 |
| `PLAN_PROFISSIONAL_LIVRE` | `ai.light_ops_monthly` | credit | 30 |
| `PLAN_CIDADAO_PLUS` | `processes.active` | count | 10 |
| `PLAN_CIDADAO_PLUS` | `storage.gb` | storage | 5 |
| `PLAN_CIDADAO_PLUS` | `ai.credits_monthly` | credit | 500 |
| `PLAN_ESTUDANTE` | `education.tutor` | boolean | 1 |
| `PLAN_ESTUDANTE` | `storage.gb` | storage | 5 |
| `PLAN_ESTUDANTE` | `ai.credits_monthly` | credit | 800 |
| `PLAN_PRO_INDIVIDUAL` | `seats` | count | 1 |
| `PLAN_PRO_INDIVIDUAL` | `processes.active` | count | 200 |
| `PLAN_PRO_INDIVIDUAL` | `processes.monitored` | count | 100 |
| `PLAN_PRO_INDIVIDUAL` | `storage.gb` | storage | 20 |
| `PLAN_PRO_INDIVIDUAL` | `ai.credits_monthly` | credit | 1500 |
| `PLAN_ESSENCIAL` | `seats` | count | 5 |
| `PLAN_ESSENCIAL` | `processes.active` | count | 500 |
| `PLAN_ESSENCIAL` | `processes.monitored` | count | 300 |
| `PLAN_ESSENCIAL` | `storage.gb` | storage | 50 |
| `PLAN_ESSENCIAL` | `ai.credits_monthly` | credit | 5000 |
| `PLAN_PROFISSIONAL` | `seats` | count | 15 |
| `PLAN_PROFISSIONAL` | `processes.active` | count | 2000 |
| `PLAN_PROFISSIONAL` | `processes.monitored` | count | 1000 |
| `PLAN_PROFISSIONAL` | `storage.gb` | storage | 250 |
| `PLAN_PROFISSIONAL` | `ai.credits_monthly` | credit | 15000 |
| `PLAN_AVANCADO` | `seats` | count | 40 |
| `PLAN_AVANCADO` | `processes.active` | count | 6000 |
| `PLAN_AVANCADO` | `processes.monitored` | count | 3000 |
| `PLAN_AVANCADO` | `storage.gb` | storage | 1024 |
| `PLAN_AVANCADO` | `ai.credits_monthly` | credit | 50000 |
| `AI_ASSISTENTE` | `module.AI_ASSISTENTE` | boolean | 1 |
| `AI_PESQUISA` | `module.AI_PESQUISA` | boolean | 1 |
| `AI_JURISPRUDENCIA` | `module.AI_JURISPRUDENCIA` | boolean | 1 |
| `AI_PROCESSO` | `module.AI_PROCESSO` | boolean | 1 |
| `AI_PROVAS` | `module.AI_PROVAS` | boolean | 1 |
| `AI_PECAS` | `module.AI_PECAS` | boolean | 1 |
| `AI_REVISAO` | `module.AI_REVISAO` | boolean | 1 |
| `AI_CONTRATOS` | `module.AI_CONTRATOS` | boolean | 1 |
| `AI_CALCULOS` | `module.AI_CALCULOS` | boolean | 1 |
| `AI_PRAZOS` | `module.AI_PRAZOS` | boolean | 1 |
| `AI_ATENDIMENTO` | `module.AI_ATENDIMENTO` | boolean | 1 |
| `AI_VOZ` | `module.AI_VOZ` | boolean | 1 |
| `AI_BENEFICIOS` | `module.AI_BENEFICIOS` | boolean | 1 |
| `AI_ADMINISTRATIVO` | `module.AI_ADMINISTRATIVO` | boolean | 1 |
| `AI_CARTORIOS` | `module.AI_CARTORIOS` | boolean | 1 |
| `AI_COMPLIANCE` | `module.AI_COMPLIANCE` | boolean | 1 |
| `AI_RISCO` | `module.AI_RISCO` | boolean | 1 |
| `AI_VISION` | `module.AI_VISION` | boolean | 1 |
| `AI_TRADUCAO` | `module.AI_TRADUCAO` | boolean | 1 |
| `AI_ESTUDOS` | `module.AI_ESTUDOS` | boolean | 1 |
| `AI_DUE_DILIGENCE` | `module.AI_DUE_DILIGENCE` | boolean | 1 |
| `AI_JURIMETRIA` | `module.AI_JURIMETRIA` | boolean | 1 |
| `AI_BI` | `module.AI_BI` | boolean | 1 |
| `AI_AGENT` | `module.AI_AGENT` | boolean | 1 |

## Franquias (JSON no metadata)

| SKU | Franquias |
|---|---|
| `PLAN_CIDADAO_LIVRE` | `{"chatLimited":true,"marketplaceBrowse":true,"basicAlerts":true}` |
| `PLAN_PROFISSIONAL_LIVRE` | `{"users":1,"activeClients":15,"cases":10,"monitoredProcesses":5,"storageGb":2,"lightAiOpsMonthly":30,"ownTemplates":5}` |
| `PLAN_CIDADAO_PLUS` | `{"processes":10,"storageGb":5,"creditsMonthly":500}` |
| `PLAN_ESTUDANTE` | `{"studyTutor":true,"simulations":true,"library":true,"storageGb":5,"creditsMonthly":800}` |
| `PLAN_PRO_INDIVIDUAL` | `{"users":1,"activeProcesses":200,"monitoredProcesses":100,"storageGb":20,"creditsMonthly":1500}` |
| `PLAN_ESSENCIAL` | `{"users":5,"processes":500,"monitoredProcesses":300,"storageGb":50,"creditsMonthly":5000}` |
| `PLAN_PROFISSIONAL` | `{"users":15,"processes":2000,"monitoredProcesses":1000,"storageGb":250,"creditsMonthly":15000}` |
| `PLAN_AVANCADO` | `{"users":40,"processes":6000,"monitoredProcesses":3000,"storageGb":1024,"creditsMonthly":50000}` |
| `PLAN_EMPRESARIAL` | `{"users":20,"storageGb":1024,"contracts":true,"vendors":true}` |
| `CREDITS_100` | `{"credits":100,"validityMonths":12}` |
| `CREDITS_500` | `{"credits":500,"validityMonths":12}` |
| `CREDITS_1500` | `{"credits":1500,"validityMonths":12}` |
| `CREDITS_5000` | `{"credits":5000,"validityMonths":12}` |
| `CREDITS_20000` | `{"credits":20000,"validityMonths":12}` |
