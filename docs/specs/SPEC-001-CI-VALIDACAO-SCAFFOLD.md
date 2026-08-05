# SPEC de funcionalidade — `SPEC-001 — Validação contínua do scaffold técnico`

> Esta SPEC autoriza somente uma implementação futura de integração contínua para validar automaticamente o scaffold técnico do PlannerFin. A tarefa que cria este documento é exclusivamente documental e não implementa workflow, código, dependências, banco, migrations ou configuração executável.

## 1. Identificação

| Campo | Valor |
|---|---|
| ID | `SPEC-001` |
| Título | `Validação contínua do scaffold técnico` |
| Responsável | `Codex Cloud` |
| Data de criação | `2026-08-05` |
| Última atualização | `2026-08-05` |
| Tarefa relacionada | `PROMPT-SPEC-001-CI-VALIDACAO-SCAFFOLD.md` |
| Documentos relacionados | `docs/specs/SPEC-000-SCAFFOLD-TECNICO.md`; `docs/adr/ADR-006-ESTRATEGIA-DE-TESTES.md`; `docs/specs/README.md`; `docs/process/GIT-WORKFLOW.md`; `docs/quality/DEFINITION-OF-DONE.md`; `docs/quality/TEST-STRATEGY.md` |

## 2. Status

`Aprovada`

**Aprovada por:** tarefa atual em `2026-08-05`, com aprovação explicitamente autorizada para criar uma SPEC documental que autorize implementação posterior do workflow de CI.

## 3. Contexto

A implementação da `SPEC-000` criou o scaffold técnico inicial do PlannerFin com Node.js mínimo 22, pnpm, Prisma, PostgreSQL local, testes, build e Playwright. Durante a validação no sandbox restaram duas limitações ambientais relevantes: o ambiente executou com Node.js 20, enquanto o projeto exige Node.js 22 ou superior; e o ambiente não possuía Docker/PostgreSQL, impedindo validar `db:up` e migration contra banco real.

Esta SPEC define uma unidade futura para eliminar essas limitações por meio de GitHub Actions, usando ambiente controlado, Node.js 22 e PostgreSQL real como service container efêmero. A implementação futura deverá validar o scaffold em pull requests para `main` e em pushes para `main`, sem deploy, publicação, automação de merge ou credenciais reais.

## 4. Problema

Sem CI versionado, a validação do scaffold depende do ambiente local ou do sandbox do agente. Isso deixa lacunas justamente nos pontos que precisam ser reproduzíveis: versão ativa do Node.js, instalação congelada por lockfile, geração do Prisma, aplicação da migration inicial vazia contra PostgreSQL real, execução do Playwright com Chromium e falha visível quando comandos obrigatórios quebram.

## 5. Objetivo

Definir, de forma verificável, a futura implementação de um workflow principal em `.github/workflows/ci.yml` para validar automaticamente qualidade, build, Prisma, migration com PostgreSQL real e E2E web do scaffold técnico, usando somente variáveis de teste, permissões mínimas e dependências já aprovadas pelo projeto.

## 6. Fora do escopo

- Implementar o workflow nesta tarefa documental.
- Deploy, staging, produção ou publicação de qualquer artefato.
- Publicação na Play Store.
- Publicação de pacote npm ou imagem Docker.
- Renovate, Dependabot, CodeQL, Sonar ou release automática.
- Dockerização da API ou web.
- Merge automático pelo workflow.
- Cobertura mínima percentual.
- Testes de funcionalidades financeiras.
- Módulos financeiros, schema financeiro, entidades Prisma de domínio, autenticação ou autorização funcional.
- Alterações visuais na aplicação.
- Uso de credenciais reais, secrets personalizados ou variáveis de produção.

## 7. Termos

| Termo | Definição adotada nesta SPEC |
|---|---|
| CI | Integração contínua executada no GitHub Actions para validar alterações antes e após merge na `main`. |
| Workflow principal | Arquivo `.github/workflows/ci.yml` que concentra as validações obrigatórias desta SPEC. |
| Service container | Container PostgreSQL efêmero declarado no job do GitHub Actions, exclusivo da execução. |
| Instalação congelada | Instalação com `pnpm install --frozen-lockfile`, sem atualizar `pnpm-lock.yaml`. |
| Migration da SPEC-000 | Migration inicial técnica criada pela implementação da `SPEC-000`, preferencialmente vazia e sem entidade financeira. |

## 8. Comportamento atual

O scaffold possui comandos de qualidade, testes, build, Prisma, banco local e E2E definidos pela `SPEC-000`, mas a validação completa ainda não está automatizada no GitHub Actions. No sandbox da implementação anterior, Node.js 22 e Docker/PostgreSQL real não puderam ser comprovados integralmente.

## 9. Comportamento desejado

### 9.1 Workflow esperado

A implementação futura deverá criar um workflow principal em:

```text
.github/workflows/ci.yml
```

O workflow deverá executar em Ubuntu estável suportado pelo GitHub Actions, com Node.js 22 ativo e pnpm configurado conforme o campo `packageManager` do `package.json` da raiz. A instalação deverá usar cache oficial de pnpm, lockfile congelado e nenhuma atualização de versão como efeito da execução.

### 9.2 Política de execução

O workflow deverá declarar:

- execução em pull requests para `main`;
- execução em pushes para `main`;
- cancelamento de execuções anteriores da mesma branch quando houver novo commit, por `concurrency` ou mecanismo equivalente;
- `permissions: contents: read` ou conjunto mínimo equivalente;
- ausência de secrets personalizados;
- timeout razoável por job;
- logs suficientes para diagnosticar falhas, sem imprimir tokens ou senhas;
- nenhuma etapa de deploy;
- nenhuma publicação de pacote;
- nenhuma publicação de imagem Docker;
- nenhuma automação de merge.

### 9.3 Qualidade e build

A implementação futura deverá executar, a partir da raiz e em instalação limpa:

1. checkout do repositório;
2. ativação/configuração do pnpm conforme `packageManager` da raiz;
3. setup de Node.js 22;
4. instalação com `pnpm install --frozen-lockfile`;
5. `pnpm lint`;
6. `pnpm format:check`;
7. `pnpm typecheck`;
8. `pnpm test:unit`;
9. `pnpm build`;
10. `pnpm db:generate`;
11. `git diff --check` ou validação equivalente aplicável ao checkout.

A validação deverá falhar de forma visível se qualquer comando obrigatório retornar erro. Warnings relevantes não podem ser ignorados silenciosamente.

### 9.4 PostgreSQL e migration

A implementação futura deverá validar PostgreSQL real com service container do job:

- usar imagem PostgreSQL estável e amplamente reconhecida;
- usar banco efêmero exclusivo da execução;
- configurar usuário, banco e senha sintéticos de teste;
- aguardar o banco ficar saudável por healthcheck do service container ou etapa equivalente;
- definir `DATABASE_URL` exclusivamente de teste;
- executar `pnpm db:generate` no fluxo reproduzível;
- executar a migration da `SPEC-000` contra o PostgreSQL real;
- confirmar que a migration vazia é aceita pelo PostgreSQL real;
- confirmar que `prisma generate` e o fluxo de migration são reproduzíveis;
- não criar tabela artificial apenas para o CI.

O comando de migration escolhido para CI deverá ser `prisma migrate deploy`, preferencialmente via script raiz existente ou comando pnpm equivalente não interativo. A decisão é usar `migrate deploy` porque ele aplica migrations versionadas em ambientes automatizados, não tenta criar novas migrations, não abre prompt interativo e reproduz o fluxo esperado para validar arquivos já versionados. `prisma migrate dev` não deve ser usado no CI por ser voltado a desenvolvimento interativo e por poder modificar o estado de migrations.

### 9.5 E2E web

A implementação futura deverá:

- instalar Chromium pelo Playwright com comando compatível com o projeto;
- executar `pnpm test:e2e`;
- manter o teste versionado independente de API real quando essa for a configuração atual do scaffold;
- não alterar silenciosamente o teste E2E para depender de infraestrutura externa;
- registrar como evolução futura um E2E de integração real web → API, sem implementá-lo nesta unidade, salvo se a própria SPEC for revisada e aprovada para exigir esse cenário de forma determinística.

### 9.6 Política de dependências

- `pnpm-lock.yaml` é obrigatório para o workflow.
- A instalação deve usar `--frozen-lockfile`.
- Versões de dependências não podem ser atualizadas como efeito do CI.
- Scripts de build bloqueados pelo pnpm devem ser tratados explicitamente se necessários ao Prisma ou Playwright, com justificativa no PR.
- Dependências novas não estão autorizadas sem necessidade comprovada e aprovada dentro do escopo desta SPEC.

### 9.7 Segurança

A implementação futura deverá garantir:

- permissões mínimas do `GITHUB_TOKEN`, preferencialmente `contents: read`;
- nenhuma credencial real;
- nenhuma variável de produção;
- nenhum secret personalizado;
- banco efêmero exclusivo do job;
- senha sintética de teste;
- nenhuma exposição de tokens em logs;
- actions oficiais ou amplamente reconhecidas, fixadas em versões principais aprovadas pela SPEC, como `actions/checkout@v4`, `actions/setup-node@v4` e action reconhecida para pnpm compatível com o `packageManager`;
- não executar código vindo de origem não confiável com permissões de escrita.

## 10. Personas ou atores

| Ator | Necessidade | Ações autorizadas |
|---|---|---|
| Pessoa desenvolvedora | Receber feedback automático sobre qualidade e build do scaffold. | Abrir PR para `main` e consultar logs do CI. |
| Pessoa revisora | Confiar que Node.js 22, Prisma, PostgreSQL real e E2E foram validados. | Revisar workflow, logs, permissões, riscos e evidências. |
| Agente implementador | Implementar somente a automação aprovada. | Criar `.github/workflows/ci.yml` e ajustes mínimos permitidos. |
| Usuário final | Não aplicável nesta SPEC técnica. | Nenhuma ação de produto final é autorizada. |

## 11. Fluxos

### 11.1 Pull request para main

1. Uma alteração é proposta em pull request direcionado à `main`.
2. O GitHub Actions inicia o workflow principal.
3. Execuções anteriores da mesma branch são canceladas quando houver novo commit.
4. O workflow prepara checkout, Node.js 22, pnpm e cache.
5. O workflow instala dependências com lockfile congelado.
6. O workflow executa qualidade, testes unitários, build, Prisma generate, PostgreSQL/migration e E2E.
7. Qualquer falha aparece no status do PR com logs suficientes para diagnóstico.
8. Nenhuma etapa publica, faz deploy ou merge.

### 11.2 Push para main

1. Um commit chega à `main`.
2. O GitHub Actions executa o mesmo workflow principal ou jobs equivalentes.
3. Falhas ficam visíveis no histórico de checks da branch.
4. Nenhum artefato é publicado e nenhum ambiente externo é alterado.

### 11.3 Falha obrigatória

1. Um comando obrigatório retorna código diferente de zero.
2. O job falha imediatamente ou ao final da etapa correspondente.
3. O log identifica o comando/etapa que falhou sem expor segredos.
4. O status do check fica vermelho no PR ou push.

## 12. Regras de negócio

| ID | Regra | Origem/decisão | Exemplo |
|---|---|---|---|
| `RN-01` | O CI deve validar somente o scaffold técnico. | Tarefa atual e `SPEC-000`. | Não adicionar testes de contas, lançamentos ou faturas. |
| `RN-02` | O CI deve usar Node.js 22. | `SPEC-000` e tarefa atual. | `actions/setup-node` configurado com `node-version: 22`. |
| `RN-03` | O CI deve usar pnpm conforme `packageManager`. | `SPEC-000`. | Não trocar para npm ou yarn. |
| `RN-04` | Instalação deve ser congelada. | Política de dependências. | `pnpm install --frozen-lockfile`. |
| `RN-05` | PostgreSQL deve ser real e efêmero no job. | Limitação ambiental da `SPEC-000`. | Service container com senha sintética. |
| `RN-06` | Migration deve usar comando não interativo. | Política de CI. | Usar `prisma migrate deploy`, não `migrate dev`. |
| `RN-07` | Nenhuma credencial real pode ser usada. | Segurança. | `DATABASE_URL` com usuário e senha de teste. |
| `RN-08` | Workflow não pode fazer deploy, publicação ou merge. | Escopo da tarefa. | Não usar ações de release, registry ou auto-merge. |

## 13. Modelo de dados

Não há alteração de modelo de dados autorizada. A implementação futura não deve criar tabela artificial, entidade Prisma, migration adicional de domínio ou schema financeiro para satisfazer o CI.

A validação de banco deverá usar a migration técnica já versionada pela `SPEC-000` e um PostgreSQL efêmero exclusivo do job. Como o banco é descartável, não há dados persistentes, migração destrutiva ou necessidade de recuperação de dados.

## 14. Contratos de API

Não há novo contrato de API autorizado. O E2E deve respeitar o estado atual do scaffold e não pode introduzir dependência silenciosa de uma API real ou externa. Uma evolução futura poderá definir E2E de integração real web → API em SPEC própria ou revisão aprovada desta SPEC.

## 15. Interface

Não há alteração de interface autorizada. A implementação futura não deve alterar aparência, textos, telas, layout, rotas ou comportamento visual da aplicação web.

## 16. Validações

| Item | Validação | Resultado esperado |
|---|---|---|
| Node.js | Verificar Node.js 22 ativo no workflow. | Logs e setup indicam Node.js 22. |
| pnpm | Usar versão derivada de `packageManager`. | Comandos pnpm executam sem trocar gerenciador. |
| Lockfile | Instalação com `--frozen-lockfile`. | Falha se `pnpm-lock.yaml` estiver ausente ou divergente. |
| Qualidade | `lint`, `format:check`, `typecheck`. | Falha visível em erro de qualidade. |
| Testes unitários | `pnpm test:unit`. | Testes passam sem infraestrutura não declarada. |
| Build | `pnpm build`. | Build passa em Node.js 22. |
| Prisma generate | `pnpm db:generate`. | Prisma Client é gerado de forma reproduzível. |
| PostgreSQL | Service container saudável. | Job só executa migration após banco saudável. |
| Migration | `prisma migrate deploy` via script/command compatível. | Migration versionada aplica em PostgreSQL real. |
| E2E | Chromium instalado e `pnpm test:e2e`. | E2E passa conforme configuração atual. |
| Segurança | Permissões mínimas, sem secrets reais. | Workflow não exige segredos personalizados. |
| Escopo | Sem deploy, publish, imagem Docker ou auto-merge. | Diff do workflow não contém essas etapas. |

## 17. Observabilidade e logs

Os logs do CI deverão ser suficientes para identificar a etapa que falhou, versões principais usadas e comando executado. Logs não devem imprimir tokens, secrets, credenciais reais ou variáveis de produção. A senha sintética do PostgreSQL de teste pode existir em configuração do workflow, mas não deve representar segredo real.

## 18. Acessibilidade

Não aplicável. Esta SPEC não altera interface de usuário. O E2E existente poderá validar carregamento da web, mas não introduz novos requisitos visuais ou de acessibilidade.

## 19. Privacidade e segurança de dados

Não há dados pessoais ou financeiros reais. O CI deverá usar apenas dados técnicos e fictícios, banco efêmero do job e variáveis de ambiente exclusivamente de teste. Nenhuma evidência deverá conter credenciais reais, tokens, dados pessoais ou dados financeiros sensíveis.

## 20. Compatibilidade

O workflow deverá ser compatível com GitHub Actions em Ubuntu estável suportado, Node.js 22 e pnpm conforme `packageManager`. A implementação não deve depender de estado local do agente, remote configurado no sandbox, autenticação por GitHub CLI ou Docker local fora do runner do GitHub Actions.

## 21. Migrações e rollback

A implementação futura não autoriza novas migrations. O workflow deverá aplicar migrations já versionadas com `prisma migrate deploy` contra PostgreSQL efêmero.

O rollback da implementação do workflow deverá ser feito por `git revert <hash-do-commit-ou-merge>`. Como o CI usa banco efêmero exclusivo do job e não publica artefatos, o rollback não exige recuperação de banco persistente, dados de usuário ou ambiente externo.

## 22. Critérios de aceite

### `CA-01 — Pull request para main`

**Dado** um pull request direcionado à `main`
**Quando** o pull request for aberto ou atualizado
**Então** o workflow principal deverá executar automaticamente as validações obrigatórias.

### `CA-02 — Push para main`

**Dado** um push para `main`
**Quando** o commit chegar à branch
**Então** o workflow principal deverá executar automaticamente e registrar o resultado nos checks.

### `CA-03 — Node.js 22 ativo`

**Dado** o workflow em execução
**Quando** o ambiente Node.js for configurado
**Então** a versão ativa deverá ser Node.js 22.

### `CA-04 — Instalação com lockfile congelado`

**Dado** `pnpm-lock.yaml` versionado
**Quando** as dependências forem instaladas
**Então** a instalação deverá usar `pnpm install --frozen-lockfile` e falhar se o lockfile estiver ausente ou divergente.

### `CA-05 — Lint`

**Dado** dependências instaladas
**Quando** `pnpm lint` executar
**Então** o job deverá passar somente se o lint concluir sem erro.

### `CA-06 — Format check`

**Dado** dependências instaladas
**Quando** `pnpm format:check` executar
**Então** o job deverá passar somente se a formatação estiver conforme o padrão do projeto.

### `CA-07 — Typecheck`

**Dado** dependências instaladas
**Quando** `pnpm typecheck` executar
**Então** o job deverá passar somente se a verificação de tipos concluir sem erro.

### `CA-08 — Testes unitários`

**Dado** dependências instaladas
**Quando** `pnpm test:unit` executar
**Então** o job deverá passar somente se os testes unitários concluírem com sucesso.

### `CA-09 — Build`

**Dado** dependências instaladas
**Quando** `pnpm build` executar
**Então** o job deverá passar somente se o build concluir com sucesso.

### `CA-10 — Prisma generate`

**Dado** dependências instaladas e ambiente de teste configurado
**Quando** `pnpm db:generate` executar
**Então** Prisma Client deverá ser gerado de forma reproduzível e sem erro.

### `CA-11 — PostgreSQL saudável`

**Dado** o service container PostgreSQL do job
**Quando** o job iniciar validações de banco
**Então** o banco deverá estar saudável antes da execução da migration.

### `CA-12 — Migration aplicada em banco real`

**Dado** PostgreSQL real e efêmero saudável, com `DATABASE_URL` de teste
**Quando** o fluxo de migration executar com `prisma migrate deploy` ou script raiz equivalente
**Então** a migration versionada da `SPEC-000` deverá aplicar com sucesso, inclusive se for vazia, sem criar tabela artificial apenas para o CI.

### `CA-13 — Playwright E2E`

**Dado** dependências instaladas
**Quando** Chromium for instalado pelo Playwright e `pnpm test:e2e` executar
**Então** os testes E2E versionados deverão passar conforme configuração atual e sem depender silenciosamente de infraestrutura externa.

### `CA-14 — Falha visível em comando obrigatório`

**Dado** qualquer comando obrigatório retornando erro
**Quando** o workflow executar
**Então** o check deverá falhar de forma visível no PR ou push e indicar a etapa responsável nos logs.

### `CA-15 — Ausência de deploy`

**Dado** o workflow versionado
**Quando** o diff for revisado
**Então** não deverá existir etapa de deploy, staging, produção, publicação de pacote ou publicação de imagem Docker.

### `CA-16 — Ausência de secrets reais`

**Dado** o workflow versionado
**Quando** variáveis e configurações forem revisadas
**Então** não deverá haver credenciais reais, secrets personalizados, variáveis de produção ou dados sensíveis.

### `CA-17 — Permissões mínimas`

**Dado** o workflow versionado
**Quando** `permissions` for revisado
**Então** o `GITHUB_TOKEN` deverá usar `contents: read` ou conjunto mínimo equivalente, sem permissão de escrita desnecessária.

### `CA-18 — Cancelamento de execução obsoleta`

**Dado** uma branch com execução em andamento
**Quando** novo commit for enviado para a mesma branch
**Então** a execução anterior obsoleta deverá ser cancelada por configuração de concorrência ou mecanismo equivalente.

## 23. Testes obrigatórios

| Nível | Cenários mínimos | Critérios relacionados | Evidência esperada |
|---|---|---|---|
| Qualidade | `pnpm lint`, `pnpm format:check`, `pnpm typecheck` e `git diff --check` ou equivalente. | `CA-05`, `CA-06`, `CA-07`, `CA-14` | Logs do GitHub Actions e resultado dos checks. |
| Unitário | `pnpm test:unit`. | `CA-08`, `CA-14` | Logs do job com testes aprovados. |
| Build | `pnpm build`. | `CA-09`, `CA-14` | Logs do job com build aprovado. |
| Prisma | `pnpm db:generate` e migration por `prisma migrate deploy` ou script equivalente. | `CA-10`, `CA-12`, `CA-14` | Logs sanitizados com geração e migration aprovadas. |
| Integração com banco | PostgreSQL service container saudável e `DATABASE_URL` de teste. | `CA-11`, `CA-12` | Logs do healthcheck/service e migration aprovada. |
| E2E | Instalação do Chromium pelo Playwright e `pnpm test:e2e`. | `CA-13`, `CA-14` | Logs do Playwright aprovados. |
| Segurança | Revisão do workflow para permissões mínimas e ausência de secrets reais/deploy. | `CA-15`, `CA-16`, `CA-17` | Checklist do PR e revisão do diff. |
| Execução | Gatilhos de PR/push e cancelamento por concorrência. | `CA-01`, `CA-02`, `CA-18` | Configuração YAML e checks observados no GitHub Actions. |

## 24. Arquivos permitidos

Na futura implementação desta SPEC, ficam autorizados somente quando estritamente necessários:

- `.github/workflows/ci.yml`;
- `README.md`, apenas se necessário para documentar o CI;
- ajustes mínimos em scripts existentes quando estritamente necessários para execução não interativa no CI;
- `docs/specs/SPEC-001-CI-VALIDACAO-SCAFFOLD.md`, somente durante esta fase documental atual.

Nesta tarefa documental atual, somente `docs/specs/SPEC-001-CI-VALIDACAO-SCAFFOLD.md` pode ser criado ou alterado.

## 25. Arquivos proibidos

Na futura implementação desta SPEC, não devem ser alterados ou criados:

- módulos financeiros;
- documentos de produto;
- ADRs aprovados;
- schema financeiro;
- novas entidades Prisma;
- migrations adicionais sem necessidade técnica aprovada;
- autenticação;
- deploy;
- infraestrutura de produção;
- secrets;
- arquivos Android/iOS;
- mudanças visuais na aplicação.

Nesta tarefa documental atual, também é proibido alterar código, `.github/workflows/ci.yml`, `package.json`, lockfile, Prisma, `SPEC-000`, ADRs ou documentos de produto.

## 26. Dependências

Não há dependência nova autorizada por esta tarefa documental.

A implementação futura deverá reutilizar pnpm, Node.js 22, Prisma, PostgreSQL e Playwright já definidos pelo scaffold. Dependências novas só poderão ser adicionadas se forem comprovadamente necessárias para execução não interativa do CI, justificadas no PR e restritas ao escopo aprovado.

## 27. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Workflow ficar lento por jobs redundantes. | Média | Feedback mais demorado em PRs. | Definir jobs lógicos claros e timeout razoável. |
| E2E ficar frágil por depender de API real sem contrato aprovado. | Média | Falhas intermitentes. | Manter teste atual independente de API real e registrar integração real como evolução futura. |
| Migration vazia se comportar diferente em ambiente real. | Baixa | Falha de banco no CI. | Validar com PostgreSQL service container e `migrate deploy`. |
| Permissões excessivas no workflow. | Média | Aumento de risco de segurança. | Exigir `contents: read` ou mínimo equivalente. |
| Uso acidental de secret real. | Baixa | Vazamento de credenciais. | Usar somente variáveis sintéticas de teste e revisar logs/diff. |
| Dependências serem atualizadas pelo CI. | Baixa | Build não reproduzível. | Exigir `--frozen-lockfile` e não executar comandos de atualização. |

## 28. Rollback

O rollback da implementação futura deverá ser feito por `git revert <hash-do-commit-ou-merge>` do workflow. Como o CI usará banco PostgreSQL efêmero exclusivo do job, não haverá impacto em banco persistente, dados reais, ambientes externos ou produção.

## 29. Dúvidas

| ID | Dúvida | Impacto | Responsável | Estado |
|---|---|---|---|---|
| `D-01` | O E2E atual deve continuar independente de API real? | Afeta estabilidade do CI. | Implementador da SPEC-001 | Resolvida: manter independente quando essa for a configuração atual; integração real web → API fica como evolução futura. |
| `D-02` | Qual comando de migration usar no CI? | Afeta reprodutibilidade e não interatividade. | Implementador da SPEC-001 | Resolvida: usar `prisma migrate deploy` via script raiz existente ou comando pnpm equivalente. |
| `D-03` | É necessário atualizar README? | Afeta documentação. | Implementador da SPEC-001 | Resolvida: permitido apenas se necessário para documentar o CI. |

Não há dúvida aberta que altere comportamento, escopo, segurança ou dependências no momento da aprovação.

## 30. Decisões aprovadas

| Data | Decisão | Responsável pela aprovação | Consequência |
|---|---|---|---|
| 2026-08-05 | Criar SPEC documental aprovada para autorizar futura validação contínua do scaffold. | Tarefa atual | Permite implementação posterior de CI sem criar workflow nesta unidade. |
| 2026-08-05 | Workflow principal deverá ser `.github/workflows/ci.yml`. | Tarefa atual | Define arquivo principal da futura implementação. |
| 2026-08-05 | Executar em pull requests para `main` e pushes para `main`. | Tarefa atual | Garante validação antes e após merge. |
| 2026-08-05 | Usar Ubuntu estável do GitHub Actions, Node.js 22 e pnpm conforme `packageManager`. | Tarefa atual e `SPEC-000` | Elimina limitação de Node.js 20 do sandbox. |
| 2026-08-05 | Usar instalação com `pnpm install --frozen-lockfile` e cache oficial de pnpm. | Tarefa atual | Garante reprodutibilidade de dependências. |
| 2026-08-05 | Validar PostgreSQL real por service container efêmero. | Tarefa atual | Elimina limitação de ausência de Docker/PostgreSQL no sandbox. |
| 2026-08-05 | Usar `prisma migrate deploy` no CI. | Tarefa atual | Aplica migrations versionadas de forma não interativa. |
| 2026-08-05 | Instalar Chromium pelo Playwright e executar `pnpm test:e2e`. | Tarefa atual e `ADR-006` | Valida E2E web do scaffold. |
| 2026-08-05 | Não fazer deploy, publicação, imagem Docker, secrets personalizados ou automação de merge. | Tarefa atual | Mantém CI restrito à validação. |
| 2026-08-05 | Usar permissões mínimas, preferencialmente `contents: read`. | Tarefa atual | Reduz superfície de risco do workflow. |

## 31. Definition of Done específica

Além da [Definition of Done do projeto](../quality/DEFINITION-OF-DONE.md), a implementação futura desta SPEC estará concluída quando:

- [ ] Workflow válido estiver versionado em `.github/workflows/ci.yml`.
- [ ] Execução real no GitHub Actions usar Node.js 22.
- [ ] Instalação congelada passar.
- [ ] `pnpm lint` passar.
- [ ] `pnpm format:check` passar.
- [ ] `pnpm typecheck` passar.
- [ ] `pnpm test:unit` passar.
- [ ] `pnpm build` passar.
- [ ] `pnpm db:generate` passar.
- [ ] PostgreSQL real do job ficar saudável.
- [ ] Migration for aplicada com sucesso por comando não interativo.
- [ ] Playwright E2E passar.
- [ ] Nenhuma credencial real for usada.
- [ ] Nenhuma etapa de deploy existir.
- [ ] README estiver atualizado quando necessário.
- [ ] Evidência da execução verde estiver registrada no PR.

Para a tarefa documental que cria esta SPEC, a Definition of Done específica é:

- [x] Criar somente `docs/specs/SPEC-001-CI-VALIDACAO-SCAFFOLD.md`.
- [x] Definir status inicial `Aprovada`.
- [x] Não criar `.github/workflows/ci.yml` ainda.
- [x] Não alterar código.
- [x] Não instalar dependências.
- [x] Não alterar `package.json`.
- [x] Não alterar lockfile.
- [x] Não alterar Prisma.
- [x] Não alterar `SPEC-000`.
- [x] Não alterar ADRs ou documentos de produto.
- [x] Executar verificações documentais aplicáveis.
- [x] Registrar resumo, decisões de CI, riscos e dúvidas restantes.

## 32. Histórico de alterações da SPEC

| Data | Alteração | Motivo | Autor | Aprovador, quando aplicável |
|---|---|---|---|---|
| 2026-08-05 | Criação da SPEC-001 aprovada de validação contínua do scaffold técnico. | Autorizar futura implementação de CI para eliminar limitações ambientais da validação da SPEC-000. | Codex Cloud | Tarefa atual |
