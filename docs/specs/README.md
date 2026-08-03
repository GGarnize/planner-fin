# Desenvolvimento dirigido por especificações

## Finalidade

Este diretório contém as especificações funcionais e de correção do projeto. Uma SPEC descreve o comportamento aprovado para uma unidade de trabalho e estabelece o contrato de escopo entre investigação, implementação, revisão e aceite.

Documentos AS-IS registram o que foi observado no estado atual. Eles **não representam automaticamente o comportamento TO-BE** e não autorizam implementação sem esclarecimento, decisão e aprovação de uma SPEC.

## Ciclo obrigatório

Toda funcionalidade ou correção deve seguir esta sequência:

1. **Investigação** — reunir evidências do comportamento atual, contexto, impacto e restrições.
2. **Esclarecimento de dúvidas** — resolver ambiguidades que alterem escopo, regra ou critério de aceite.
3. **Criação da SPEC** — documentar comportamento desejado, limites, riscos, testes e critérios de aceite.
4. **Revisão e aprovação humana** — somente uma SPEC explicitamente aprovada pode autorizar implementação.
5. **Implementação** — alterar apenas o escopo e os arquivos autorizados pela SPEC.
6. **Revisão independente** — uma pessoa ou agente diferente verifica aderência, riscos e regressões.
7. **Testes automatizados** — executar os níveis aplicáveis e registrar comandos, resultados e evidências.
8. **Teste de aceitação humano** — validar o comportamento contra os critérios aprovados.
9. **Merge** — realizado somente após validação humana e atendimento da Definition of Done.

Nenhuma funcionalidade pode ser implementada sem uma SPEC aprovada.

## Controle de mudança

- Uma SPEC não pode ser alterada silenciosamente durante a implementação.
- Uma necessidade não prevista deve interromper a implementação quando afetar comportamento, escopo, dados, segurança, dependências ou critérios de aceite.
- A necessidade nova deve ser registrada como dúvida, decisão ou revisão da SPEC e submetida a aprovação humana.
- Mudanças aprovadas devem constar no histórico de decisões da SPEC, com data, responsável e justificativa.
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


