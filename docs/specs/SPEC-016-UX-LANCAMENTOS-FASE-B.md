# SPEC-016 - UX de Lançamentos Fase B

## Status

Aprovada

## Aprovação

Autorização rastreável na tarefa `PROMPT-UX-LANCAMENTOS-FASE-B.md`.

## Contexto

A tela de Lançamentos já possui listagem, filtros, criação, edição, pagamento, reabertura e integração com modelos. Após validação em uso real, foram priorizadas melhorias de usabilidade sem alterar os contratos de autenticação, recorrências, Dashboard, Orçamento, Minha Conta ou personalização.

## Escopo

- Aplicar filtro inicial de vencimento para o mês civil atual na entrada da listagem.
- Agrupar visualmente a lista em Hoje, Futuros e Anteriores por data civil de vencimento.
- Diferenciar visualmente lançamentos pagos e pendentes sem depender apenas de cor.
- Ajustar valores principais: pendente prioriza previsto; pago prioriza realizado e mantém previsto secundário.
- Melhorar defaults do novo lançamento: vencimento hoje, seleção automática quando existir exatamente uma conta ativa ou uma categoria ativa compatível, status pendente.
- Ao trocar para Pago, preencher realizado e data de pagamento a partir de previsto e vencimento enquanto esses campos não tiverem sido editados manualmente.
- Separar visualmente modelos por natureza no seletor, com abas Despesa, Receita e Todos.
- Documentar que exclusão de lançamento fica bloqueada enquanto não houver contrato seguro no backend.

## Fora de Escopo

- Criar endpoint de exclusão, archive ou hard delete para lançamento.
- Alterar autenticação, cookies, refresh, CSRF ou rate limit.
- Alterar Dashboard, Orçamento, Minha Conta, setup inicial, personalização de cores ou fluxo Android nativo.
- Alterar regra de recorrência além do uso já existente.
- Adicionar dependências.

## Regras Funcionais

1. Ao abrir Lançamentos, o filtro `dueDateFrom` deve apontar para o primeiro dia do mês civil atual e `dueDateTo` para o último dia do mesmo mês.
2. O usuário pode alterar ou remover os filtros, e ações explícitas na sessão não devem ser sobrescritas por defaults automáticos.
3. O cálculo de data civil deve usar ano, mês e dia locais, sem conversão UTC que desloque a data.
4. A listagem deve exibir grupos semânticos:
   - Hoje: vencimento igual à data civil atual.
   - Futuros: vencimento posterior à data civil atual.
   - Anteriores: vencimento anterior à data civil atual.
5. Grupos vazios não aparecem.
6. Status Pago/Pendente não altera o grupo de data.
7. Lançamento pago deve destacar valor realizado e manter valor previsto visível como secundário.
8. Lançamento pendente deve destacar valor previsto.
9. O novo lançamento deve iniciar com vencimento na data civil atual e status Pendente.
10. Se houver exatamente uma conta ativa, ela deve ser selecionada automaticamente.
11. Se houver exatamente uma categoria ativa compatível com a natureza atual, ela deve ser selecionada automaticamente.
12. Ao trocar a natureza, categoria incompatível deve ser removida e a seleção automática deve ser reaplicada somente quando houver uma única categoria compatível.
13. Ao mudar de Pendente para Pago, valor realizado e data de pagamento devem ser preenchidos automaticamente apenas enquanto não tiverem sido editados manualmente.
14. Alterações manuais em realizado ou data de pagamento impedem sobrescrita automática posterior.
15. O seletor de modelos deve abrir inicialmente filtrado pela natureza atual do lançamento e permitir alternar para Despesa, Receita ou Todos.

## Exclusão

O backend atual de `transactions` não possui endpoint de exclusão/archive individual. A SPEC-005 também registra que exclusão/archive/hard delete de lançamentos não faz parte do escopo. Portanto, a ação de excluir lançamento não será implementada nesta fase para não introduzir contrato novo nem risco sobre ocorrências de recorrência.

## Testes

- Relógio controlado para filtro inicial do mês atual e agrupamento Hoje/Futuros/Anteriores.
- Testes de diferenciação Pago/Pendente e prioridade monetária.
- Testes de defaults do formulário dedicado.
- Testes para preenchimento automático de Pago sem sobrescrever campos editados manualmente.
- Testes para abas de modelos por natureza e busca com oito ou mais modelos.

## Histórico de Decisões

- 2026-08-12: SPEC aprovada pela tarefa atual; exclusão retirada da implementação por ausência de contrato seguro existente e conflito com SPEC-005.
