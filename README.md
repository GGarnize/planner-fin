# PlannerFin

PlannerFin, um sistema financeiro pessoal em construção. Esta etapa contém somente a fundação técnica de autenticação e isolamento por usuário; não há funcionalidades ou dados financeiros reais.

## Pré-requisitos

- Node.js 22 LTS ou superior.
- pnpm 10 ou superior.
- Docker com Docker Compose para PostgreSQL local.

## Instalação

```bash
pnpm install
```

## Configuração de ambiente

Copie `.env.example` para os arquivos locais usados pelas aplicações quando necessário. O exemplo contém apenas placeholders locais sem segredos reais.

Variáveis principais:

- `DATABASE_URL`: conexão PostgreSQL local usada pelo Prisma da API.
- `API_PORT`: porta da API, padrão `3000`.
- `API_CORS_ORIGIN`: origem local autorizada para a web, padrão `http://localhost:9000`.
- `VITE_API_BASE_URL`: URL base da API consumida pela web, padrão `http://localhost:3000/api`.
- `JWT_SECRET`: chave independente para JWT HS256, com pelo menos 32 bytes.
- `REFRESH_HMAC_SECRET`: chave independente para digest de refresh, com pelo menos 32 bytes.
- `COOKIE_SECURE`: `false` somente no desenvolvimento HTTP local; seguro por padrão.

Os valores do exemplo são sintéticos e não devem ser reutilizados. O access token
fica somente em memória; o refresh usa cookie HttpOnly e proteção CSRF por cookie,
header e origem explícita.

## Banco local

```bash
pnpm db:up
pnpm db:generate
pnpm db:migrate
pnpm db:down
```

O Docker Compose sobe somente PostgreSQL local com volume nomeado e healthcheck. API e web rodam diretamente pelo pnpm.

## Execução

```bash
pnpm dev:api
pnpm dev:web
# ou API e web em paralelo
pnpm dev
```

A API NestJS expõe `GET /api/health` na porta `3000` por padrão e responde exatamente:

```json
{
  "status": "ok",
  "service": "planner-fin-api"
}
```

A web Vue 3 + Quasar roda na porta `9000` por padrão e oferece cadastro, login, restauração de sessão, rota autenticada e logout.

## Qualidade, testes e build

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:unit
pnpm test:e2e
pnpm build
git diff --check
```

Os testes unitários não dependem de banco. A integração real, migrations e E2E completo dependem de PostgreSQL. Os testes Playwright da interface usam API simulada e não substituem a integração real.

## Estrutura do monorepo

```text
apps/
  api/      # API NestJS com autenticação, usuários, Prisma e saúde
  web/      # Web Vue 3 + Quasar com fluxo mínimo de autenticação
packages/
  shared/   # Contrato compartilhado de saúde
  config/   # Constantes técnicas locais compartilháveis
```

## Troubleshooting

- Se a API falhar ao iniciar, confira `DATABASE_URL`, `API_PORT` e `API_CORS_ORIGIN`.
- Se `db:migrate` falhar por conexão, execute `pnpm db:up` e aguarde o healthcheck do PostgreSQL ficar saudável.
- Se a web mostrar `API indisponível`, confirme que a API está ativa em `http://localhost:3000/api/health` ou ajuste `VITE_API_BASE_URL`.

## Rollback

Após merge, reverta o commit da SPEC-000 com `git revert <hash-do-merge>` sem reescrever a história da `main`.
