# SPEC de funcionalidade — `SPEC-000 — Scaffold técnico inicial`

> Esta SPEC autoriza somente a futura implementação do scaffold técnico inicial. A tarefa que cria este documento é exclusivamente documental e não implementa código, dependências, banco, Docker, CI ou configuração executável.

## 1. Identificação

| Campo | Valor |
|---|---|
| ID | `SPEC-000` |
| Título | `Scaffold técnico inicial` |
| Responsável | `Codex Cloud` |
| Data de criação | `2026-08-05` |
| Última atualização | `2026-08-05` |
| Tarefa relacionada | `PROMPT-SPEC-000-SCAFFOLD-TECNICO.md` |
| Documentos relacionados | `docs/adr/README.md`; `docs/adr/ADR-001-ARQUITETURA-GERAL.md`; `docs/adr/ADR-002-APLICACAO-CLIENTE.md`; `docs/adr/ADR-003-BACKEND.md`; `docs/adr/ADR-004-PERSISTENCIA-E-ACESSO-A-DADOS.md`; `docs/adr/ADR-005-ORGANIZACAO-DO-REPOSITORIO.md`; `docs/adr/ADR-006-ESTRATEGIA-DE-TESTES.md`; `docs/product/VISION.md`; `docs/product/SCOPE.md`; `docs/product/PRODUCT-PRINCIPLES.md`; `docs/specs/README.md`; `docs/specs/templates/FEATURE-SPEC-TEMPLATE.md`; `docs/process/GIT-WORKFLOW.md`; `docs/quality/DEFINITION-OF-DONE.md`; `docs/quality/TEST-STRATEGY.md` |

## 2. Status

`Aprovada`

**Aprovada por:** tarefa atual em `2026-08-05`, com decisão funcional e arquitetural explicitamente autorizada pela solicitação e pelos ADRs aprovados.

## 3. Contexto

O PlannerFin já possui visão de produto, escopo inicial, princípios, processo SDD, Definition of Done, estratégia de testes e ADRs técnicos aprovados. As decisões vigentes orientam um produto financeiro pessoal, online-first, com aplicação cliente separada da API, backend em monólito modular, persistência relacional, testes determinísticos e monorepo pnpm simples.

Esta SPEC define a próxima unidade de implementação: criar somente o scaffold técnico inicial necessário para sustentar entregas futuras. A implementação futura deverá produzir uma base executável mínima, sem funcionalidades financeiras, sem autenticação funcional e sem antecipar regras de domínio.

## 4. Problema

O repositório ainda não possui monorepo executável, aplicações `api` e `web`, pacotes compartilhados, ambiente local de banco, comandos centralizados ou verificações automatizadas. Sem uma SPEC aprovada, a implementação do scaffold poderia introduzir escolhas implícitas, dependências não justificadas, módulos financeiros prematuros ou infraestrutura fora do estágio inicial.

## 5. Objetivo

Definir de forma verificável a futura implementação de um monorepo pnpm com TypeScript, NestJS, Vue 3, Quasar, PostgreSQL local via Docker Compose, Prisma no backend, pacotes `shared` e `config`, scripts centralizados, documentação técnica e testes mínimos para validar que a API, a web, o contrato técnico compartilhado e o banco local estão preparados para evoluções posteriores.

## 6. Fora do escopo

- Autenticação, autorização funcional, cadastro de usuários reais, sessões ou recuperação de acesso.
- Contas financeiras, categorias, lançamentos, transferências, cartões, faturas, dívidas, orçamento, recorrências, notificações, dashboards financeiros ou qualquer tela financeira.
- Movimentação de dinheiro, recurso bancário regulado ou aconselhamento financeiro automatizado.
- Importação ou exportação de PDF, CSV, OFX, OCR ou arquivos financeiros.
- IA, categorização assistida, detecção de anomalias ou automações financeiras.
- Publicação na Play Store, geração do projeto Android ou configuração Capacitor definitiva.
- Hospedagem, ambientes de produção, arquivos de produção, CI/CD, Nginx, observabilidade externa, serviços pagos ou credenciais reais.
- Microserviços, Redis, filas, Nx, Turborepo ou outra camada de orquestração não aprovada.
- Conteinerização da API ou da web nesta etapa; somente PostgreSQL local deve usar Docker Compose.
- Alteração de documentos AS-IS, documentos de produto, ADRs aprovados, SPECs anteriores, arquivos de processo ou documentos de qualidade.

## 7. Termos

| Termo | Definição adotada nesta SPEC |
|---|---|
| Scaffold técnico | Estrutura inicial executável com apps, pacotes, configurações, ambiente local, comandos, documentação e testes mínimos para desenvolvimento. |
| Monorepo pnpm simples | Repositório com `pnpm-workspace.yaml`, scripts centralizados na raiz e workspaces, sem Nx, Turborepo ou ferramenta equivalente. |
| API | Aplicação NestJS em `apps/api`, responsável nesta etapa apenas por inicialização técnica, configuração, Prisma e endpoint de saúde. |
| Web | Aplicação Vue 3 + Quasar em `apps/web`, responsável nesta etapa apenas por página técnica inicial e consulta ao endpoint de saúde. |
| Shared | Pacote `packages/shared` contendo somente contratos realmente usados entre API e web. |
| Config | Pacote `packages/config` contendo configurações técnicas compartilháveis quando houver benefício concreto. |
| Contrato de saúde | Tipo TypeScript compartilhado que define a resposta JSON do endpoint `GET /health`. |

## 8. Comportamento atual

O repositório contém documentação e decisões aprovadas, mas não contém `package.json`, workspace pnpm, aplicações executáveis, Docker Compose, Prisma, migrations, `.env.example`, scripts de desenvolvimento, lint, formatação, typecheck, testes automatizados ou build. O PR `#10` está presente no histórico local como mesclado na base usada para esta SPEC.

## 9. Comportamento desejado

### 9.1 Estrutura geral

A futura implementação deverá criar um monorepo pnpm simples com esta estrutura principal:

```text
apps/
  api/
  web/

packages/
  shared/
  config/
```

A raiz deverá conter scripts centralizados para desenvolvimento, qualidade, testes, build e banco local. Todos os workspaces executáveis deverão usar TypeScript com configuração strict.

### 9.2 Versões e dependências

- Node.js mínimo: `22 LTS` ou versão LTS estável superior compatível no momento da implementação.
- pnpm mínimo: `10` ou versão estável superior compatível no momento da implementação.
- Política de versões: usar versões estáveis e compatíveis no momento da implementação, com ranges controlados conforme padrão gerado pelas ferramentas oficiais ou definido no `package.json`; não pesquisar nem instalar versões durante a criação desta SPEC documental.
- Dependências novas são aprovadas somente para cumprir esta SPEC: NestJS, Vue 3, Quasar, TypeScript, Prisma, PostgreSQL client necessário ao Prisma, ESLint, Prettier, Vitest ou ferramenta compatível, Playwright e utilitários estritamente necessários ao scaffold.
- Não adicionar dependências para funcionalidades financeiras, autenticação real, filas, Redis, microserviços, telemetria externa, CI/CD ou produção.

### 9.3 API

Criar aplicação NestJS em `apps/api` com:

- TypeScript;
- adaptador HTTP padrão do NestJS;
- estrutura modular inicial, sem módulo de domínio financeiro;
- prefixo global de API `/api`;
- porta padrão `3000`, configurável por variável de ambiente;
- CORS local habilitado apenas para a origem da web local, por padrão `http://localhost:9000`;
- configuração por variáveis de ambiente;
- validação de ambiente no startup, falhando de forma explícita quando variável obrigatória estiver inválida ou ausente;
- encerramento gracioso;
- logging básico de inicialização e erros técnicos, sem segredos;
- endpoint `GET /api/health`;
- resposta JSON tipada usando contrato de `packages/shared`;
- nenhum endpoint financeiro;
- nenhuma autenticação real.

Formato exato do `GET /api/health`:

```json
{
  "status": "ok",
  "service": "planner-fin-api"
}
```

Campos adicionais são proibidos nesta etapa para manter o contrato mínimo e evitar vazamento acidental de informações de ambiente.

### 9.4 Web

Criar aplicação Vue 3 + Quasar em `apps/web` com:

- TypeScript;
- porta padrão `9000`, configurável pelo modo de desenvolvimento escolhido;
- layout responsivo mínimo;
- página inicial técnica exibindo o nome `PlannerFin`;
- consulta ao endpoint de saúde da API, usando URL configurada por variável de ambiente e padrão local compatível com `http://localhost:3000/api`;
- estados visíveis: carregando, API disponível e API indisponível;
- uso do contrato compartilhado de saúde em `packages/shared`;
- nenhuma tela financeira;
- nenhuma autenticação;
- nenhuma configuração Capacitor definitiva;
- compatibilidade preservada para adoção futura do Capacitor, sem gerar projeto Android nesta etapa.

### 9.5 Shared

Criar `packages/shared` com responsabilidade inicial restrita a contratos compartilhados realmente usados. Nesta SPEC, o pacote deve conter o tipo do retorno do endpoint de saúde e, se necessário, constantes técnicas associadas ao contrato.

O pacote não deve conter pacote genérico de utilitários, regras financeiras, validações de domínio financeiro, dados de exemplo financeiros ou abstrações sem uso real. O pacote pode começar mínimo, mas não pode ser omitido silenciosamente; caso a implementação proponha conteúdo ainda menor que o contrato de saúde, a justificativa deve constar na entrega e na revisão.

### 9.6 Config

Criar `packages/config` para configurações compartilháveis de TypeScript, lint ou formatação quando houver benefício concreto. O pacote deve permanecer mínimo e não deve criar abstrações prematuras. Se parte da configuração ficar diretamente na raiz por simplicidade, a existência e responsabilidade do pacote `config` ainda devem ser documentadas e justificadas.

### 9.7 Persistência

A futura implementação deverá configurar PostgreSQL e Prisma no backend:

- PostgreSQL como banco principal;
- Prisma dentro de `apps/api`, com schema localizado em `apps/api/prisma/schema.prisma`;
- conexão configurada por `DATABASE_URL`;
- `.env.example` sem credenciais reais;
- primeira migration somente estrutural;
- nenhuma entidade financeira;
- migrations aplicadas nunca devem ser editadas;
- incluir somente o mínimo técnico necessário para validar configuração, conexão e fluxo de migration.

Decisão explícita sobre a primeira migration: preferir não criar tabela artificial. A implementação deve usar um schema Prisma sem modelos de negócio e gerar uma migration inicial vazia ou estritamente estrutural se o Prisma suportar esse fluxo de forma reproduzível. Se a ferramenta exigir uma estrutura concreta para validar migration no ambiente escolhido, a implementação poderá criar uma tabela técnica mínima, sem dados financeiros e sem representar usuário ou domínio, desde que justifique a necessidade no PR e mantenha a tabela claramente técnica.

### 9.8 Ambiente local

Definir ambiente local simples:

- PostgreSQL executado por Docker Compose;
- API e web executadas diretamente pelo pnpm;
- não exigir WSL;
- não exigir Nginx;
- `docker-compose.yml` somente para infraestrutura local do PostgreSQL;
- `.env.example` com variáveis necessárias e sem segredo real;
- volumes nomeados para dados locais;
- healthcheck do PostgreSQL;
- comandos claros para iniciar e parar a infraestrutura;
- não conteinerizar API e web nesta primeira etapa.

### 9.9 Qualidade

A futura implementação deve configurar e executar:

- ESLint;
- Prettier;
- TypeScript strict;
- verificação de tipos;
- testes automatizados;
- build;
- `git diff --check`;
- nenhum erro ou warning relevante pode ser ignorado silenciosamente.

Warnings de ferramenta só poderão permanecer se forem não bloqueantes, justificados explicitamente na entrega e não representarem risco de segurança, correção, compatibilidade ou manutenção.

### 9.10 Scripts da raiz

A raiz deverá oferecer scripts com nomes finais iguais ou equivalentes a:

| Script | Finalidade |
|---|---|
| `dev` | Iniciar API e web em desenvolvimento, sem iniciar banco implicitamente se isso ocultar falhas de infraestrutura. |
| `dev:api` | Iniciar somente a API. |
| `dev:web` | Iniciar somente a web. |
| `build` | Construir todos os workspaces aplicáveis. |
| `lint` | Executar lint. |
| `format` | Aplicar formatação. |
| `format:check` | Verificar formatação. |
| `typecheck` | Executar TypeScript typecheck. |
| `test` | Executar testes automatizados aplicáveis sem depender de infraestrutura externa, salvo indicação documentada. |
| `test:unit` | Executar testes unitários e de componentes. |
| `test:e2e` | Executar Playwright. |
| `db:up` | Subir PostgreSQL local via Docker Compose. |
| `db:down` | Parar PostgreSQL local via Docker Compose. |
| `db:migrate` | Executar migrations Prisma no backend. |
| `db:generate` | Gerar Prisma Client no backend. |

Os nomes exatos podem ser refinados apenas se preservarem execução clara dos principais fluxos a partir da raiz e forem documentados no README.

### 9.11 Documentação técnica

A implementação futura deverá criar ou atualizar `README.md` da raiz com:

- pré-requisitos;
- instalação;
- configuração de ambiente;
- execução;
- banco local;
- testes;
- build;
- estrutura do monorepo;
- troubleshooting mínimo;
- indicação explícita de que não há funcionalidades financeiras nesta etapa.

## 10. Personas ou atores

| Ator | Necessidade | Ações autorizadas |
|---|---|---|
| Pessoa desenvolvedora | Preparar ambiente local previsível. | Instalar dependências, subir banco, iniciar API/web e rodar verificações. |
| Agente implementador | Implementar somente o scaffold aprovado. | Criar arquivos permitidos, configurar ferramentas e registrar evidências. |
| Pessoa revisora | Verificar aderência aos ADRs e ausência de escopo indevido. | Revisar diff, comandos, riscos, rollback e critérios de aceite. |
| Usuário final | Não aplicável nesta SPEC técnica. | Nenhuma ação de produto final é autorizada. |

## 11. Fluxos

### 11.1 Fluxo principal

1. A pessoa desenvolvedora instala Node.js e pnpm nas versões mínimas definidas.
2. A pessoa desenvolvedora instala dependências a partir da raiz.
3. A pessoa desenvolvedora copia `.env.example` para os arquivos locais necessários, sem versionar segredos reais.
4. A pessoa desenvolvedora sobe PostgreSQL via script raiz.
5. A pessoa desenvolvedora executa geração e migration do Prisma a partir da raiz.
6. A pessoa desenvolvedora inicia a API pela raiz e valida `GET /api/health`.
7. A pessoa desenvolvedora inicia a web pela raiz.
8. A web consulta a API e apresenta estado disponível ou indisponível conforme o resultado.
9. A pessoa desenvolvedora executa lint, format check, typecheck, testes, E2E, build e `git diff --check`.
10. A pessoa revisora confirma que não há funcionalidade financeira, segredo, dado real ou arquivo proibido.

### 11.2 Fluxos alternativos e exceções

- API indisponível durante uso da web → a página deve mostrar estado `API indisponível` sem quebrar a aplicação.
- PostgreSQL indisponível → scripts de migration ou validação de conexão devem falhar de forma explícita; testes sem banco devem continuar diferenciados dos testes que exigem infraestrutura.
- Variável de ambiente inválida → API deve falhar no startup com mensagem técnica sanitizada.
- Dependências ausentes → scripts devem orientar indiretamente pela falha padrão da ferramenta; README deve orientar instalação.
- Necessidade de tabela técnica no Prisma → permitido somente se justificado por limitação concreta do fluxo de migration sem modelos.
- Warning relevante em lint, typecheck, testes ou build → deve ser tratado; não pode ser ignorado silenciosamente.

## 12. Regras de negócio

| ID | Regra | Origem/decisão | Exemplo |
|---|---|---|---|
| `RN-01` | Nenhuma funcionalidade financeira pode ser implementada nesta SPEC. | Tarefa atual, produto e ADRs. | Não criar conta, lançamento, fatura, dívida, orçamento ou cálculo financeiro. |
| `RN-02` | O monorepo deve usar pnpm workspace simples, sem Nx e sem Turborepo. | `ADR-005`. | Criar `pnpm-workspace.yaml`; não criar `nx.json` ou `turbo.json`. |
| `RN-03` | A API deve usar NestJS, TypeScript e adaptador HTTP padrão. | `ADR-003`. | Não trocar para Fastify sem nova decisão. |
| `RN-04` | A web deve usar Vue 3, Quasar e TypeScript. | `ADR-002`. | Não substituir por React, Angular, Flutter ou Ionic. |
| `RN-05` | PostgreSQL e Prisma devem ser configurados sem modelo financeiro. | `ADR-004`. | Schema Prisma inicial sem `Account`, `Transaction`, `Invoice` ou equivalentes. |
| `RN-06` | Shared deve conter somente contratos realmente usados. | `ADR-005`. | Tipo `HealthResponse`; não criar pacote genérico de utilitários. |
| `RN-07` | API e web não devem ser conteinerizadas nesta etapa. | Tarefa atual. | Docker Compose sobe somente PostgreSQL local. |
| `RN-08` | Dados de teste devem ser fictícios e, preferencialmente, técnicos e não financeiros. | `ADR-006` e `TEST-STRATEGY`. | Testes usam status de saúde, não extratos ou valores reais. |

## 13. Modelo de dados

Não há modelo de dados de domínio autorizado.

Para Prisma, a implementação deve criar apenas a configuração técnica mínima. A decisão preferencial é não criar tabela artificial e usar migration inicial vazia ou estrutural quando suportado. Se uma tabela técnica mínima for indispensável para validar migration, ela deve:

| Entidade | Campo | Tipo conceitual | Obrigatório | Regra |
|---|---|---|---|---|
| Tabela técnica mínima, se indispensável | Identificador técnico | Texto ou identificador gerado | Sim | Não pode representar usuário, conta financeira, lançamento, categoria, saldo, fatura, dívida, orçamento ou dado pessoal. |

Qualquer entidade financeira é proibida nesta SPEC.

## 14. Contratos de API

### `GET /api/health`

- Entrada: requisição HTTP `GET` sem corpo.
- Saída de sucesso: HTTP `200` com `Content-Type: application/json` e corpo exato abaixo, tipado por `packages/shared`:

```json
{
  "status": "ok",
  "service": "planner-fin-api"
}
```

- Erros: indisponibilidade técnica da aplicação resulta em erro HTTP/conexão padrão do ambiente; não há erro de negócio.
- Autorização: pública no ambiente local, pois não expõe dados sensíveis.
- Idempotência: idempotente, sem efeitos persistentes.
- Versionamento: endpoint sob prefixo `/api`; alterações futuras do contrato exigem SPEC própria ou revisão aprovada.

Nenhum outro contrato de API é autorizado.

## 15. Interface

A web deve apresentar uma página inicial técnica com:

- nome `PlannerFin`;
- indicação de que o scaffold técnico está ativo;
- estado `carregando` enquanto consulta a API;
- estado `API disponível` quando `GET /api/health` retorna o contrato esperado;
- estado `API indisponível` quando a consulta falha ou retorna contrato inválido;
- layout responsivo mínimo para telas desktop e móveis;
- ausência de menus, formulários, totais, cartões financeiros, gráficos financeiros ou textos que sugiram funcionalidade de produto já pronta.

## 16. Validações

| Campo ou ação | Validação | Mensagem/resultado esperado |
|---|---|---|
| Variáveis da API | Validar porta, `DATABASE_URL` e origens CORS locais no startup. | API inicia somente com configuração válida e falha com erro sanitizado caso contrário. |
| Variável da web para API | URL base da API deve ser configurável. | Web consulta a API local correta ou exibe indisponibilidade. |
| Contrato de saúde | Resposta deve conter apenas `status: "ok"` e `service: "planner-fin-api"`. | Teste falha se houver campo ausente, valor inválido ou campo extra relevante. |
| Prisma | `db:generate` e `db:migrate` devem executar a partir da raiz. | Client gerado e migration aplicada sem editar migrations já aplicadas. |
| Lint/typecheck/build | Comandos raiz devem cobrir workspaces aplicáveis. | Conclusão sem erros nem warnings relevantes ignorados. |
| Segredos | `.env.example` deve conter placeholders, não credenciais reais. | Revisão do diff não encontra segredo, token ou dado real. |

## 17. Permissões

| Ação | Ator autorizado | Condição | Comportamento quando negado |
|---|---|---|---|
| Consultar `GET /api/health` local | Qualquer pessoa com acesso ao ambiente local. | Endpoint não expõe dados sensíveis. | Não aplicável nesta etapa. |
| Acessar página técnica local | Qualquer pessoa com acesso ao ambiente local. | Web em execução. | Não aplicável nesta etapa. |
| Acessar dados financeiros | Nenhum ator. | Funcionalidade inexistente. | Não deve existir endpoint, tela ou dado financeiro. |
| Executar migration destrutiva | Nenhum ator nesta SPEC. | Alteração destrutiva fora do escopo. | Deve ser bloqueada e exigir aprovação explícita futura. |

## 18. Segurança e privacidade

- Dados sensíveis ou pessoais envolvidos: não aplicável; não deve haver dados reais, pessoais ou financeiros.
- Ameaças relevantes: versionamento acidental de credenciais; exposição de variáveis locais; endpoint técnico retornando informações excessivas; logs com segredos; criação prematura de autenticação incompleta; dados reais em fixtures ou evidências.
- Proteções exigidas: `.env.example` com placeholders; `.gitignore` para arquivos de ambiente reais; logs sanitizados; contrato `/health` mínimo; testes com dados fictícios; validação de ambiente; nenhuma credencial real.
- Dados proibidos em logs/evidências: tokens, senhas, chaves, strings de conexão reais, nomes reais associados a finanças, extratos, faturas, saldos, transações, certificados e qualquer dado financeiro real.

## 19. Erros e estados vazios

| Situação | Estado apresentado | Recuperação esperada |
|---|---|---|
| Web aguardando API | `carregando`. | Concluir consulta e transicionar para disponível ou indisponível. |
| API disponível | `API disponível`. | Continuar exibindo página técnica. |
| API indisponível | `API indisponível`. | Permitir nova tentativa por recarregamento ou lógica simples definida na implementação, sem criar fluxo financeiro. |
| PostgreSQL parado | Falha explícita em migration ou validação que depende de banco. | Executar `db:up` e repetir comando. |
| Configuração inválida | API falha no startup com erro técnico sanitizado. | Corrigir `.env` local conforme README. |
| Sem dados financeiros | Nenhum estado financeiro vazio deve existir. | Funcionalidades financeiras aguardam SPEC futura. |

## 20. Observabilidade

- Logging básico local de inicialização e erros técnicos é obrigatório na API.
- Não configurar observabilidade externa, métricas, tracing, alertas, Sentry, Datadog, OpenTelemetry exportado ou serviços pagos.
- Logs não devem conter credenciais, dados pessoais ou dados financeiros.
- O endpoint de saúde não deve retornar versão de dependências, variáveis de ambiente, hostname, dados do banco ou timestamps nesta etapa.

## 21. Migração e compatibilidade

- Dados existentes: não há dados de aplicação a migrar.
- Compatibilidade retroativa: não aplicável, pois não há aplicação executável anterior.
- Migração necessária: sim, somente para validar o fluxo técnico do Prisma, preferencialmente sem tabela artificial.
- Implantação gradual: não aplicável; não há produção, hospedagem ou CI/CD.
- Migrations aplicadas nunca devem ser editadas; ajustes posteriores exigem nova migration.

## 22. Critérios de aceite

### `CA-01 — Instalação das dependências`

**Dado** o repositório com a implementação da SPEC-000 e Node/pnpm nas versões mínimas documentadas
**Quando** a pessoa desenvolvedora executar o comando raiz de instalação
**Então** as dependências dos workspaces deverão ser instaladas sem exigir credenciais, serviços pagos ou dados reais.

### `CA-02 — Inicialização do PostgreSQL`

**Dado** Docker disponível no ambiente local
**Quando** a pessoa desenvolvedora executar `db:up` ou comando raiz equivalente
**Então** o PostgreSQL deverá iniciar via Docker Compose com volume nomeado e healthcheck configurado.

### `CA-03 — Execução da API`

**Dado** dependências instaladas, variáveis válidas e, quando necessário, PostgreSQL disponível
**Quando** a pessoa desenvolvedora executar `dev:api` ou comando raiz equivalente
**Então** a API NestJS deverá iniciar na porta padrão `3000`, com prefixo `/api`, logging básico e encerramento gracioso configurado.

### `CA-04 — Resposta do endpoint de saúde`

**Dado** a API em execução
**Quando** `GET /api/health` for chamado
**Então** a resposta deverá ser JSON tipado exatamente com `status: "ok"` e `service: "planner-fin-api"`, sem dados sensíveis ou campos financeiros.

### `CA-05 — Execução da aplicação web`

**Dado** dependências instaladas
**Quando** a pessoa desenvolvedora executar `dev:web` ou comando raiz equivalente
**Então** a aplicação Vue 3 + Quasar deverá iniciar na porta padrão `9000` ou porta documentada, exibindo página técnica responsiva com o nome `PlannerFin`.

### `CA-06 — Consulta da web à API`

**Dado** web e API em execução com URL da API configurada
**Quando** a página inicial carregar
**Então** a web deverá consultar `GET /api/health` e apresentar o estado `API disponível` ao receber o contrato esperado.

### `CA-07 — API indisponível na web`

**Dado** a web em execução e a API parada ou inacessível
**Quando** a página inicial tentar consultar a API
**Então** a web deverá apresentar o estado `API indisponível` sem quebrar a aplicação e sem exibir dados financeiros.

### `CA-08 — Execução dos testes`

**Dado** dependências instaladas
**Quando** a pessoa desenvolvedora executar `test` e `test:unit` ou comandos equivalentes a partir da raiz
**Então** os testes mínimos da API, web e pacotes aplicáveis deverão passar, usando dados fictícios e sem depender de infraestrutura não declarada.

### `CA-09 — Build completo`

**Dado** dependências instaladas e configuração válida
**Quando** a pessoa desenvolvedora executar `build` a partir da raiz
**Então** todos os workspaces aplicáveis deverão ser construídos com sucesso.

### `CA-10 — Typecheck`

**Dado** dependências instaladas
**Quando** a pessoa desenvolvedora executar `typecheck` a partir da raiz
**Então** TypeScript strict deverá ser verificado sem erros.

### `CA-11 — Lint`

**Dado** dependências instaladas
**Quando** a pessoa desenvolvedora executar `lint` a partir da raiz
**Então** ESLint deverá finalizar sem erros nem warnings relevantes ignorados.

### `CA-12 — Migration e geração do Prisma`

**Dado** PostgreSQL local saudável e `DATABASE_URL` configurada
**Quando** a pessoa desenvolvedora executar `db:generate` e `db:migrate` ou comandos equivalentes a partir da raiz
**Então** Prisma Client deverá ser gerado e a primeira migration técnica deverá aplicar sem criar entidade financeira.

### `CA-13 — Ausência de funcionalidades financeiras`

**Dado** o diff da implementação
**Quando** a revisão própria for realizada
**Então** não deverão existir módulos, telas, contratos, tabelas, fixtures ou textos de funcionalidade financeira.

### `CA-14 — Ausência de segredos`

**Dado** o diff da implementação
**Quando** arquivos de configuração, ambiente, testes e documentação forem revisados
**Então** não deverá haver credenciais reais, tokens, certificados, strings de conexão reais, dados pessoais ou dados financeiros reais.

### `CA-15 — Execução a partir da raiz`

**Dado** o repositório com workspaces configurados
**Quando** a pessoa desenvolvedora executar os comandos principais de desenvolvimento, banco, teste, lint, typecheck e build
**Então** os fluxos deverão ser acessíveis a partir da raiz, sem exigir navegação manual por subdiretórios como caminho principal.

## 23. Testes obrigatórios

| Nível | Cenários mínimos | Critérios relacionados | Evidência esperada |
|---|---|---|---|
| Unitário API | Endpoint `/api/health` e inicialização/validação de configuração, usando padrão compatível com NestJS. | `CA-03`, `CA-04`, `CA-08` | Saída de `test:unit` ou equivalente. |
| Integração API | Quando aplicável, validar módulo de health com aplicação NestJS em memória; testes que exigirem PostgreSQL devem ser separados e documentados. | `CA-04`, `CA-12` | Saída de teste e indicação se exige infraestrutura local. |
| Unitário Web | Estado de carregamento, sucesso da API e falha da API. | `CA-06`, `CA-07`, `CA-08` | Saída de testes web com mocks/fakes da chamada HTTP. |
| Shared | Typecheck do contrato de saúde e teste somente se houver lógica testável. | `CA-04`, `CA-10` | Saída de typecheck; não criar teste vazio apenas para aumentar contagem. |
| Config | Typecheck ou validação de configuração quando aplicável. | `CA-10`, `CA-11` | Saída dos comandos de qualidade. |
| E2E | Playwright configurado; teste mínimo confirmando que a página abre; quando viável, confirmar integração web → API. | `CA-05`, `CA-06`, `CA-07` | Saída de `test:e2e`; documentar se depende da API ativa e se exige banco. |
| Banco | `db:up`, `db:migrate` e `db:generate` em ambiente local com PostgreSQL. | `CA-02`, `CA-12` | Saída dos comandos ou justificativa ambiental se Docker indisponível. |
| Verificações gerais | `lint`, `format:check`, `typecheck`, `build`, `git diff --check`. | `CA-09`, `CA-10`, `CA-11`, `CA-14` | Comandos e resultados registrados no PR. |
| Aceitação manual | Revisão do diff para ausência de funcionalidades financeiras, segredos e arquivos proibidos. | `CA-13`, `CA-14` | Lista de arquivos alterados e conclusão registrada. |

A SPEC diferencia testes sem banco (`test`, `test:unit`, typecheck, lint e build quando possível) de testes com infraestrutura local (`db:up`, `db:migrate` e qualquer integração real com PostgreSQL). O Playwright deve documentar se sobe servidores automaticamente ou exige API/web já ativas.

## 24. Arquivos permitidos

Na futura implementação da SPEC-000, ficam autorizados, no mínimo, os seguintes caminhos e arquivos quando necessários ao scaffold:

- `package.json`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `tsconfig.json` e/ou tsconfig base equivalente
- arquivos de lint e formatação, como configurações ESLint e Prettier
- `.gitignore`
- `.env.example`
- `docker-compose.yml`
- `README.md`
- `apps/api/**`
- `apps/web/**`
- `packages/shared/**`
- `packages/config/**`
- arquivos Prisma dentro do backend, incluindo `apps/api/prisma/**`
- testes relacionados ao scaffold
- configurações técnicas necessárias para Vitest, Playwright, NestJS, Quasar, TypeScript, Prisma, lint, formatação e build

Arquivos gerados devem ser versionados somente quando forem padrão necessário do ecossistema e não contiverem segredo, dependência baixada, artefato de build ou dado real.

## 25. Arquivos proibidos

Na futura implementação da SPEC-000, não devem ser alterados ou criados:

- documentos AS-IS;
- `docs/product/**`;
- ADRs já aprovados em `docs/adr/**`;
- SPECs anteriores;
- `docs/process/**`;
- `docs/quality/**`;
- dados reais, dados pessoais ou dados financeiros reais;
- certificados, chaves, tokens, senhas, arquivos `.env` reais ou credenciais;
- arquivos de produção, deploy, hospedagem ou CI/CD;
- módulos financeiros, modelos financeiros, telas financeiras, fixtures financeiras ou seeds de domínio;
- `nx.json`, `turbo.json` ou configurações equivalentes;
- configurações de Redis, filas, microserviços, Nginx ou observabilidade externa;
- projeto Android gerado ou configuração Capacitor definitiva.

## 26. Dependências

| Dependência | Motivo | Estado da aprovação | Impacto |
|---|---|---|---|
| Node.js LTS mínimo 22 | Runtime TypeScript/JavaScript moderno para apps e ferramentas. | Aprovada por esta SPEC. | Define pré-requisito local. |
| pnpm mínimo 10 | Workspaces e scripts centralizados do monorepo simples. | Aprovada por esta SPEC e `ADR-005`. | Define instalação e lockfile. |
| NestJS | Backend modular em TypeScript. | Aprovada por `ADR-003`. | Cria `apps/api`. |
| Vue 3 + Quasar | Cliente web responsivo com caminho futuro para mobile. | Aprovada por `ADR-002`. | Cria `apps/web`. |
| TypeScript | Tipagem compartilhada e strict mode. | Aprovada pelos ADRs. | Base de apps e packages. |
| PostgreSQL | Banco relacional principal. | Aprovada por `ADR-004`. | Exige Docker Compose local. |
| Prisma | Acesso a dados e migrations no backend. | Aprovada por `ADR-004`. | Exige schema e scripts de geração/migration. |
| ESLint e Prettier | Qualidade e padronização. | Aprovada por esta SPEC. | Scripts de lint e formatação. |
| Vitest ou ferramenta compatível | Testes frontend/pacotes e, quando adequado, TS. | Aprovada por `ADR-006`. | Testes unitários. |
| Ferramentas recomendadas do NestJS | Testes compatíveis com padrão NestJS. | Aprovada por `ADR-006`. | Testes da API. |
| Playwright | E2E web mínimo. | Aprovada por `ADR-006`. | Script `test:e2e`. |
| Docker Compose | PostgreSQL local. | Aprovada por esta SPEC. | Infra local sem conteinerizar apps. |

Não há aprovação para dependências de autenticação real, módulos financeiros, filas, Redis, microserviços, Nx, Turborepo, CI/CD, observabilidade externa ou serviços pagos.

## 27. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Scaffold crescer além do necessário. | Média | Introduz manutenção e decisões prematuras. | Manter contratos mínimos e revisar arquivos proibidos. |
| `packages/shared` virar utilitário genérico. | Média | Acoplamento difuso entre apps. | Restringir ao contrato de saúde realmente usado. |
| Tabela técnica artificial ser confundida com domínio. | Baixa | Polui modelo inicial e orienta decisões erradas. | Preferir migration sem tabela; justificar se tabela for indispensável. |
| Warnings serem ignorados. | Média | Oculta problemas de qualidade. | Exigir tratamento ou justificativa explícita no PR. |
| Dados reais entrarem em exemplos. | Baixa | Risco de privacidade e segurança. | Usar placeholders e revisão de segredos/dados. |
| Playwright ficar dependente de ambiente frágil. | Média | E2E instável. | Documentar pré-condições e separar testes com/sem infraestrutura. |
| Escolha de versões envelhecer até a implementação. | Média | Incompatibilidade futura. | Usar versões estáveis compatíveis no momento da implementação, sem fixar versões exatas nesta SPEC. |

## 28. Rollback

A implementação do scaffold deverá ser reversível pelo commit único de merge da SPEC-000, usando `git revert <hash-do-merge>` quando o hash estiver disponível. Como a SPEC proíbe migrations de domínio, dados financeiros, deploy e produção, não deve haver dados de usuário para recuperar.

Se a primeira migration técnica tiver sido aplicada apenas em ambiente local, o rollback operacional local poderá remover os containers/volumes de desenvolvimento conforme README, sem preservar dados reais. Nenhuma migration aplicada deve ser editada para rollback; ajustes posteriores devem usar novo commit ou nova SPEC.

## 29. Dúvidas

| ID | Dúvida | Impacto | Responsável | Estado |
|---|---|---|---|---|
| `D-01` | Prisma permite migration inicial reproduzível sem modelo/tabela no fluxo escolhido? | Pode exigir tabela técnica mínima. | Implementador da SPEC-000 | Resolvida por decisão: preferir sem tabela; se a ferramenta impedir, tabela técnica mínima é permitida com justificativa. |
| `D-02` | Playwright deve depender da API ativa? | Afeta comando E2E. | Implementador da SPEC-000 | Resolvida: deve documentar explicitamente; quando viável, validar integração web → API. |

Não há dúvida aberta que altere comportamento, escopo ou segurança no momento da aprovação.

## 30. Decisões aprovadas

| Data | Decisão | Responsável pela aprovação | Consequência |
|---|---|---|---|
| 2026-08-05 | Criar monorepo pnpm simples em `apps/api`, `apps/web`, `packages/shared` e `packages/config`. | Tarefa atual e `ADR-005` | Define estrutura base. |
| 2026-08-05 | Usar TypeScript, scripts centralizados na raiz, sem Nx e sem Turborepo. | Tarefa atual e `ADR-005` | Evita orquestração prematura. |
| 2026-08-05 | Usar NestJS com adaptador HTTP padrão em `apps/api`. | Tarefa atual e `ADR-003` | Define backend técnico inicial. |
| 2026-08-05 | Usar Vue 3 + Quasar em `apps/web`, sem Capacitor definitivo. | Tarefa atual e `ADR-002` | Define web técnica inicial e preserva caminho mobile futuro. |
| 2026-08-05 | Expor somente `GET /api/health` com contrato JSON mínimo. | Tarefa atual | Permite validação técnica sem domínio financeiro. |
| 2026-08-05 | Usar PostgreSQL via Docker Compose local e Prisma no backend. | Tarefa atual e `ADR-004` | Define persistência técnica inicial. |
| 2026-08-05 | Preferir primeira migration sem tabela artificial; permitir tabela técnica mínima apenas se indispensável. | Tarefa atual | Evita entidade sem necessidade e mantém validação do fluxo Prisma. |
| 2026-08-05 | Configurar ESLint, Prettier, TypeScript strict, testes, Playwright, build e `git diff --check`. | Tarefa atual e `ADR-006` | Define qualidade mínima. |
| 2026-08-05 | API e web devem rodar via pnpm diretamente; Docker Compose somente para PostgreSQL. | Tarefa atual | Mantém ambiente local simples. |
| 2026-08-05 | Node mínimo 22 LTS e pnpm mínimo 10. | Tarefa atual | Define pré-requisitos da implementação. |
| 2026-08-05 | Porta padrão da API `3000`, web `9000`, CORS local para web. | Tarefa atual | Define interoperabilidade local. |
| 2026-08-05 | Warnings relevantes não podem ser ignorados silenciosamente. | Tarefa atual | Define padrão de evidência e qualidade. |

## 31. Definition of Done específica

Além da [Definition of Done do projeto](../quality/DEFINITION-OF-DONE.md), a implementação desta SPEC exige:

- [ ] SPEC aprovada.
- [ ] Escopo integral respeitado.
- [ ] Monorepo funcional criado.
- [ ] Instalação limpa das dependências.
- [ ] Banco local inicia via Docker Compose.
- [ ] Migration Prisma funciona sem entidade financeira.
- [ ] Prisma Client é gerado.
- [ ] API inicia.
- [ ] Web inicia.
- [ ] Web consulta API.
- [ ] Testes passam.
- [ ] Lint passa.
- [ ] Typecheck passa.
- [ ] Build passa.
- [ ] `git diff --check` passa.
- [ ] Documentação técnica suficiente no README.
- [ ] Nenhum segredo versionado.
- [ ] Nenhum dado real versionado.
- [ ] Nenhuma funcionalidade financeira criada.
- [ ] Evidências dos comandos executados registradas no PR.
- [ ] Todos os critérios de aceite foram atendidos ou tiveram limitação ambiental justificada.
- [ ] Riscos residuais e rollback foram documentados.

Para a tarefa documental que cria esta SPEC, a Definition of Done específica é:

- [ ] Criar somente `docs/specs/SPEC-000-SCAFFOLD-TECNICO.md`.
- [ ] Não implementar scaffold, código, dependências, banco, migrations, Docker, CI ou configuração executável.
- [ ] Executar verificações documentais aplicáveis.
- [ ] Registrar resumo, decisões técnicas, dúvidas ou riscos restantes.

## 32. Histórico de alterações da SPEC

| Data | Alteração | Motivo | Autor | Aprovador, quando aplicável |
|---|---|---|---|---|
| 2026-08-05 | Criação da SPEC-000 aprovada do scaffold técnico inicial. | Autorizar futura implementação técnica conforme ADRs e tarefa atual. | Codex Cloud | Tarefa atual |
