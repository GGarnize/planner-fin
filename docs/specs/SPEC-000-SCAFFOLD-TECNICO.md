# SPEC de funcionalidade — `SPEC-000 — Scaffold técnico inicial`

## 1. Identificação

| Campo | Valor |
|---|---|
| ID | `SPEC-000` |
| Título | `Scaffold técnico inicial` |
| Responsável | `Codex Cloud` |
| Data de criação | `2026-08-05` |
| Última atualização | `2026-08-05` |
| Tarefa relacionada | `Criar SPEC-000 do scaffold técnico inicial do PlannerFin` |
| Documentos relacionados | `docs/adr/README.md`; `docs/adr/ADR-001-ARQUITETURA-GERAL.md`; `docs/adr/ADR-002-APLICACAO-CLIENTE.md`; `docs/adr/ADR-003-BACKEND.md`; `docs/adr/ADR-004-PERSISTENCIA-E-ACESSO-A-DADOS.md`; `docs/adr/ADR-005-ORGANIZACAO-DO-REPOSITORIO.md`; `docs/adr/ADR-006-ESTRATEGIA-DE-TESTES.md`; `docs/product/VISION.md`; `docs/product/SCOPE.md`; `docs/product/PRODUCT-PRINCIPLES.md`; `docs/specs/README.md`; `docs/quality/DEFINITION-OF-DONE.md`; `docs/quality/TEST-STRATEGY.md` |

## 2. Status

`Aprovada`

**Aprovada por:** tarefa atual em `2026-08-05`, com decisão funcional e arquitetural explicitamente autorizada pela solicitação e pelos ADRs aprovados.

## 3. Contexto

O PlannerFin ainda não possui scaffold executável de aplicação. As decisões arquiteturais iniciais já aprovadas definem um produto online-first, com cliente separado da API, backend em monólito modular, persistência relacional e organização em monorepo pnpm simples.

Esta SPEC registra o contrato para uma futura implementação exclusivamente técnica do scaffold inicial. A implementação futura deverá criar a estrutura mínima para permitir evolução incremental por SPECs posteriores, sem entregar funcionalidade financeira de produto e sem antecipar regras de negócio ainda não especificadas.

## 4. Problema

O repositório contém documentação de produto, processo, qualidade, pesquisa e ADRs, mas ainda não contém a base executável necessária para iniciar a implementação incremental do PlannerFin. Sem um scaffold aprovado, implementações futuras poderiam escolher ferramentas, estrutura de diretórios, dependências ou comandos de forma implícita, contrariando o processo dirigido por SPECs.

## 5. Objetivo

Definir o comportamento esperado da futura implementação do scaffold técnico inicial, de forma que o repositório passe a conter um monorepo pnpm simples com aplicações `api` e `web`, pacotes `shared` e `config`, comandos mínimos centralizados e verificações automatizadas básicas compatíveis com os ADRs aprovados.

## 6. Fora do escopo

- Implementar funcionalidades financeiras, fluxos de usuário, telas de negócio, dashboards ou cadastros.
- Criar modelos financeiros de domínio além de placeholders técnicos sem regra de negócio.
- Criar banco de dados real, schema de domínio financeiro, migrations estruturais ou dados seed financeiros.
- Configurar Docker, Docker Compose, infraestrutura de produção, deploy, CI/CD ou publicação em lojas.
- Implementar autenticação, autorização, cadastro de usuários, sessões ou recuperação de acesso.
- Implementar integrações bancárias, Open Finance, movimentação de dinheiro, importação de arquivos ou IA.
- Adicionar filas, Redis, microserviços, Nx, Turborepo ou orquestradores equivalentes.
- Criar contratos compartilhados de API antes de necessidade concreta aprovada.
- Criar aplicativo Android empacotado ou configuração de loja nesta SPEC; a base web deve apenas preservar o caminho aprovado para Capacitor/Android.

## 7. Termos

| Termo | Definição adotada nesta SPEC |
|---|---|
| Scaffold técnico | Estrutura inicial executável, com dependências, comandos, configurações e testes mínimos necessários para sustentar implementações futuras. |
| Monorepo pnpm simples | Repositório único com workspaces pnpm, sem Nx, Turborepo ou ferramenta adicional de orquestração. |
| Aplicação `api` | Aplicação backend NestJS em TypeScript, organizada para evoluir como monólito modular. |
| Aplicação `web` | Aplicação cliente Vue 3, Quasar e TypeScript, destinada inicialmente à web responsiva e com caminho preservado para Android via Capacitor em unidade futura. |
| Pacote `shared` | Pacote reservado para tipos ou contratos compartilhados somente quando houver necessidade concreta; no scaffold inicial deve permanecer mínimo. |
| Pacote `config` | Pacote reservado para configuração técnica compartilhada, como padrões de TypeScript, lint ou testes, sem conter regra financeira. |

## 8. Comportamento atual

O repositório contém documentos de processo, produto, qualidade, pesquisa e ADRs. Não há estrutura `apps/` ou `packages/` aprovada para aplicações executáveis. Não há `package.json`, workspace pnpm, aplicação NestJS, aplicação Quasar/Vue, pacote compartilhado ou configuração executável de testes.

## 9. Comportamento desejado

A futura implementação deverá criar um monorepo pnpm simples com a seguinte estrutura mínima:

```text
apps/
  api/
  web/

packages/
  shared/
  config/
```

A raiz do repositório deverá centralizar comandos para instalar, validar, testar e construir os workspaces aplicáveis. A implementação deverá usar TypeScript como linguagem principal nas aplicações e pacotes executáveis.

A aplicação `apps/api` deverá ser um backend NestJS mínimo, usando o adaptador HTTP padrão do NestJS, sem filas, Redis, microserviços ou regras financeiras. O backend deve expor somente uma rota técnica de saúde ou equivalente, suficiente para validar que o servidor inicializa.

A aplicação `apps/web` deverá ser uma aplicação Vue 3 com Quasar e TypeScript, sem telas financeiras. A interface inicial deve ser neutra e técnica, indicando apenas que o PlannerFin está inicializado ou mensagem equivalente, sem simular funcionalidades inexistentes.

O pacote `packages/shared` deverá existir sem antecipar contratos de domínio. Caso precise conter algum arquivo para viabilizar build ou testes, esse conteúdo deve ser técnico e explicitamente livre de regra financeira.

O pacote `packages/config` deverá concentrar configurações compartilháveis quando isso reduzir duplicação técnica no scaffold. Não deve conter regra de negócio nem decisões arquiteturais novas.

A implementação deverá incluir lint, typecheck, testes unitários mínimos e build para os workspaces criados. Testes devem usar dados fictícios ou não financeiros.

## 10. Personas ou atores

| Ator | Necessidade | Ações autorizadas |
|---|---|---|
| Pessoa desenvolvedora | Ter uma base técnica previsível para implementar próximas SPECs. | Instalar dependências, executar lint, typecheck, testes e build. |
| Agente implementador | Alterar apenas arquivos autorizados pela SPEC-000 na futura implementação. | Criar o scaffold técnico, comandos e verificações definidos nesta SPEC. |
| Pessoa revisora | Verificar aderência aos ADRs e ausência de escopo funcional indevido. | Revisar diff, comandos executados, riscos e critérios de aceite. |

## 11. Fluxos

### 11.1 Fluxo principal

1. A pessoa desenvolvedora obtém o repositório na branch de trabalho da SPEC-000.
2. A pessoa desenvolvedora instala dependências com pnpm.
3. A pessoa desenvolvedora executa os comandos centralizados de lint, typecheck, testes e build.
4. A aplicação `api` inicializa em modo de desenvolvimento e responde ao endpoint técnico mínimo.
5. A aplicação `web` inicializa em modo de desenvolvimento e exibe uma tela técnica neutra.
6. A pessoa revisora confirma que não há funcionalidade financeira implementada.

### 11.2 Fluxos alternativos e exceções

- Dependências não instaladas → os comandos devem falhar com mensagem padrão da ferramenta, sem exigir credenciais, serviços pagos ou dados externos.
- Banco de dados indisponível → não deve bloquear o scaffold, pois criação de banco real e migrations de domínio estão fora do escopo.
- Tentativa de adicionar ferramenta de orquestração como Nx ou Turborepo → deve ser rejeitada por estar fora do escopo e dos ADRs aprovados.
- Necessidade de contrato compartilhado de API → deve ser registrada para SPEC futura, sem antecipar contrato em `packages/shared`.

## 12. Regras de negócio

| ID | Regra | Origem/decisão | Exemplo |
|---|---|---|---|
| `RN-01` | O scaffold não pode implementar regra financeira de produto. | Escopo desta SPEC e princípios do produto. | Não criar cálculo de saldo, lançamento, fatura, dívida ou orçamento. |
| `RN-02` | O monorepo deve usar pnpm simples, sem Nx e sem Turborepo inicialmente. | `ADR-005`. | `pnpm-workspace.yaml` pode existir; `nx.json` e configuração Turborepo não podem ser criados. |
| `RN-03` | A API deve ser preparada como monólito modular NestJS em TypeScript. | `ADR-001` e `ADR-003`. | Criar aplicação NestJS mínima, sem microserviços. |
| `RN-04` | O cliente deve usar Vue 3, Quasar e TypeScript. | `ADR-002`. | Criar aplicação web responsiva mínima com Quasar. |
| `RN-05` | O scaffold não deve criar filas, Redis, microserviços, Docker, CI ou infraestrutura de deploy. | Escopo desta SPEC e ADRs. | Não adicionar `docker-compose.yml`, workflows de CI ou configuração de filas. |
| `RN-06` | Dados de teste devem ser fictícios e não financeiros quando possível. | `ADR-006` e `TEST-STRATEGY`. | Teste de renderização usa texto técnico, não extrato real. |
| `RN-07` | Valores monetários em ponto flutuante continuam proibidos em futuras regras financeiras, mas esta SPEC não deve criar modelo monetário. | `ADR-004`. | Não criar schema de dinheiro no scaffold. |

## 13. Modelo de dados

Não aplicável. Esta SPEC não autoriza criação de entidades financeiras, schema de banco, tabelas, migrations ou persistência de dados de domínio. Qualquer modelo de dados financeiro deverá ser definido em SPEC própria.

## 14. Contratos de API

### Endpoint técnico de saúde

- Entrada: requisição HTTP sem corpo para um caminho técnico de saúde definido pela implementação, como `/health` ou equivalente.
- Saída de sucesso: resposta simples indicando que a API está ativa, sem dados pessoais ou financeiros.
- Erros: erros técnicos padrão do framework quando a aplicação não estiver disponível.
- Autorização: não aplicável para o endpoint técnico inicial, desde que ele não exponha dados sensíveis.
- Idempotência: a consulta deve ser idempotente e não deve produzir efeitos persistentes.

Nenhum outro contrato de API está autorizado por esta SPEC.

## 15. Interface

A interface inicial da aplicação `web` deve ser uma tela técnica neutra, suficiente para demonstrar que a aplicação iniciou. Ela pode exibir nome do produto e status de inicialização, mas não deve apresentar menus, formulários, totais, cards ou simulações de funcionalidades financeiras ainda não aprovadas.

A interface deve ser minimamente responsiva, coerente com o uso futuro em web responsiva, sem exigir validação visual de produto final.

## 16. Validações

| Campo ou ação | Validação | Mensagem/resultado esperado |
|---|---|---|
| Instalação de dependências | Usar pnpm e workspaces configurados na raiz. | Dependências instaladas sem exigir credenciais ou serviços externos. |
| Lint | Executar sobre os workspaces criados. | Comando finaliza com sucesso. |
| Typecheck | Executar sobre TypeScript dos workspaces criados. | Comando finaliza com sucesso. |
| Testes unitários | Executar testes mínimos da API, web e/ou pacotes criados. | Comando finaliza com sucesso usando dados fictícios ou não financeiros. |
| Build | Construir aplicações e pacotes aplicáveis. | Comando finaliza com sucesso. |
| Endpoint técnico | Chamar endpoint de saúde quando a API estiver em execução. | Resposta de sucesso sem dados sensíveis. |
| Tela inicial | Abrir aplicação web em desenvolvimento. | Tela neutra de inicialização, sem funcionalidade financeira. |

## 17. Permissões

| Ação | Ator autorizado | Condição | Comportamento quando negado |
|---|---|---|---|
| Consultar endpoint técnico de saúde | Qualquer pessoa com acesso ao ambiente local de desenvolvimento. | Endpoint não expõe dados sensíveis. | Não aplicável no scaffold local. |
| Acessar tela inicial local | Qualquer pessoa com acesso ao ambiente local de desenvolvimento. | Ambiente local iniciado. | Não aplicável no scaffold local. |
| Acessar dados financeiros | Nenhum ator nesta SPEC. | Não há dados financeiros no scaffold. | A funcionalidade não deve existir. |

## 18. Segurança e privacidade

- Dados sensíveis ou pessoais envolvidos: não aplicável; o scaffold não deve conter dados reais, pessoais ou financeiros.
- Ameaças relevantes: versionamento acidental de credenciais; exposição de dados em exemplos; criação prematura de endpoints com dados sensíveis; inclusão de serviços externos sem necessidade.
- Proteções exigidas: não criar nem versionar arquivos de segredo; manter exemplos sem dados reais; endpoint técnico sem dados sensíveis; não exigir credenciais pessoais; validar que arquivos de ambiente reais não sejam versionados.
- Dados proibidos em logs/evidências: tokens, senhas, chaves de API, dados bancários, nomes reais associados a finanças pessoais, extratos, faturas ou qualquer dado financeiro real.

## 19. Erros e estados vazios

| Situação | Estado apresentado | Recuperação esperada |
|---|---|---|
| API não iniciada | Erro técnico padrão ao chamar endpoint local. | Iniciar aplicação `api` conforme documentação do scaffold. |
| Web não iniciada | Navegador não acessa aplicação local. | Iniciar aplicação `web` conforme documentação do scaffold. |
| Sem funcionalidades financeiras | Tela inicial permanece neutra. | Implementar funcionalidades apenas em SPECs futuras aprovadas. |
| Dependências ausentes | Comandos falham por módulos ausentes. | Executar instalação com pnpm. |

## 20. Observabilidade

O scaffold pode incluir logs técnicos mínimos de inicialização fornecidos pelos frameworks. Não deve criar observabilidade de produção, métricas externas, alertas, integrações pagas ou coleta de dados. Logs não devem conter credenciais, dados pessoais ou dados financeiros.

## 21. Migração e compatibilidade

- Dados existentes: não há dados de aplicação a migrar.
- Compatibilidade retroativa: não aplicável, pois ainda não há aplicação executável anterior.
- Migração necessária: não. Esta SPEC não autoriza migrations de banco.
- Implantação gradual: não aplicável; não há deploy ou produção nesta SPEC.

## 22. Critérios de aceite

### `CA-01 — Estrutura de monorepo criada`

**Dado** o repositório sem scaffold executável inicial
**Quando** a SPEC-000 for implementada
**Então** a estrutura `apps/api`, `apps/web`, `packages/shared` e `packages/config` deverá existir em um monorepo pnpm simples.

### `CA-02 — Comandos centralizados funcionam`

**Dado** as dependências instaladas com pnpm
**Quando** lint, typecheck, testes unitários e build forem executados pelos comandos da raiz
**Então** todos deverão finalizar com sucesso para os workspaces criados.

### `CA-03 — API técnica inicial funciona`

**Dado** a aplicação `apps/api` iniciada localmente
**Quando** o endpoint técnico de saúde for chamado
**Então** a resposta deverá indicar sucesso sem expor dados pessoais, financeiros ou segredo.

### `CA-04 — Web técnica inicial funciona`

**Dado** a aplicação `apps/web` iniciada localmente
**Quando** a página inicial for aberta
**Então** uma tela técnica neutra deverá ser exibida sem menus ou funcionalidades financeiras.

### `CA-05 — Escopo funcional não é antecipado`

**Dado** o diff da implementação da SPEC-000
**Quando** a revisão própria for realizada
**Então** não deverão existir modelos financeiros, migrations de domínio, autenticação, autorização, regras de negócio, integrações bancárias, IA, Docker, CI, filas, Redis, microserviços, Nx ou Turborepo.

## 23. Testes obrigatórios

| Nível | Cenários mínimos | Critérios relacionados | Evidência esperada |
|---|---|---|---|
| Unitário | Teste mínimo de inicialização ou componente técnico da API, web e pacotes aplicáveis. | `CA-02`, `CA-03`, `CA-04` | Saída do comando de testes com sucesso. |
| Integração | Não aplicável nesta SPEC; não há banco, módulo financeiro ou integração externa autorizada. | Não aplicável | Justificativa registrada na entrega. |
| Contrato | Endpoint técnico de saúde validado por teste ou verificação programática equivalente. | `CA-03` | Saída do teste ou comando HTTP local. |
| E2E | Verificação mínima da tela inicial web quando tecnicamente viável no ambiente. | `CA-04` | Saída do comando E2E ou justificativa de limitação ambiental. |
| Aceitação manual | Revisão do diff confirmando estrutura, comandos e ausência de escopo funcional indevido. | `CA-01`, `CA-05` | Resumo dos arquivos alterados e evidência dos comandos executados. |

## 24. Arquivos permitidos

Na futura implementação da SPEC-000, ficam autorizados somente arquivos necessários ao scaffold técnico inicial nos seguintes caminhos e arquivos de raiz:

- `apps/api/**`
- `apps/web/**`
- `packages/shared/**`
- `packages/config/**`
- `package.json`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `tsconfig*.json`
- arquivos de configuração técnica necessários para lint, typecheck, testes, build e formatação, desde que não configurem CI, Docker, deploy ou serviços externos
- documentação mínima de uso do scaffold, caso necessária, preferencialmente em `README.md` ou arquivo específico relacionado ao scaffold

## 25. Arquivos proibidos

Na futura implementação da SPEC-000, não devem ser alterados ou criados:

- `docs/adr/**`, exceto se uma nova decisão arquitetural for aprovada em unidade própria antes da implementação.
- `docs/product/**`, exceto em unidade documental própria.
- `docs/specs/**`, exceto atualização formal desta SPEC mediante aprovação explícita.
- `docs/research/**`.
- `docs/process/**`.
- `docs/quality/**`.
- `.github/**`.
- `Dockerfile`, `docker-compose.yml` ou variações.
- arquivos de CI/CD, deploy, infraestrutura, credenciais ou configuração de serviços pagos.
- migrations, schemas financeiros ou seeds financeiros.

## 26. Dependências

| Dependência | Motivo | Estado da aprovação | Impacto |
|---|---|---|---|
| `pnpm` | Gerenciar workspaces do monorepo simples aprovado. | Aprovada por `ADR-005` e por esta SPEC. | Necessário para instalar e executar comandos centralizados. |
| `TypeScript` | Linguagem principal aprovada para cliente, backend e pacotes. | Aprovada por `ADR-002`, `ADR-003` e esta SPEC. | Permite typecheck e contratos internos tipados. |
| `NestJS` | Framework backend modular aprovado. | Aprovada por `ADR-003` e esta SPEC. | Base da aplicação `apps/api`. |
| `Vue 3` | Framework cliente aprovado. | Aprovada por `ADR-002` e esta SPEC. | Base da aplicação `apps/web`. |
| `Quasar` | Framework de UI e estrutura cliente aprovada. | Aprovada por `ADR-002` e esta SPEC. | Base para web responsiva e caminho futuro Android. |
| `Capacitor` | Caminho aprovado para empacotamento Android futuro. | Aprovada por `ADR-002`; uso executável pode ser mínimo ou adiado conforme necessidade do scaffold. | Preserva direção mobile sem exigir publicação Android nesta SPEC. |
| `Prisma` | Ferramenta inicial aprovada para acesso a dados e migrations futuras. | Aprovada por `ADR-004`; uso estrutural de domínio não autorizado nesta SPEC. | Pode ser preparado apenas se necessário ao scaffold, sem schema financeiro ou migration. |
| `Vitest` | Base preferencial para testes frontend e pacotes TypeScript. | Aprovada por `ADR-006` e esta SPEC. | Permite testes unitários mínimos. |
| Ferramentas recomendadas do NestJS para testes | Validar backend conforme stack NestJS. | Aprovada por `ADR-006` e esta SPEC. | Permite teste mínimo da API. |
| `Playwright` | Ferramenta aprovada para E2E web. | Aprovada por `ADR-006`; pode ser configurada se viável no scaffold. | Permite verificação futura de fluxos web. |

Nenhuma dependência adicional deve ser adicionada sem justificativa explícita na implementação da SPEC-000 e sem permanecer dentro do escopo técnico aprovado.

## 27. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Scaffold antecipar regra financeira indevida. | Média | Quebra do processo SDD e risco de comportamento sem aprovação. | Revisar diff contra `CA-05` e manter tela/API técnicas. |
| `packages/shared` virar pacote genérico de utilitários. | Média | Acoplamento difuso e contratos prematuros. | Manter pacote mínimo e sem utilitários sem domínio aprovado. |
| Comandos centralizados ficarem inconsistentes entre workspaces. | Média | Dificulta validação e manutenção. | Definir scripts de raiz e validar lint/typecheck/test/build. |
| Dependências excederem o necessário. | Média | Aumenta custo, superfície de manutenção e risco de segurança. | Justificar dependências e evitar ferramentas fora dos ADRs. |
| Configuração mobile ser confundida com entrega Android. | Baixa | Amplia escopo e validações. | Preservar caminho Capacitor sem publicação Android nesta SPEC. |

## 28. Rollback

Como a implementação futura não deverá criar dados persistidos nem migrations, o rollback deverá ser feito por reversão do commit ou PR que implementar a SPEC-000. Quando houver hash final na `main`, usar `git revert <hash>` sem reescrever histórico. A validação do rollback consiste em confirmar que os arquivos do scaffold foram removidos ou retornaram ao estado anterior e que a documentação existente permanece intacta.

## 29. Dúvidas

| ID | Dúvida | Impacto | Responsável | Estado |
|---|---|---|---|---|
| `D-01` | Há alguma funcionalidade financeira a incluir no scaffold inicial? | Poderia ampliar escopo indevidamente. | Solicitante | `Resolvida — nenhuma funcionalidade financeira está autorizada nesta SPEC.` |
| `D-02` | O scaffold deve incluir Docker, CI ou infraestrutura executável? | Poderia adicionar configuração fora do escopo. | Solicitante | `Resolvida — Docker, CI e infraestrutura estão fora do escopo desta SPEC.` |
| `D-03` | O scaffold deve criar banco, migrations ou schema financeiro? | Poderia antecipar decisões de dados. | Solicitante | `Resolvida — banco real, migrations e schema financeiro estão fora do escopo desta SPEC.` |

## 30. Decisões aprovadas

| Data | Decisão | Responsável pela aprovação | Consequência |
|---|---|---|---|
| `2026-08-05` | Criar a SPEC-000 como especificação aprovada do scaffold técnico inicial. | Solicitante da tarefa atual | Autoriza implementação futura da SPEC-000 dentro dos limites descritos. |
| `2026-08-05` | Usar monorepo pnpm simples com `apps/api`, `apps/web`, `packages/shared` e `packages/config`. | `ADR-005` e solicitante da tarefa atual | Define estrutura obrigatória da implementação futura. |
| `2026-08-05` | Usar NestJS/TypeScript no backend e Vue 3/Quasar/TypeScript no cliente. | `ADR-002`, `ADR-003` e solicitante da tarefa atual | Define stacks autorizadas para o scaffold. |
| `2026-08-05` | Não criar aplicação, código, dependências, banco, migrations, Docker, CI ou configuração executável nesta tarefa documental. | Solicitante da tarefa atual | Esta entrega altera somente `docs/specs/SPEC-000-SCAFFOLD-TECNICO.md`. |

## 31. Definition of Done específica

Além da [Definition of Done do projeto](../../quality/DEFINITION-OF-DONE.md), esta SPEC exige para sua futura implementação:

- [ ] A estrutura `apps/api`, `apps/web`, `packages/shared` e `packages/config` existe.
- [ ] O monorepo usa pnpm simples, sem Nx e sem Turborepo.
- [ ] Os comandos centralizados de lint, typecheck, testes unitários e build foram executados e registrados.
- [ ] O endpoint técnico de saúde da API foi validado.
- [ ] A tela inicial técnica da web foi validada.
- [ ] Não há funcionalidade financeira, autenticação, banco real, migrations de domínio, Docker, CI, filas, Redis, microserviços ou integrações externas.
- [ ] Todos os critérios de aceite foram atendidos.
- [ ] As evidências obrigatórias foram anexadas.

## 32. Histórico de alterações da SPEC

| Data | Alteração | Motivo | Autor | Aprovador, quando aplicável |
|---|---|---|---|---|
| `2026-08-05` | Criação da SPEC-000 aprovada para o scaffold técnico inicial. | Registrar escopo e critérios da futura implementação técnica. | Codex Cloud | Solicitante da tarefa atual |
