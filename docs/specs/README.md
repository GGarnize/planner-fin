# Desenvolvimento dirigido por especificações

## Finalidade

Este diretório contém as especificações funcionais e de correção do projeto. Uma SPEC descreve o comportamento aprovado para uma unidade de trabalho e estabelece o contrato de escopo entre investigação, implementação, revisão e aceite.

Documentos AS-IS registram o que foi observado no estado atual. Eles **não representam automaticamente o comportamento TO-BE** e não autorizam implementação sem esclarecimento, decisão e aprovação de uma SPEC.

## Ciclo obrigatório

Toda funcionalidade ou correção deve seguir esta sequência:

1. **Investigação** — reunir evidências do comportamento atual, contexto, impacto e restrições.
2. **Esclarecimento de dúvidas** — resolver ambiguidades que alterem escopo, regra ou critério de aceite.
3. **Criação da SPEC** — documentar comportamento desejado, limites, riscos, testes e critérios de aceite.
4. **Aprovação da decisão funcional** — somente uma SPEC explicitamente aprovada, uma decisão já presente na `main` ou uma autorização rastreável na tarefa atual pode autorizar implementação.
5. **Implementação** — alterar apenas o escopo e os arquivos autorizados pela SPEC.
6. **Revisão técnica** — uma pessoa, agente diferente ou o próprio agente, quando autorizado pelo fluxo Git, verifica aderência, riscos e regressões.
7. **Testes automatizados** — executar os níveis aplicáveis e registrar comandos, resultados e evidências.
8. **Aceitação humana, quando exigida** — validar o comportamento contra os critérios aprovados quando a SPEC, o risco ou a natureza da mudança assim determinar.
9. **Merge** — realizado após atendimento da Definition of Done, podendo ser automático por agente quando não houver bloqueios humanos.

Nenhuma funcionalidade pode ser implementada sem uma SPEC aprovada. A aprovação da decisão funcional, a revisão técnica e a autorização mecânica de merge são etapas distintas: a decisão funcional pode estar previamente aprovada na `main`, na própria SPEC ou na tarefa atual, sem exigir uma segunda aprovação do mesmo conteúdo no pull request.

## Controle de mudança

- Uma SPEC não pode ser alterada silenciosamente durante a implementação.
- Uma necessidade não prevista deve interromper a implementação quando afetar comportamento, escopo, dados, segurança, dependências ou critérios de aceite.
- A necessidade nova deve ser registrada como dúvida, decisão ou revisão da SPEC e submetida a aprovação humana.
- Mudanças aprovadas devem constar no histórico de decisões da SPEC, com data, responsável e justificativa.
- A ausência de aprovação humana manual de um pull request não autoriza o agente a escolher sozinho alternativas funcionais ou arquiteturais relevantes.
- Implementação e documentação devem permanecer rastreáveis ao mesmo identificador de SPEC.

## Status da SPEC

Cada SPEC deve declarar um status visível. Estados sugeridos:

- `Rascunho`;
- `Em revisão`;
- `Aprovada`;
- `Em implementação`;
- `Em validação`;
- `Concluída`;
- `Substituída` ou `Cancelada`.

Somente `Aprovada` autoriza o início da implementação. A transição de status e toda decisão relevante devem ser registradas no histórico da própria SPEC.

## Templates

- Use [FEATURE-SPEC-TEMPLATE.md](templates/FEATURE-SPEC-TEMPLATE.md) para funcionalidades e mudanças planejadas de comportamento.
- Use [BUG-SPEC-TEMPLATE.md](templates/BUG-SPEC-TEMPLATE.md) para defeitos cujo comportamento observado diverge do esperado.

Se uma seção do template não se aplicar, escreva **“Não aplicável”** e justifique. Não remova silenciosamente a seção.

## Referências obrigatórias

- [Fluxo de trabalho com Git](../process/GIT-WORKFLOW.md)
- [Definition of Done](../quality/DEFINITION-OF-DONE.md)
- [Estratégia de testes](../quality/TEST-STRATEGY.md)

## Índice de especificações

| SPEC | Título | Status |
|---|---|---|
| [SPEC-000](SPEC-000-SCAFFOLD-TECNICO.md) | Scaffold técnico | Consulte o documento |
| [SPEC-001](SPEC-001-CI-VALIDACAO-SCAFFOLD.md) | CI e validação do scaffold | Consulte o documento |
| [SPEC-002](SPEC-002-AUTENTICACAO-E-ISOLAMENTO-POR-USUARIO.md) | Autenticação e isolamento por usuário | Consulte o documento |
| [SPEC-003](SPEC-003-CONTAS-E-SALDOS-INICIAIS.md) | Contas financeiras e saldos iniciais | Consulte o documento |
| [SPEC-004](SPEC-004-CATEGORIAS-FINANCEIRAS.md) | Categorias financeiras | Consulte o documento |
| [SPEC-005](SPEC-005-LANCAMENTOS-FINANCEIROS.md) | Lançamentos financeiros básicos | Consulte o documento |
| [SPEC-006](SPEC-006-TRANSFERENCIAS-ENTRE-CONTAS.md) | Transferências entre contas | Consulte o documento |
| [SPEC-007](SPEC-007-RECORRENCIAS-FINANCEIRAS.md) | Recorrências financeiras | Consulte o documento |
| [SPEC-008](SPEC-008-CARTOES-DE-CREDITO-E-FATURAS.md) | Cartões de crédito e faturas | Consulte o documento |
| [SPEC-009](SPEC-009-DIVIDAS-E-FINANCIAMENTOS.md) | Dívidas e financiamentos | Consulte o documento |
| [SPEC-010](SPEC-010-ORCAMENTO-MENSAL.md) | Orçamento mensal | Consulte o documento |
| [SPEC-011](SPEC-011-DASHBOARD-FINANCEIRO.md) | Dashboard financeiro | Consulte o documento |
| [SPEC-012](SPEC-012-ANDROID-INTERNO-CAPACITOR.md) | Android interno com Capacitor | Consulte o documento |
| [SPEC-013](SPEC-013-UX-MOBILE-FIRST-E-NAVEGACAO-PRINCIPAL.md) | UX mobile-first e navegação principal | Aprovada |
| [SPEC-014](SPEC-014-MODELOS-DE-LANCAMENTO-E-INTEGRACAO-COM-RECORRENCIAS.md) | Modelos de lançamento e integração com recorrências | Aprovada |
| [SPEC-015](SPEC-015-FIXTURE-LOCAL-AUTENTICACAO-TESTES.md) | Fixture local de autenticação para testes | Aprovada |
| [SPEC-016](SPEC-016-UX-LANCAMENTOS-FASE-B.md) | UX de Lançamentos Fase B | Aprovada |
| [SPEC-017](SPEC-017-EXCLUSAO-INDIVIDUAL-LANCAMENTO.md) | Exclusão individual de lançamento | Aprovada |
| [SPEC-018](SPEC-018-PERSONALIZACAO-VISUAL-USUARIO.md) | Personalização visual por usuário | Aprovada |
| [SPEC-019](SPEC-019-SETUP-INICIAL-OPCIONAL.md) | Setup inicial opcional | Aprovada |
| [SPEC-020](SPEC-020-DX-COMANDOS-ANDROID-LOCAL.md) | DX comandos Android local | Aprovada |
| [SPEC-021](SPEC-021-IMPORTACAO-OFX-CSV.md) | Importação financeira OFX/CSV com revisão humana | Aprovada |
