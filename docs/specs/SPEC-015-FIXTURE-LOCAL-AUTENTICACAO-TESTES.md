# SPEC de manutenção — `SPEC-015 — Fixture local de autenticação para testes`

| Campo | Valor |
|---|---|
| Status | `Aprovada` |
| Título | `Fixture local de autenticação para testes automatizados` |
| Tarefa relacionada | `PROMPT-DEV-AUTH-FIXTURE-LOCAL-CODEX.md` |
| Data | `2026-08-12` |

## Aprovação

**Aprovada por:** tarefa `PROMPT-DEV-AUTH-FIXTURE-LOCAL-CODEX.md`, em `2026-08-12`, que autoriza criar tooling local determinístico para preparar uma conta sintética de teste sem alterar o fluxo real de autenticação.

## Objetivo

Disponibilizar um comando local, determinístico, idempotente e seguro para garantir uma credencial válida no banco local de desenvolvimento/teste. A automação Codex, Playwright e Android local deve autenticar pela tela real de Login e pelo endpoint real `/auth/login`, sem chamar cadastro repetidamente.

## Escopo

- Comando de desenvolvimento para criar ou atualizar um único usuário sintético.
- Guardas obrigatórias contra execução em produção, banco remoto e ausência de autorização explícita.
- Reuso do hash de senha real do domínio.
- Documentação do fluxo curto de validação local.
- Testes automatizados do tooling.

## Fora de Escopo

- Endpoint HTTP especial, rota `/dev-login`, token fixo, JWT fixo, bypass de senha, header secreto, query param de bypass ou fallback de autenticação.
- Alteração em rate limits, cadastro, login, refresh, CSRF, cookies, guards ou runtime web/Android.
- Migration de banco.
- Dados financeiros, UX de lançamentos, setup inicial ou refatorações não relacionadas.

## Regras

- `NODE_ENV` não pode ser `production`.
- `ALLOW_LOCAL_TEST_SEED=true` é obrigatório.
- `DATABASE_URL` deve usar PostgreSQL, host local aprovado e banco de desenvolvimento/teste aprovado.
- Hosts locais aprovados: `localhost`, `127.0.0.1`, `::1` e `[::1]`.
- Bancos aprovados: `planner_fin_local` e `planner_fin_test`.
- A fixture deve gravar apenas `User`; não deve criar `Session`, token, cookie ou segredo.
- O e-mail e a senha devem vir de `PLANNER_FIN_TEST_EMAIL` e `PLANNER_FIN_TEST_PASSWORD`, com defaults sintéticos somente para desenvolvimento local.

## Critérios de Aceite

- O comando falha sem escrever quando qualquer guarda falhar.
- A primeira execução cria a conta sintética.
- Execuções repetidas atualizam a mesma conta, sem duplicar usuário.
- A senha gravada passa pelo verificador Argon2 real usado pelo login.
- O output não imprime hash, token, cookie ou segredo.
- A documentação orienta a automação a passar por `/auth/login`, cookies, refresh, CSRF/bootstrap, auth state e guards reais.

## Testes Obrigatórios

- Recusa em `production`.
- Recusa contra banco não local.
- Recusa sem flag explícita.
- Primeira execução cria.
- Segunda execução é idempotente.
- Senha resultante funciona com o verificador Argon2 real.
- Não cria sessão/token e não duplica usuário.

## Arquivos Autorizados

- `docs/specs/README.md`
- `docs/specs/SPEC-015-FIXTURE-LOCAL-AUTENTICACAO-TESTES.md`
- `docs/process/DEV-AUTH-FIXTURE.md`
- `package.json`
- `apps/api/package.json`
- `apps/api/src/dev/seed-test-user.ts`
- `apps/api/src/dev/seed-test-user.spec.ts`
