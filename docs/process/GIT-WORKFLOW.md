# Fluxo de trabalho com Git

## Objetivo

Este documento define o fluxo obrigatório para qualquer alteração no repositório. A unidade de trabalho pode ser uma SPEC, uma correção, uma investigação, uma decisão arquitetural ou uma entrega documental coesa.

## Princípios obrigatórios

- Nunca trabalhar diretamente na `main`.
- Nunca usar force push na `main`.
- Usar uma branch por unidade de trabalho.
- Abrir um pull request por unidade de trabalho.
- Não misturar assuntos não relacionados na mesma branch, commit ou pull request.
- Todo pull request deve iniciar como draft.
- Pull requests continuam obrigatórios mesmo quando o merge automático por agente estiver autorizado.
- Após concluir trabalho, revisão própria e validações obrigatórias, o agente pode marcar o pull request como pronto e mesclar quando não houver bloqueios humanos.
- Não exigir aprovação humana separada apenas para a autorização mecânica de merge quando a unidade estiver claramente autorizada, dentro do escopo, sem dúvidas bloqueantes e com todas as verificações obrigatórias aprovadas.
- Preferir **Squash and merge** para manter uma alteração lógica por entrada no histórico da `main`.
- Excluir a branch remota após o merge.
- Registrar o hash final produzido na `main`.
- Antes de iniciar nova tarefa, partir da versão mais recente da `main`.
- Interromper o trabalho se forem encontradas alterações locais, arquivos inesperados ou divergências não explicadas em relação à `main`.

## Preparação de uma tarefa

1. Confirmar que os pull requests dos quais a tarefa depende foram mesclados.
2. Verificar que não existem alterações locais ou remotas inesperadas.
3. Atualizar a referência da `main` e usá-la como base da nova branch.
4. Ler a tarefa, a SPEC e as decisões aplicáveis antes de alterar arquivos.
5. Definir os arquivos permitidos e proibidos para a unidade de trabalho.
6. Criar a branch com a convenção correspondente.

Se qualquer uma dessas verificações falhar, não criar commits até que a divergência seja esclarecida.

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

1. Publicar a branch sem alterar a `main`.
2. Abrir o pull request como draft e apontá-lo para `main`.
3. Preencher o template de pull request por completo, usando “Não aplicável” com justificativa quando necessário.
4. Relacionar a tarefa, SPEC, documento de pesquisa ou ADR correspondente.
5. Informar arquivos alterados, verificações executadas, evidências, riscos e rollback.
6. Manter o pull request em draft enquanto houver trabalho ou validações obrigatórias pendentes.
7. Revisar o próprio diff e os arquivos alterados antes de marcar o pull request como pronto.
8. Quando não houver bloqueio humano, marcar o pull request como pronto após todas as validações aplicáveis passarem.
9. Fazer **Squash and merge** quando o merge automático estiver autorizado.
10. Excluir a branch após o merge.
11. Informar o hash final da `main` e o procedimento de rollback por `git revert <hash>`.

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

1. confirmar o resultado do merge;
2. registrar o hash final presente na `main`;
3. confirmar que o rollback pode ser feito por `git revert <hash>` sem reescrever a história;
4. excluir a branch da unidade de trabalho;
5. atualizar a `main` local ou a referência de trabalho;
6. iniciar a próxima tarefa em uma branch nova.
