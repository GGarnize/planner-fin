# Regras do projeto

## Idioma

- Documentação, comentários relevantes e comunicação devem ser em português do Brasil.
- Nomes técnicos de código podem permanecer em inglês.

## Processo obrigatório

- Nenhuma funcionalidade pode ser implementada sem uma SPEC aprovada.
- Cada tarefa deve implementar somente uma SPEC.
- Não alterar arquivos fora do escopo autorizado pela SPEC.
- Não adicionar dependências sem justificativa explícita.
- Não fazer refatorações não solicitadas.
- Em caso de ambiguidade, parar e relatar antes de implementar.
- Não alterar decisões arquiteturais silenciosamente.
- Seguir o ciclo e o controle de mudanças definidos em [docs/specs/README.md](docs/specs/README.md).

## Git

- Nunca trabalhar diretamente na branch `main`.
- Toda tarefa que altera o repositório deve usar branch própria ou o mecanismo equivalente disponibilizado pelo ambiente de execução.
- Implementações devem usar uma branch por SPEC.
- Documentação, pesquisa e ADR devem usar uma branch por unidade documental.
- Usar um pull request por unidade de trabalho e não misturar assuntos não relacionados.
- No Codex Cloud, o repositório, a branch-base, a publicação da branch e a criação do pull request devem seguir o mecanismo nativo do Codex/ChatGPT; ausência de remote `origin`, `git fetch origin` ou `gh auth status` no sandbox não é bloqueio.
- Em ambiente Git local ou Codex CLI, exigir remote, fetch, autenticação para push e GitHub CLI ou mecanismo equivalente somente quando aplicável ao fluxo escolhido.
- Agentes não devem configurar PAT, token ou credenciais pessoais nem interromper uma tarefa no Codex Cloud apenas por não conseguir executar `push` pelo terminal.
- Seguir integralmente [docs/process/GIT-WORKFLOW.md](docs/process/GIT-WORKFLOW.md).
- Agentes podem fazer merge somente nas condições descritas no fluxo Git.
- Decisões bloqueantes continuam exigindo intervenção humana antes do merge.
- Nunca usar force push na `main`.
- Commits devem explicar a intenção da alteração.

## Qualidade

Antes de concluir uma implementação:

- executar lint;
- executar typecheck;
- executar testes unitários;
- executar testes de integração aplicáveis;
- executar build;
- informar comandos e resultados;
- apresentar resumo dos arquivos alterados;
- apresentar limitações e riscos encontrados.

Os critérios de passagem entre etapas estão em [docs/quality/DEFINITION-OF-DONE.md](docs/quality/DEFINITION-OF-DONE.md). Os níveis, riscos e evidências de teste estão em [docs/quality/TEST-STRATEGY.md](docs/quality/TEST-STRATEGY.md).

## Segurança

- Nunca versionar credenciais.
- Nunca registrar tokens, senhas ou dados financeiros sensíveis.
- Validar toda entrada recebida pela API.
- Aplicar autorização no backend, não apenas na interface.

## Banco de dados

- Toda alteração estrutural deve usar migration.
- Migrations já aplicadas não podem ser editadas.
- Alterações destrutivas exigem aprovação explícita.

## Escopo

- O produto é inicialmente um sistema financeiro pessoal.
- Não implementar recursos bancários regulados, movimentação de dinheiro ou aconselhamento financeiro automatizado.


