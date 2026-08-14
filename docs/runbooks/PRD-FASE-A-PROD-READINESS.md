# PRD Fase A — runtime de produção (SPEC-023)

## Escopo

Este runbook documenta os comandos, variáveis e contratos de produção preparados na Fase A da SPEC-023 (`docs/specs/SPEC-023-DEPLOY-PRD-RAILWAY-ANDROID.md`). Não configura Railway, banco gerenciado, domínio, bucket ou release Android — isso é fase de infraestrutura (Fase B em diante) e requer autorização humana separada.

## Comandos de produção

```powershell
pnpm install --frozen-lockfile
pnpm db:generate
pnpm build:prod
```

`build:prod` builda `@planner-fin/shared`, a API (`nest build`) e o Web com o gate de `VITE_API_BASE_URL` de produção (`apps/web/scripts/validate-prod-web-env.mjs`).

Start (processos separados, cada um em seu próprio shell/serviço):

```powershell
$env:NODE_ENV="production"
pnpm start:api:prod   # node apps/api/dist/main.js, falha claramente se o build estiver ausente
pnpm start:web:prod   # servidor estático mínimo (node:http) servindo apps/web/dist
```

Migration (nunca automática dentro do `start:api:prod`):

```powershell
pnpm db:migrate   # prisma migrate deploy
```

A Fase B deve apontar o Railway para `pnpm db:migrate` como pre-deploy da API e para os comandos acima como build/start dos serviços Web e API.

## Variáveis de ambiente PRD

| Variável | Obrigatória em PRD | Regra |
|---|---|---|
| `NODE_ENV` | Sim | Exatamente `production`; ativa os guards de produção. |
| `PORT` | Sim (API) | Injetada pelo Railway; tem prioridade sobre `API_PORT` em produção. |
| `API_HOST` | Não | Se ausente, bind padrão `0.0.0.0` em produção. |
| `DATABASE_URL` | Sim | PostgreSQL; não pode apontar a host local nem banco sintético (`planner_fin_local`, `planner_fin_test`, `planner_fin_spec022_*`). |
| `API_CORS_ORIGINS` | Sim | Lista exata de origens HTTPS; `https://localhost` (Android WebView) é a única exceção documentada a HTTPS-only. |
| `API_CROSS_SITE_ORIGINS` | Não | Subconjunto de `API_CORS_ORIGINS` que deve receber cookies `SameSite=None; Secure` (hosts cross-site); default preserva o comportamento atual (`https://localhost`). Ajustar somente após teste real dos hosts Railway (Fase C). |
| `JWT_SECRET` / `REFRESH_HMAC_SECRET` | Sim | Fortes, independentes, sem placeholder. |
| `COOKIE_SECURE` | Não | Não pode ser `false` em produção. |
| `ALLOW_LOCAL_TEST_SEED` | Não | Não pode ser `true` em produção. |
| `VITE_API_BASE_URL` | Sim (build Web/Android) | HTTPS, termina em `/api`, rejeita localhost/127.0.0.1/10.0.2.2/192.168.\*. |

Qualquer violação acima faz `loadApiConfig()` (API) ou `build:prod`/carregamento do módulo `auth.ts` (Web) falharem fechado antes de aceitar tráfego.

## Health e readiness

| Caminho | Uso | Contrato |
|---|---|---|
| `GET /api/health` | Liveness | Sempre `{status:'ok', service:'planner-fin-api'}`, sem tocar banco. |
| `GET /api/health/ready` | Readiness | `SELECT 1` via Prisma com timeout curto; 200 se ok, 503 (`DB_UNAVAILABLE`) se não, sem DSN/stack trace. |
| `GET /health` (Web) | Healthcheck Railway do serviço Web | 200 sem depender da SPA/arquivo em disco. |

Recomendação de healthcheck Railway: API em `/api/health/ready` (prova banco antes de promover deploy), Web em `/health`.

## Smoke local de produção

Sem Railway, com Postgres local via Docker:

```powershell
pnpm db:up
$env:NODE_ENV="production"
$env:PORT="3000"
$env:DATABASE_URL="postgresql://planner_fin_local:planner_fin_local@localhost:5432/planner_fin_local"
$env:API_CORS_ORIGINS="https://web.local.test"
$env:JWT_SECRET="<secret sintético >=32 bytes>"
$env:REFRESH_HMAC_SECRET="<secret sintético diferente >=32 bytes>"
pnpm db:migrate
pnpm start:api:prod   # em um shell

$env:VITE_API_BASE_URL="https://api.local.test/api"
pnpm build:prod
$env:PORT="4000"
pnpm start:web:prod   # em outro shell

pnpm smoke:prod       # em um terceiro shell; usa SMOKE_API_BASE_URL/SMOKE_WEB_BASE_URL se as portas forem diferentes
```

`smoke:prod` valida liveness, readiness (banco real), health do Web, fallback de SPA e 404 de asset ausente.

## Troubleshooting

| Sintoma | Verificação |
|---|---|
| `start:api:prod` falha imediatamente | Build ausente (`pnpm --filter @planner-fin/api build`) ou env insegura (guard PRD); a mensagem de erro identifica a causa. |
| `readiness` retorna 503 | Banco indisponível ou schema não migrado; rode `pnpm db:migrate`. |
| Web retorna 404 em rota client-side | Confirme que a rota não começa com `/assets/`; fallback SPA só se aplica fora de `/assets/`. |
| Login Web falha em produção | Verifique se os hosts Web/API são cross-site (Fase C); se forem, `API_CROSS_SITE_ORIGINS` precisa incluir a origem Web. |
| Build web:prod falha | `VITE_API_BASE_URL` ausente, HTTP, sem sufixo `/api` ou apontando a host local/LAN. |

## Rollback

Reverta o commit desta Fase A com `git revert <commit>`. Não há migration destrutiva nem dado real envolvido; nenhuma infraestrutura Railway foi criada por esta unidade.
