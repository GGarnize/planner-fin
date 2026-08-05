# Fluxo de trabalho com Git

## Objetivo

Este documento define o fluxo obrigatório para qualquer alteração no repositório. A unidade de trabalho pode ser uma SPEC, uma correção, uma investigação, uma decisão arquitetural ou uma entrega documental coesa.

## Princípios obrigatórios

- Nunca trabalhar diretamente na `main`.
- Nunca usar force push na `main`.
- Usar uma branch por unidade de trabalho ou pelo mecanismo equivalente disponibilizado pelo ambiente de execução.
- Abrir um pull request por unidade de trabalho pelo mecanismo aplicável ao ambiente.
- Não misturar assuntos não relacionados na mesma branch, commit ou pull request.
- Todo pull request deve iniciar como draft quando o mecanismo usado permitir essa opção.
- Pull requests continuam obrigatórios mesmo quando o merge automático por agente estiver autorizado.
- Após concluir trabalho, revisão própria e validações obrigatórias, o agente pode marcar o pull request como pronto e mesclar quando não houver bloqueios humanos.
- Não exigir aprovação humana separada apenas para a autorização mecânica de merge quando a unidade estiver claramente autorizada, dentro do escopo, sem dúvidas bloqueantes e com todas as verificações obrigatórias aprovadas.
- Preferir **Squash and merge** para manter uma alteração lógica por entrada no histórico da `main`.
- Excluir a branch remota após o merge quando houver branch remota publicada.
- Registrar o hash final produzido na `main` quando ele estiver disponível no ambiente de trabalho.
- Antes de iniciar nova tarefa, partir da versão mais recente da `main` ou da branch-base selecionada para a unidade de trabalho.
- Interromper o trabalho se forem encontradas alterações locais, arquivos inesperados ou divergências não explicadas em relação à base aplicável.

## Preparação de uma tarefa

1. Confirmar que os pull requests dos quais a tarefa depende foram mesclados.
2. Verificar que não existem alterações locais inesperadas e, em ambientes com remote disponível, alterações remotas inesperadas.
3. Definir a base de trabalho conforme o ambiente:
   - no **Codex Cloud**, usar o repositório e a branch-base selecionados na interface do Codex/ChatGPT;
   - em ambiente Git local ou Codex CLI, atualizar a referência da `main` ou da branch-base remota aplicável e usá-la como base da nova branch.
4. Ler a tarefa, a SPEC e as decisões aplicáveis antes de alterar arquivos.
5. Definir os arquivos permitidos e proibidos para a unidade de trabalho.
6. Criar a branch com a convenção correspondente ou usar a branch interna criada pelo ambiente de execução.

Se qualquer uma dessas verificações falhar por divergência real de escopo, histórico ou arquivos, não criar commits até que a divergência seja esclarecida. No Codex Cloud, a ausência de remote `origin`, de autenticação `gh` ou de capacidade de `push` via terminal não é falha dessa preparação.

## Execução no Codex Cloud

No Codex Cloud, o repositório e a branch-base são definidos pela interface do Codex/ChatGPT. O sandbox pode expor uma cópia isolada sem remote Git utilizável e pode usar uma branch interna, como `work`, para representar a unidade de trabalho.

Regras específicas para esse ambiente:

- a ausência de remote `origin` no sandbox não é erro;
- `gh auth status` não é pré-condição para iniciar, validar ou concluir a tarefa;
- `git fetch origin` não é pré-condição para iniciar, validar ou concluir a tarefa;
- o agente não deve executar `gh auth login`, configurar PAT, token ou qualquer credencial pessoal;
- o agente não deve interromper a tarefa apenas porque não consegue executar `git push` diretamente pelo terminal;
- o agente deve produzir commit, diff, testes aplicáveis e evidências normalmente;
- a publicação da branch e a criação do pull request devem usar o mecanismo nativo disponibilizado pelo Codex/ChatGPT;
- quando a publicação nativa não estiver disponível, o agente deve concluir a alteração local, preservar o commit e informar a limitação, sem descartar o trabalho.

## Execução em ambiente Git local ou Codex CLI

Em ambiente Git local ou Codex CLI, quando a tarefa exigir publicação remota, podem ser pré-condições aplicáveis:

- existir remote `origin` ou remote equivalente configurado para o repositório correto;
- executar fetch da `main` ou da branch-base remota aplicável antes de criar ou atualizar a branch de trabalho;
- possuir autenticação válida para push;
- possuir GitHub CLI autenticado ou mecanismo equivalente para abrir pull request, quando esse for o fluxo escolhido.

Essas exigências se aplicam somente a ambientes locais ou Codex CLI. Elas não devem ser transferidas para o Codex Cloud quando a interface do Codex/ChatGPT fornecer o mecanismo de publicação e pull request.

## Convenção de branches

Os nomes devem ser curtos, descritivos, em minúsculas e separados por hífen.

| Tipo de trabalho | Formato | Exemplo |
|---|---|---|
| Documentação | `docs/<assunto>` | `docs/sdd-process-foundation` |
| Investigação | `research/<assunto>` | `research/regras-cartao` |
| Criação ou revisão de SPEC | `spec/<numero>-<assunto>` | `spec/001-lancamentos` |
| Funcionalidade | `feat/<numero>-<assunto>` | `feat/001-lancamentos` |
| Correção | `fix/<numero>-<assunto>` | `fix/014-duplicidade-fatura` |
| Infraestrutura ou manutenção | `chore/<assunto>` | `chore/organizar-documentacao` |
| Decisão arquitetural | `adr/<numero>-<assunto>` | `adr/001-persistencia` |

O número usado em `spec/`, `feat/`, `fix/` e `adr/` deve corresponder ao identificador rastreável da unidade de trabalho.

## Padrão de commits

Os commits seguem Conventional Commits:

| Prefixo | Uso |
|---|---|
| `docs:` | Documentação |
| `feat:` | Nova funcionalidade |
| `fix:` | Correção de defeito |
| `test:` | Inclusão ou ajuste de testes |
| `refactor:` | Refatoração sem alteração funcional intencional |
| `chore:` | Manutenção geral |
| `build:` | Sistema de build ou dependências de build |
| `ci:` | Automação de integração ou entrega contínua |

Regras adicionais:

- escrever a descrição em português do Brasil;
- descrever a intenção, não apenas o arquivo alterado;
- manter cada commit coerente com a unidade de trabalho;
- não incluir assuntos fora do escopo;
- não adicionar assinaturas, trailers ou menções a ferramentas de IA.

Exemplo:

```text
docs: definir fundação do processo SDD
```

## Pull request

1. Publicar a branch sem alterar a `main`, usando o mecanismo aplicável ao ambiente.
2. Abrir o pull request como draft, quando possível, e apontá-lo para `main` ou para a branch-base definida para a tarefa.
3. Preencher o template de pull request por completo, usando “Não aplicável” com justificativa quando necessário.
4. Relacionar a tarefa, SPEC, documento de pesquisa ou ADR correspondente.
5. Informar arquivos alterados, verificações executadas, evidências, riscos e rollback.
6. Manter o pull request em draft enquanto houver trabalho ou validações obrigatórias pendentes.
7. Revisar o próprio diff e os arquivos alterados antes de marcar o pull request como pronto.
8. Quando não houver bloqueio humano, marcar o pull request como pronto após todas as validações aplicáveis passarem.
9. Fazer **Squash and merge** quando o merge automático estiver autorizado.
10. Excluir a branch após o merge quando houver branch remota gerenciada diretamente.
11. Informar o hash final da `main`, quando disponível, e o procedimento de rollback por `git revert <hash>`.

No Codex Cloud, publicação de branch e criação de pull request devem ocorrer pelo mecanismo nativo do Codex/ChatGPT. Se esse mecanismo não estiver disponível no momento da entrega, o agente deve informar a limitação, mantendo commit, diff e evidências produzidos.

## Bloqueios que exigem decisão humana

O agente não pode fazer merge e deve interromper a unidade de trabalho quando houver:

- dúvida que altere comportamento financeiro;
- regra de negócio não aprovada;
- ampliação de escopo;
- necessidade de alterar uma SPEC aprovada;
- conflito entre documentos ou ADRs;
- escolha arquitetural não coberta por ADR aprovado;
- migration destrutiva;
- perda, transformação irreversível ou exclusão em massa de dados;
- mudança relevante de autenticação, autorização ou privacidade;
- inclusão de credencial, segredo ou acesso de produção;
- contratação ou ativação de serviço pago;
- publicação em produção ou em loja pública sem autorização específica;
- testes, lint, typecheck ou build obrigatórios falhando;
- vulnerabilidade conhecida sem tratamento;
- arquivos inesperados ou alterações anteriores reaplicadas;
- conflito de merge que altere premissas;
- qualquer situação explicitamente marcada na tarefa ou SPEC como dependente de aceite humano.

## Atualização e divergências

- Antes de iniciar outra tarefa, atualizar novamente a `main`; não reutilizar a branch anterior.
- Se a `main` avançar durante o trabalho, avaliar a atualização da branch antes da revisão final.
- Se a atualização produzir conflitos ou alterar premissas da SPEC, interromper e pedir decisão humana.
- Se surgirem arquivos modificados que não pertencem à unidade atual, não descartá-los nem incluí-los silenciosamente.
- Se uma necessidade nova não couber no escopo, registrar a necessidade e tratá-la em outra SPEC ou unidade de trabalho.

## Encerramento

Após merge automático autorizado ou merge realizado por pessoa responsável:

1. confirmar o resultado do merge quando o ambiente disponibilizar essa informação;
2. registrar o hash final presente na `main` quando disponível;
3. confirmar que o rollback pode ser feito por `git revert <hash>` sem reescrever a história quando o hash final estiver disponível;
4. excluir a branch da unidade de trabalho quando houver branch remota gerenciada diretamente;
5. atualizar a `main` local ou a referência de trabalho;
6. iniciar a próxima tarefa em uma branch nova ou em nova unidade criada pelo ambiente.
