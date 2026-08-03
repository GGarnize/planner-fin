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

## Git

- Nunca trabalhar diretamente na branch main.
- Criar uma branch por SPEC.
- Um pull request por SPEC.
- Não misturar correções ou melhorias não relacionadas.
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