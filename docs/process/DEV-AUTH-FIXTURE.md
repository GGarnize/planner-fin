# Fixture local de autenticação para testes

Use este fluxo somente em ambiente local de desenvolvimento/teste. A fixture prepara uma conta sintética no banco local, mas a autenticação continua passando pela tela real de Login e pelo endpoint real `/auth/login`.

## Comando

```powershell
$env:ALLOW_LOCAL_TEST_SEED = "true"
$env:DATABASE_URL = "postgresql://planner_fin_local:planner_fin_local@localhost:5432/planner_fin_local"
pnpm dev:seed-test-user
```

Credenciais usadas pela automação:

- `PLANNER_FIN_TEST_EMAIL`, default local: `codex.local@planner-fin.test`
- `PLANNER_FIN_TEST_PASSWORD`, default local: `PlannerFinLocal123!`

Não configure essas variáveis com segredos reais.

## Fluxo Android/Codex local

1. Subir PostgreSQL, API e proxy/web local.
2. Executar `pnpm dev:seed-test-user` com `ALLOW_LOCAL_TEST_SEED=true`.
3. Abrir o APK.
4. Usar a tela real de Login.
5. Informar `PLANNER_FIN_TEST_EMAIL` e `PLANNER_FIN_TEST_PASSWORD`.

A automação não deve gravar access token em `localStorage`, navegar diretamente para rota autenticada, criar sessão via Prisma ou chamar `/auth/register` em repetição. O teste deve exercitar `/auth/login`, cookies, refresh, CSRF/bootstrap, auth state e guards reais.

## Guardas

O comando aborta antes de escrever se:

- `NODE_ENV=production`;
- `ALLOW_LOCAL_TEST_SEED` não for `true`;
- `DATABASE_URL` não for PostgreSQL;
- o host do banco não for `localhost`, `127.0.0.1`, `::1` ou `[::1]`;
- o banco não for `planner_fin_local` ou `planner_fin_test`.

O output nunca imprime hash de senha, token, cookie ou segredo.
