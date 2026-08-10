# SPEC de funcionalidade — `SPEC-011 — Dashboard financeiro`

## 1. Identificação

| Campo | Valor |
|---|---|
| ID | `SPEC-011` |
| Título | Dashboard financeiro |
| Responsável | Equipe PlannerFin |
| Data de criação | 2026-08-10 |
| Última atualização | 2026-08-10 |
| Tarefa relacionada | `PROMPT-SPEC-011-DASHBOARD-FINANCEIRO.md` |
| Documentos relacionados | [SPEC-002](./SPEC-002-AUTENTICACAO-E-ISOLAMENTO-POR-USUARIO.md), [SPEC-003](./SPEC-003-CONTAS-E-SALDOS-INICIAIS.md), [SPEC-005](./SPEC-005-LANCAMENTOS-FINANCEIROS.md), [SPEC-006](./SPEC-006-TRANSFERENCIAS-ENTRE-CONTAS.md), [SPEC-008](./SPEC-008-CARTOES-DE-CREDITO-E-FATURAS.md), [SPEC-009](./SPEC-009-DIVIDAS-E-FINANCIAMENTOS.md), [SPEC-010](./SPEC-010-ORCAMENTO-MENSAL.md), [DoD](../quality/DEFINITION-OF-DONE.md) e [estratégia de testes](../quality/TEST-STRATEGY.md) |

## 2. Status

`Aprovada`

**Aprovada por:** solicitante da tarefa, em 2026-08-10.

## 3. Contexto

Os domínios de autenticação, contas, categorias, lançamentos, transferências, recorrências, cartões, dívidas e orçamento possuem contratos aprovados. Falta uma entrada financeira que componha essas fontes sem criar fatos nem redefinir sua semântica. Esta SPEC fecha essa projeção de leitura e preserva especialmente a competência orçamentária da SPEC-010 e o caixa realizado da SPEC-003.

## 4. Problema

O usuário precisa consultar sua posição atual, o fluxo de um mês e obrigações relevantes sem visitar cada domínio. Sem contrato composto, implementações poderiam somar parcialmente saldos indisponíveis, duplicar pagamentos como despesas ou ler fontes em instantes incompatíveis.

## 5. Objetivo

Definir a rota protegida `/dashboard`, um único `GET /api/dashboard?month=YYYY-MM`, contratos compartilhados exatos, fontes e regras de projeção, estados de interface e requisitos de consistência, segurança e desempenho do dashboard MVP.

## 6. Fora do escopo

- Código, Prisma, migration, seed, dependência, CI ou persistência nesta unidade documental.
- Aconselhamento financeiro, score, IA, recomendação, forecast, média móvel ou tendência percentual contra mês anterior.
- CRUD, formulários ou correções automáticas dentro do dashboard; ações rápidas são somente links.
- Gráficos complexos, biblioteca de chart, cache persistente/distribuído, tabela, snapshot ou materialized view.
- Comparação automática entre meses; o usuário navega manualmente.

## 7. Termos

| Termo | Definição adotada nesta SPEC |
|---|---|
| `month` | Mês civil canônico `YYYY-MM` usado nas métricas mensais. |
| `todayCivil` | Data civil atual do usuário obtida pelo helper aprovado, sem UTC implícito. |
| Posição de caixa | Soma atual dos `realizedBalance` de contas ativas, quando todos estão disponíveis. |
| Realizado | Reconhecimento econômico conforme fontes aprovadas; não é sinônimo de saldo bancário. |
| Comprometido | Plano de despesas do mês segundo a projeção da SPEC-010. |
| Vencido projetado | Condição derivada para obrigação pendente anterior a `todayCivil`; nunca persistida. |
| Snapshot | Ponto lógico único de leitura obtido em transação PostgreSQL `RepeatableRead`. |

## 8. Comportamento atual

Os domínios expõem isoladamente suas fontes. A SPEC-003 deriva `realizedBalance` por caixa e pode retornar `null` antes do corte; a SPEC-005 distingue `dueDate` planejada de `paidAt` de caixa; a SPEC-008 reconhece compra por parcela e exclui pagamento de fatura da despesa; a SPEC-009 separa principal de juros/tarifas; a SPEC-010 consolida despesa mensal. Não há dashboard composto aprovado.

## 9. Comportamento desejado

### 9.1 Princípio, período e navegação

O dashboard é exclusivamente uma projeção de leitura. Consultá-lo não cria, altera, corrige nem materializa fatos, orçamento ou saldo. A web protegida usa `/dashboard`; login bem-sucedido redireciona para essa rota, e usuário já autenticado que chega à home técnica também é redirecionado. Logout conserva o fluxo da SPEC-002.

A web sempre envia `month`. O padrão visual é o mês civil atual do usuário, calculado por componentes locais, nunca por `toISOString()`. Há controles para mês anterior, próximo e retorno ao atual, inclusive na virada do ano. `month` governa fluxo, orçamento e categorias; posição de caixa e janelas de obrigações usam `todayCivil` e não simulam saldo no fim do mês escolhido.

### 9.2 Posição de caixa atual

A fonte é `PublicFinancialAccount.realizedBalance` da SPEC-003, ou o mesmo projetor backend, somente para contas ativas:

- sem conta ativa: total `"0.00"`, contadores zero e estado “Nenhuma conta ativa”;
- todas disponíveis: soma decimal exata e contagem das disponíveis;
- ao menos uma `null`: total `null`, sem soma parcial rotulada como total; contadores distinguem disponíveis e indisponíveis;
- arquivadas não entram, mas permanecem acessíveis no domínio de contas.

Quando o total for `null`, a UI mostra “Saldo total atual ainda não disponível”, “Há N conta(s) com posição inicial futura” e “Ver contas”; nunca mostra `R$ 0,00` nem esconde a causa. Saldos individuais disponíveis podem aparecer, mas nenhuma soma parcial recebe o rótulo total.

### 9.3 Fluxo financeiro mensal

`incomeRealized` soma `actualAmount` de `FinancialTransaction INCOME PAID` cujo `dueDate` pertence ao mês. A decisão usa competência planejada coerente com a SPEC-005/010; `paidAt` continua exclusivamente data de caixa e não desloca o cartão mensal. `incomePlanned` soma `plannedAmount` de `INCOME PENDING` e `INCOME PAID` no mês de `dueDate`.

`expenseRealized` e `expenseCommitted` reutilizam exatamente a projeção da SPEC-010:

```text
expenseRealized = EXPENSE PAID.actualAmount por dueDate
                + CardInstallment.amount por referenceMonth
                + DebtPayment.interestAmount + feeAmount por paymentDate

expenseCommitted = EXPENSE PENDING/PAID.plannedAmount por dueDate
                 + CardInstallment.amount por referenceMonth
                 + DebtPayment.interestAmount + feeAmount por paymentDate
```

`FinancialTransfer`, `CardInvoicePayment`, `DebtFunding`, principal de `DebtPayment`, saldos e receitas artificiais ficam fora. `realizedNet = incomeRealized - expenseRealized`; `plannedNet = incomePlanned - expenseCommitted`. Todos são strings decimais de duas casas, inclusive negativos, rotulados “Resultado realizado” e “Resultado planejado/comprometido”, nunca “saldo”.

### 9.4 Orçamento

Fonte exclusiva: `MonthlyBudget` e a projeção integral da SPEC-010. O dashboard reutiliza o projetor, sem segunda implementação. Mês sem orçamento retorna `budget: null` com HTTP 200; a UI mostra “Nenhum orçamento para YYYY-MM” e link `/budgets`. `exceeded` é `remainingAgainstCommitted < 0`. Campos `unbudgeted*` não são duplicados no card.

### 9.5 Próximos lançamentos

`upcomingTransactions` contém apenas `FinancialTransaction PENDING` de receita ou despesa: todos os vencidos (`dueDate < todayCivil`) e os a vencer no intervalo inclusivo `todayCivil` até `todayCivil + 7 dias` civis. Hoje não é vencido; depois de sete dias fica fora. Ordena vencidos primeiro, depois `dueDate ASC`, `id ASC`, e corta os primeiros 10 no conjunto total. Cartão, dívida, transferência e `PAID` não entram. `categoryName` pode ser `null`; `notes` nunca sai.

### 9.6 Faturas

`cardInvoices` contém faturas próprias `OPEN` ou `CLOSED`, exclui `PAID`, ordena por `dueDate ASC`, `invoiceId ASC` e limita a 5. `projectedOverdue` é verdadeiro somente para `CLOSED` com `dueDate < todayCivil`; uma fatura `OPEN` não é rotulada vencida, preservando o estado da SPEC-008. `total` é a soma já derivada das parcelas. É “valor a pagar”, obrigação de caixa, não despesa nova; `CardInvoicePayment` jamais é recontado.

### 9.7 Dívidas

`debtInstallments` contém parcelas próprias `PENDING` vencidas ou entre `todayCivil` e `todayCivil + 30 dias` inclusivos, ordenadas por vencidas primeiro, `dueDate ASC`, `installmentNumber ASC`, `installmentId ASC`, com máximo 5. `projectedStatus` é `OVERDUE` ou `PENDING`; `totalAmount` soma exatamente principal, juros e tarifa. A obrigação exibe o total, mas somente juros/tarifas de `DebtPayment` pago entram em despesa; principal nunca entra.

### 9.8 Despesas por categoria e contadores

Categorias usam a parte categorizável de `expenseRealized`: `FinancialTransaction EXPENSE PAID.actualAmount` pela categoria e `CardInstallment.amount` pela categoria da compra. Retornam todas as categorias com gasto maior que zero, ordenadas por `amount DESC`, `categoryName ASC`, `categoryId ASC`; não há limite, pseudo-categoria “Outros” nem `otherCategoriesAmount`. Juros/tarifas pagos não têm categoria e retornam em `uncategorizedDebtCostRealized`, inclusive `"0.00"` quando inexistentes.

Os quatro contadores são derivados dos mesmos conjuntos-base dos cards, antes do limite visual: vencidos e próximos de lançamentos, todas as faturas não pagas elegíveis e parcelas vencidas. Assim, um contador pode superar o tamanho do array sem inconsistência semântica.

### 9.9 Cenário consolidado

Com contas A `1000.00` e B `500.00`, o caixa é `1500.00`. Em `2026-08`, considere receita pendente planejada `1000.00`; receita paga planejada `2000.00`, real `1950.00`; despesa pendente planejada `300.00`; despesa paga planejada `500.00`, real `480.00`; parcela de cartão `200.00`; pagamento de dívida com principal `400.00`, juros `20.00`, tarifa `5.00`; transferência `999.00`; pagamento de fatura `680.00`; funding `1000.00`.

```text
incomeRealized = 1950.00
incomePlanned = 1000.00 + 2000.00 = 3000.00
expenseRealized = 480.00 + 200.00 + 20.00 + 5.00 = 705.00
expenseCommitted = 300.00 + 500.00 + 200.00 + 20.00 + 5.00 = 1025.00
realizedNet = 1950.00 - 705.00 = 1245.00
plannedNet = 3000.00 - 1025.00 = 1975.00
```

Transferência, pagamento de fatura, funding e principal ficam fora. Se uma conta C ativa tiver `realizedBalance = null`, o total passa a `null`, `availableAccountCount = 2`, `unavailableAccountCount = 1`, e `1500.00` nunca é retornado como total.

## 10. Personas ou atores

| Ator | Necessidade | Ações autorizadas |
|---|---|---|
| Usuário autenticado | Ver projeção financeira própria | Consultar meses e seguir links dos seus domínios. |
| Visitante | Nenhuma | Autenticar-se; não consultar dashboard. |

## 11. Fluxos

### 11.1 Fluxo principal

1. Após login, a web abre `/dashboard` com o mês civil local atual.
2. Envia `GET /api/dashboard?month=YYYY-MM` autenticado.
3. A API valida query e owner e abre transação de leitura `RepeatableRead`.
4. Projeta todas as fontes com helpers aprovados, em consultas agregadas e fixas.
5. Retorna o contrato integral e a web renderiza cards, listas e links.
6. Ao navegar entre meses, a web repete a consulta; caixa permanece “hoje”.

### 11.2 Fluxos alternativos e exceções

- Sem orçamento → resposta 200 com `budget: null`.
- Sem fatos → zeros, arrays vazios e contadores zero.
- Saldo futuro → caixa `null` e explicação explícita.
- Query inválida ou extra → 400 sanitizado.
- Sem autenticação → 401 conforme SPEC-002.
- Falha essencial → rollback da leitura e 500 sanitizado, sem resposta parcial.

## 12. Regras de negócio

| ID | Regra | Origem/decisão | Exemplo |
|---|---|---|---|
| `RN-01` | Dashboard é leitura sem efeito persistente. | Princípio desta SPEC | GET não cria snapshot. |
| `RN-02` | `month` é obrigatório, único e canônico. | Contrato determinístico | `2026-08`. |
| `RN-03` | Caixa considera só contas ativas e hoje civil. | SPEC-003 | Arquivada excluída. |
| `RN-04` | Qualquer saldo ativo indisponível torna o total `null`. | Decisão desta SPEC | Não somar parcialmente. |
| `RN-05` | Sem conta ativa totaliza `"0.00"`. | Decisão desta SPEC | Contadores zero. |
| `RN-06` | Receita mensal usa `dueDate`; realizada usa real e planejada usa plano. | SPEC-005/decisão | Pagamento tardio não move mês. |
| `RN-07` | Despesas reutilizam integralmente a SPEC-010. | SPEC-010 | Parcela entra uma vez. |
| `RN-08` | Resultados são diferenças e não saldo. | Decisão desta SPEC | Podem ser negativos. |
| `RN-09` | Budget ausente é `null`, não erro. | SPEC-010 | HTTP 200. |
| `RN-10` | Lançamentos usam janelas civis inclusivas e limite 10. | Decisão desta SPEC | Hoje não vencido. |
| `RN-11` | Faturas não pagas têm limite 5 e não geram nova despesa. | SPEC-008 | Pagamento excluído. |
| `RN-12` | Parcelas pendentes vencidas/próximas têm limite 5. | SPEC-009 | Janela de 30 dias. |
| `RN-13` | Principal é obrigação, nunca despesa. | SPEC-009 | Total pode exibi-lo. |
| `RN-14` | Categorias retornam todas as quantias positivas e dívida separada. | SPEC-010 | Sem “Outros”. |
| `RN-15` | Dinheiro usa decimal exato e JSON de duas casas. | SPECs anteriores | Nunca float. |
| `RN-16` | Toda leitura usa owner do token no mesmo snapshot. | Segurança/consistência | Nenhum `userId` cliente. |
| `RN-17` | Conjunto de queries é fixo, sem N+1, preferencialmente até 12. | Desempenho | Agregação no banco. |
| `RN-18` | Falha essencial invalida a resposta inteira. | Atomicidade de leitura | 500 sem parcial. |

## 13. Modelo de dados

Não há entidade nem persistência nova. A projeção lê entidades aprovadas e produz DTOs efêmeros. É proibido criar model Prisma, migration, tabela, view materializada, snapshot ou cache persistente. Necessidade futura de materialização exige nova SPEC.

| Fonte | Campos conceituais usados | Regra |
|---|---|---|
| Conta | status, `realizedBalance` | Projetor da SPEC-003. |
| Lançamento | type, status, valores, `dueDate`, categoria | SPEC-005/010. |
| Orçamento | limites e projeções | Serviço da SPEC-010. |
| Fatura/parcela | identidade, ciclo, estado, total, vencimento | SPEC-008. |
| Dívida/parcela/pagamento | identidade, credor, componentes e datas | SPEC-009. |

## 14. Contratos de API

### 14.1 Tipos compartilhados exatos

```ts
type DashboardCashPosition = {
  totalRealizedBalance: string | null;
  availableAccountCount: number;
  unavailableAccountCount: number;
};

type DashboardMonthlyFlow = {
  incomeRealized: string;
  incomePlanned: string;
  expenseRealized: string;
  expenseCommitted: string;
  realizedNet: string;
  plannedNet: string;
};

type DashboardBudgetSummary = {
  id: string;
  totalLimit: string;
  realizedExpense: string;
  committedExpense: string;
  remainingAgainstRealized: string;
  remainingAgainstCommitted: string;
  realizedPercent: string;
  committedPercent: string;
  exceeded: boolean;
};

type DashboardTransactionItem = {
  id: string;
  type: "INCOME" | "EXPENSE";
  description: string;
  plannedAmount: string;
  dueDate: string;
  categoryName: string | null;
  overdue: boolean;
};

type DashboardCardInvoiceItem = {
  invoiceId: string;
  cardId: string;
  cardName: string;
  referenceMonth: string;
  status: "OPEN" | "CLOSED";
  total: string;
  dueDate: string;
  projectedOverdue: boolean;
};

type DashboardDebtInstallmentItem = {
  debtId: string;
  installmentId: string;
  creditorName: string;
  installmentNumber: number;
  dueDate: string;
  totalAmount: string;
  projectedStatus: "PENDING" | "OVERDUE";
  principalAmount: string;
  interestAmount: string;
  feeAmount: string;
};

type DashboardCategoryExpense = {
  categoryId: string;
  categoryName: string;
  amount: string;
};

type DashboardCounters = {
  overdueTransactions: number;
  upcomingTransactions: number;
  unpaidCardInvoices: number;
  overdueDebtInstallments: number;
};

type DashboardResponse = {
  month: string;
  generatedAt: string;
  cashPosition: DashboardCashPosition;
  monthlyFlow: DashboardMonthlyFlow;
  budget: DashboardBudgetSummary | null;
  upcomingTransactions: DashboardTransactionItem[];
  cardInvoices: DashboardCardInvoiceItem[];
  debtInstallments: DashboardDebtInstallmentItem[];
  expenseByCategory: {
    categories: DashboardCategoryExpense[];
    uncategorizedDebtCostRealized: string;
  };
  counters: DashboardCounters;
};
```

Os contratos não importam Prisma, não contêm `userId` e serializam dinheiro em string de duas casas. `generatedAt` é instante ISO 8601 UTC de geração, informativo, obtido dentro da operação.

### 14.2 Consultar — `GET /api/dashboard?month=YYYY-MM`

- Entrada: exatamente um parâmetro `month`, obrigatório, singular e estrito; nenhum body.
- Saída: 200 com `DashboardResponse` integral.
- Erros: 400 para ausente, repetido, inválido ou parâmetro extra; 401 sem sessão; 500 sanitizado para falha essencial.
- Autorização: usuário da sessão; todas as consultas filtram seu `userId` internamente.
- Idempotência: leitura idempotente quanto a efeitos; fatos concorrentes podem alterar respostas entre requisições.
- Consistência: todas as queries dentro da mesma transação de leitura PostgreSQL `RepeatableRead`.
- Versionamento: rota MVP sem prefixo adicional, compatível com as APIs existentes.

## 15. Interface

`/dashboard` é protegida, mobile first e destino pós-login. Contém seletor de mês; card de caixa; cards de receitas, despesas e resultados; orçamento com barra simples; blocos “Próximos lançamentos”, “Faturas”, “Dívidas” e “Despesas por categoria”. Cards empilham; ações principais não causam rolagem horizontal; tabelas viram listas em telas estreitas.

Estados explícitos: loading; API indisponível; nenhuma conta; caixa indisponível; orçamento ausente; mês sem fatos; seção vazia. Categorias podem usar lista com barra horizontal simples, sem biblioteca. Links: “Ver contas” (`/accounts`), “Ver lançamentos” (`/transactions`), “Ver cartões” (`/cards`), “Ver dívidas” (`/debts`) e “Ver orçamento” (`/budgets`). Não há modal nem formulário CRUD.

## 16. Validações

| Campo ou ação | Validação | Mensagem/resultado esperado |
|---|---|---|
| `month` | Obrigatório, único, regex e mês gregoriano `YYYY-MM`. | 400 sanitizado. |
| Query | Chaves fechadas; somente `month`. | Extra ou repetição dá 400. |
| Dinheiro | Decimal exato, duas casas no JSON. | Nunca conversão por float. |
| Data civil | Helper aprovado e soma segura de dias. | Sem deslocamento UTC. |
| Arrays | Ordenação e limites definidos antes de serializar. | 10/5/5. |

## 17. Permissões

| Ação | Ator autorizado | Condição | Comportamento quando negado |
|---|---|---|---|
| Abrir `/dashboard` | Usuário autenticado | Sessão válida | Fluxo de login da SPEC-002. |
| Consultar API | Usuário autenticado | Token/sessão válida | 401 sanitizado. |
| Ler recurso | Dono derivado do token | `userId` em toda query | Recurso alheio não aparece. |

## 18. Segurança e privacidade

- Dados sensíveis: valores, descrições, nomes de cartão e credor e período financeiro.
- Ameaças: IDOR, enumeração, vazamento em logs/cache, query aberta e mistura de snapshots/owners.
- Proteções: auth obrigatória, owner backend em toda query, DTO fechado, selects mínimos, CSRF/CORS existentes intactos, sem cache compartilhado e resposta unitária.
- Proibidos na resposta: `userId`, `notes` de lançamento/orçamento/dívida e campos não declarados.
- Proibidos nos logs: valores, payload, descrições, `creditorName`, `cardName` e `month` associado ao usuário quando a política vigente o considerar sensível.

## 19. Erros e estados vazios

| Situação | Estado apresentado | Recuperação esperada |
|---|---|---|
| Sem contas | Total `"0.00"`, counts zero, “Nenhuma conta ativa”. | “Ver contas”. |
| Saldo indisponível | Total `null` e motivo visível. | “Ver contas”. |
| Sem orçamento | 200, `budget: null`. | “Ver orçamento”. |
| Sem fatos | Dinheiro `"0.00"`, arrays vazios, counts zero. | Navegar mês/domínio. |
| Seção vazia | Mensagem local, restante preservado. | Link do domínio. |
| API indisponível | Estado de erro da página, sem dado parcial. | Tentar novamente. |
| Falha essencial | 500 sanitizado, sem `partialSuccess`. | Tentar novamente/request id. |

## 20. Observabilidade

Sem infraestrutura nova. Registrar somente operação `dashboard.read`, duração, status/código, request id e quantidade de queries se a infraestrutura atual permitir. Não registrar conteúdo financeiro, nomes, descrições, payload completo nem período sensível. Monitoramento de latência/erro usa mecanismos existentes.

## 21. Migração e compatibilidade

- Dados existentes: somente lidos pelas regras aprovadas.
- Compatibilidade retroativa: nova rota e novos DTOs; nenhum contrato anterior muda.
- Migração necessária: não; persistência e índices novos são proibidos sem evidência e nova unidade aprovada.
- Implantação gradual: API e web futuras devem ser entregues juntas; CI permanece inalterado.

### 21.1 Reutilização, snapshot e desempenho

A implementação futura reutiliza: projetor de Accounts para saldo; projetor/helper de Budgets para despesas e orçamento; helper de data civil para vencimento; projeção de installment de Debts; total/status de Cards. Se necessário, helpers puros podem ir a módulo interno compartilhado da API, sem pacote externo e sem dependência circular.

Todas as queries executam na mesma transação `RepeatableRead`; uma atualização concorrente resulta em visão integralmente anterior ou posterior conforme o snapshot, nunca mistura. O conjunto de SQL é fixo, independente do volume, com agregações no banco, selects mínimos e sem query em loop. Meta preferencial: no máximo 12 queries. Excedê-la exige justificativa técnica, evidência do plano e prova de ausência de N+1. Índice/migration só em unidade futura, após `EXPLAIN` demonstrar necessidade.

## 22. Critérios de aceite

### `CA-01 — Sem conta ativa`
**Dado** nenhum cadastro ativo **Quando** consulta o dashboard **Então** o caixa retorna `"0.00"`, counts zero e a UI informa “Nenhuma conta ativa”.

### `CA-02 — Todas disponíveis`
**Dado** contas ativas com saldos disponíveis **Quando** projeta o caixa **Então** soma todas exatamente.

### `CA-03 — Uma indisponível`
**Dado** uma conta ativa com `realizedBalance=null` **Quando** projeta **Então** o total é `null`.

### `CA-04 — Várias indisponíveis`
**Dado** várias contas ativas indisponíveis **Quando** projeta **Então** conta todas em `unavailableAccountCount`.

### `CA-05 — Arquivada excluída`
**Dado** conta arquivada com saldo **Quando** projeta **Então** ela não entra no total nem nos counts.

### `CA-06 — Decimal do caixa`
**Dado** saldos com centavos **Quando** soma **Então** usa decimal exato e duas casas.

### `CA-07 — Null não é zero`
**Dado** saldo futuro **Quando** renderiza **Então** não mostra `R$ 0,00`.

### `CA-08 — Parcial não é total`
**Dado** duas contas disponíveis e uma indisponível **Quando** renderiza **Então** nenhuma soma parcial é rotulada total.

### `CA-09 — Mensagem do caixa`
**Dado** total `null` **Quando** renderiza **Então** mostra as duas mensagens aprovadas e “Ver contas”.

### `CA-10 — Caixa independe do mês`
**Dado** mês passado selecionado **Quando** consulta **Então** caixa continua em `todayCivil`.

### `CA-11 — Receita pendente planejada`
**Dado** INCOME PENDING no mês **Quando** agrega **Então** soma plano apenas em `incomePlanned`.

### `CA-12 — Receita paga`
**Dado** INCOME PAID no mês **Quando** agrega **Então** soma real em realizado e plano em planejado.

### `CA-13 — Competência da receita`
**Dado** `dueDate` em agosto e `paidAt` setembro **Quando** consulta **Então** a receita mensal pertence a agosto.

### `CA-14 — Despesa paga`
**Dado** EXPENSE PAID no mês **Quando** agrega **Então** real usa `actualAmount` e comprometido usa `plannedAmount`.

### `CA-15 — Despesa pendente`
**Dado** EXPENSE PENDING **Quando** agrega **Então** entra apenas no comprometido pelo plano.

### `CA-16 — Parcela de cartão`
**Dado** parcela no `referenceMonth` **Quando** agrega **Então** seu `amount` entra uma vez em realizado e comprometido.

### `CA-17 — Custo de dívida`
**Dado** pagamento no mês **Quando** agrega **Então** juros e tarifa entram uma vez em ambos.

### `CA-18 — Principal excluído`
**Dado** pagamento com principal **Quando** agrega despesa **Então** principal fica fora.

### `CA-19 — Fontes excluídas`
**Dado** transfer, funding e pagamento de fatura **Quando** agrega **Então** nenhum vira receita ou despesa.

### `CA-20 — Resultado positivo`
**Dado** receita superior à despesa **Quando** calcula nets **Então** retorna diferenças positivas exatas.

### `CA-21 — Resultado negativo`
**Dado** despesa superior à receita **Quando** calcula nets **Então** retorna strings negativas exatas.

### `CA-22 — Terminologia`
**Dado** os dois nets **Quando** renderiza **Então** usa “resultado”, nunca “saldo”.

### `CA-23 — Orçamento existente`
**Dado** budget do mês **Quando** consulta **Então** retorna todos os campos aprovados.

### `CA-24 — Orçamento ausente`
**Dado** mês sem budget **Quando** consulta **Então** retorna 200 e `budget:null`.

### `CA-25 — Orçamento excedido`
**Dado** restante comprometido negativo **Quando** projeta **Então** `exceeded=true`.

### `CA-26 — Orçamento não excedido`
**Dado** restante comprometido não negativo **Quando** projeta **Então** `exceeded=false`.

### `CA-27 — Projetor único`
**Dado** os mesmos fatos **Quando** consulta budget e dashboard **Então** projeções da SPEC-010 coincidem.

### `CA-28 — Lançamento vencido`
**Dado** PENDING anterior a hoje **Quando** lista **Então** inclui com `overdue=true`.

### `CA-29 — Vencimento hoje`
**Dado** PENDING para hoje **Quando** lista **Então** inclui sem atraso.

### `CA-30 — Sétimo dia`
**Dado** PENDING em hoje mais sete dias **Quando** lista **Então** inclui.

### `CA-31 — Após sete dias`
**Dado** PENDING em hoje mais oito dias **Quando** lista **Então** exclui.

### `CA-32 — Pago excluído`
**Dado** FinancialTransaction PAID **Quando** monta próximos **Então** exclui.

### `CA-33 — Naturezas de lançamento`
**Dado** INCOME e EXPENSE elegíveis **Quando** lista **Então** preserva seus tipos.

### `CA-34 — Ordenação de lançamentos`
**Dado** itens mistos **Quando** ordena **Então** usa atraso, vencimento e id.

### `CA-35 — Limite de lançamentos`
**Dado** mais de dez elegíveis **Quando** responde **Então** retorna os dez primeiros.

### `CA-36 — Sem notes`
**Dado** lançamento com notes **Quando** responde **Então** notes não aparece.

### `CA-37 — Fatura aberta`
**Dado** fatura OPEN **Quando** lista **Então** inclui sem atraso projetado.

### `CA-38 — Fatura fechada não paga`
**Dado** CLOSED **Quando** lista **Então** inclui.

### `CA-39 — Fatura fechada vencida`
**Dado** CLOSED anterior a hoje **Quando** lista **Então** `projectedOverdue=true`.

### `CA-40 — Fatura paga excluída`
**Dado** PAID **Quando** lista **Então** exclui.

### `CA-41 — Ordenação de faturas`
**Dado** várias faturas **Quando** lista **Então** ordena por vencimento e invoiceId.

### `CA-42 — Limite de faturas`
**Dado** mais de cinco elegíveis **Quando** responde **Então** retorna cinco.

### `CA-43 — Fatura sem dupla contagem`
**Dado** fatura e pagamento **Quando** agrega **Então** nenhum valor de pagamento vira despesa nova.

### `CA-44 — Dívida vencida`
**Dado** parcela PENDING anterior a hoje **Quando** lista **Então** inclui como OVERDUE.

### `CA-45 — Dívida próxima`
**Dado** parcela PENDING em até 30 dias **Quando** lista **Então** inclui.

### `CA-46 — Trigésimo dia`
**Dado** vencimento em hoje mais 30 **Quando** lista **Então** inclui.

### `CA-47 — Fora da janela de dívida`
**Dado** vencimento em hoje mais 31 **Quando** lista **Então** exclui.

### `CA-48 — Parcela paga excluída`
**Dado** parcela PAID **Quando** lista **Então** exclui.

### `CA-49 — Total da parcela`
**Dado** componentes monetários **Quando** projeta **Então** total soma os três exatamente.

### `CA-50 — Principal só obrigação`
**Dado** parcela pendente **Quando** exibe total **Então** principal aparece na obrigação, não em despesa realizada.

### `CA-51 — Ordenação de dívidas`
**Dado** parcelas mistas **Quando** ordena **Então** usa atraso, vencimento, número e id.

### `CA-52 — Limite de dívidas`
**Dado** mais de cinco elegíveis **Quando** responde **Então** retorna cinco.

### `CA-53 — Transação categorizada`
**Dado** despesa paga com categoria **Quando** distribui **Então** soma actual nessa categoria.

### `CA-54 — Cartão categorizado`
**Dado** parcela com categoria da compra **Quando** distribui **Então** soma amount nessa categoria.

### `CA-55 — Custo de dívida separado`
**Dado** juros/tarifas pagos **Quando** distribui **Então** retorna-os no campo separado.

### `CA-56 — Sem pseudo-categoria`
**Dado** custo de dívida **Quando** responde **Então** não cria categoria artificial.

### `CA-57 — Todas as categorias positivas`
**Dado** mais de cinco categorias com gasto **Quando** responde **Então** retorna todas.

### `CA-58 — Ordenação de categorias`
**Dado** categorias com valores/nomes **Quando** ordena **Então** usa amount desc, nome e id.

### `CA-59 — Dívida sem custo`
**Dado** nenhum custo pago **Quando** responde **Então** campo separado é `"0.00"`.

### `CA-60 — Mês obrigatório`
**Dado** query sem month **Quando** consulta **Então** recebe 400.

### `CA-61 — Mês válido`
**Dado** `month=2026-08` **Quando** consulta autenticado **Então** recebe esse mês na resposta.

### `CA-62 — Mês inválido`
**Dado** mês inexistente ou forma não canônica **Quando** consulta **Então** recebe 400.

### `CA-63 — Query extra`
**Dado** parâmetro além de month **Quando** consulta **Então** recebe 400.

### `CA-64 — Month repetido`
**Dado** dois parâmetros month **Quando** consulta **Então** recebe 400.

### `CA-65 — Autenticação`
**Dado** ausência de sessão **Quando** consulta **Então** recebe 401 sem dados.

### `CA-66 — Ownership`
**Dado** fatos de dois usuários **Quando** um consulta **Então** recebe exclusivamente os próprios.

### `CA-67 — Sem userId público`
**Dado** resposta composta **Quando** serializa **Então** não contém `userId`.

### `CA-68 — Snapshot`
**Dado** múltiplas fontes **Quando** lê **Então** todas pertencem ao mesmo `RepeatableRead`.

### `CA-69 — Atualização concorrente`
**Dado** fato alterado durante GET **Quando** conclui **Então** resposta é integralmente anterior ou posterior pelo snapshot.

### `CA-70 — Falha unitária`
**Dado** consulta essencial falha **Quando** compõe **Então** retorna 500 sanitizado sem parcialidade.

### `CA-71 — Contrato exato`
**Dado** sucesso **Quando** valida shared **Então** shape coincide com os nove tipos aprovados.

### `CA-72 — Zeros sem fatos`
**Dado** mês vazio **Quando** consulta **Então** retorna valores `"0.00"`, arrays vazios e contadores zero.

### `CA-73 — Contadores antes do limite`
**Dado** mais itens que o limite **Quando** responde **Então** contador representa todo conjunto-base e array permanece limitado.

### `CA-74 — Loading web`
**Dado** requisição pendente **Quando** abre dashboard **Então** mostra estado loading sem valores inventados.

### `CA-75 — API indisponível web`
**Dado** erro da API **Quando** renderiza **Então** mostra erro unitário e tentativa novamente.

### `CA-76 — Orçamento ausente web`
**Dado** `budget:null` **Quando** renderiza **Então** mostra mensagem do mês e link `/budgets`.

### `CA-77 — Ações rápidas`
**Dado** dashboard carregado **Quando** usa ações **Então** navega aos cinco domínios sem abrir CRUD local.

### `CA-78 — Responsividade`
**Dado** viewport móvel **Quando** renderiza **Então** cards empilham e ações principais não rolam horizontalmente.

### `CA-79 — Mês civil local`
**Dado** fuso que difere de UTC **Quando** inicia **Então** mês atual usa componentes civis locais.

### `CA-80 — Navegação temporal`
**Dado** qualquer mês **Quando** avança, retrocede ou volta ao atual **Então** preserva forma canônica e virada de ano.

### `CA-81 — Desempenho fixo`
**Dado** volumes diferentes **Quando** consulta **Então** número de queries é fixo e não há N+1.

### `CA-82 — Meta de queries`
**Dado** implementação normal **Quando** mede SQL **Então** usa até 12, ou documenta justificativa e prova ausência de N+1.

### `CA-83 — Precisão ponta a ponta`
**Dado** valores com centavos **Quando** calcula e serializa **Então** usa decimal exato e strings de duas casas.

### `CA-84 — Cenário consolidado`
**Dado** os fatos da seção 9.9 **Quando** consulta agosto **Então** retorna `1950.00`, `3000.00`, `705.00`, `1025.00`, `1245.00` e `1975.00` nos campos correspondentes.

### `CA-85 — Variação consolidada null`
**Dado** a conta C indisponível da seção 9.9 **Quando** consulta **Então** caixa é `null`, counts 2/1 e nunca total `1500.00`.

### `CA-86 — Rota e pós-login`
**Dado** login bem-sucedido **Quando** conclui autenticação **Então** navega à rota protegida `/dashboard`.

### `CA-87 — Observabilidade segura`
**Dado** consulta **Quando** registra telemetria **Então** inclui apenas operação, duração, status, request id e query count permitido.

### `CA-88 — Zero persistência`
**Dado** consulta repetida **Quando** inspeciona banco **Então** nenhuma tabela, snapshot, cache ou fato de dashboard foi criado.

## 23. Testes obrigatórios

| Nível | Cenários mínimos | Critérios relacionados | Evidência esperada |
|---|---|---|---|
| Unitário | month/mês civil; Decimal; caixa null/string; nets; overdue/janelas; ordenações; limites | CA-01–22, CA-28–35, CA-44–59, CA-79–83 | Suite determinística aprovada. |
| Serviço | snapshot; query count fixo; owner em todas; budget/cash null; resposta composta; falha integral | CA-23–27, CA-60–73, CA-81–82 | Testes com mocks/spy e integração. |
| PostgreSQL | `RepeatableRead`; agregações; concorrência; Decimal; `EXPLAIN` antes de qualquer proposta de índice | CA-02, CA-68–70, CA-81–83 | Teste real e planos registrados. |
| Contrato/shared | Shape exato, nulabilidade, enums e ausência de Prisma/userId | CA-61, CA-67, CA-71 | Build e testes de contrato. |
| Web | Loading, erros, vazios, null, navegação, ações, terminologia, dinheiro sem conversão float e responsividade | CA-07–10, CA-22, CA-74–80, CA-86 | Testes de componente e viewport. |
| E2E | Login; contas; budget; transactions pending/paid; parcela/fatura; dívida; dashboard; totais; exclusões; logout | CA-65, CA-66, CA-84–86 | Fluxo PostgreSQL completo aprovado. |
| Aceitação manual | Leitura visual mobile/desktop, mensagens e links | CA-09, CA-22, CA-74–80 | Checklist e captura futura. |

Na implementação futura devem rodar lint, typecheck, unitários, integrações aplicáveis, build e E2E conforme risco. O CI desativado não deve ser reativado; evidências locais são obrigatórias.

## 24. Arquivos permitidos

Nesta unidade documental, somente:

- `docs/specs/SPEC-011-DASHBOARD-FINANCEIRO.md`.

Uma implementação futura exigirá unidade própria e escopo de arquivos explicitamente aprovado.

## 25. Arquivos proibidos

- Qualquer outro arquivo nesta unidade, incluindo código, Prisma, migration, API, web, shared, dependências, seed, produto, ADR, outras SPECs, auth e CI.

## 26. Dependências

| Dependência | Motivo | Estado da aprovação | Impacto |
|---|---|---|---|
| SPEC-002 a SPEC-010 | Fontes e segurança preexistentes | Aprovadas | Reuso obrigatório. |
| PostgreSQL/Prisma existentes | Snapshot e decimal futuros | Aprovados no projeto | Nenhuma dependência nova. |
| Biblioteca de gráfico/cache | Não necessária | Proibida nesta versão | UI simples e leitura direta. |

## 27. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Dupla contagem entre compra e fatura | Média | Alto | Reusar SPEC-010 e excluir pagamento. |
| Total parcial de caixa enganoso | Média | Alto | Propagar `null` e explicar na UI. |
| Mistura de owners/snapshots | Baixa | Alto | Filtro em toda query e `RepeatableRead`. |
| N+1/latência | Média | Médio | Queries fixas, agregação, meta 12 e medição. |
| Divergência entre budget/dashboard | Média | Alto | Mesmo projetor compartilhado. |
| Muitos itens de categoria | Baixa no MVP | Médio | Retornar todos; medir antes de nova SPEC. |

## 28. Rollback

Nesta unidade, reverter o commit documental remove somente esta SPEC, sem efeito em dados. Na implementação futura, rollback será revert de API/web/shared, pois não haverá migration nem persistência; validar que rotas anteriores e login permanecem funcionais.

## 29. Dúvidas

Não há dúvidas abertas. Todas as decisões obrigatórias — rota, período, caixa null/vazio, fluxos, orçamento, janelas, cartões, dívidas, categorias, limites, ordenações, snapshot, desempenho, contratos, pós-login, ausência de persistência e erros — estão fechadas nesta SPEC.

## 30. Decisões aprovadas

| Data | Decisão | Responsável pela aprovação | Consequência |
|---|---|---|---|
| 2026-08-10 | Dashboard é projeção sem persistência. | Solicitante | Nenhum novo fato/model/cache. |
| 2026-08-10 | Caixa parcial torna o total `null`; vazio é `"0.00"`. | Solicitante | UX explicita indisponibilidade. |
| 2026-08-10 | Fluxo mensal e budget reutilizam competência da SPEC-010. | Solicitante | Sem semântica econômica paralela. |
| 2026-08-10 | Endpoint único, `month` obrigatório e snapshot `RepeatableRead`. | Solicitante | Resposta determinística e consistente. |
| 2026-08-10 | Rota `/dashboard` é destino pós-login. | Solicitante | Home financeira protegida. |
| 2026-08-10 | Sem tendências automáticas no MVP. | Solicitante | Navegação manual entre meses. |

## 31. Definition of Done específica

Além da [Definition of Done do projeto](../quality/DEFINITION-OF-DONE.md), esta SPEC exige:

- [ ] Implementação futura reutiliza projetores e não duplica regras financeiras.
- [ ] Contratos shared exatos não expõem Prisma nem `userId`.
- [ ] Snapshot, query count fixo e ausência de N+1 têm evidência.
- [ ] Todos os 88 critérios de aceite foram atendidos.
- [ ] Lint, typecheck, testes aplicáveis, build e evidências foram registrados.
- [ ] Nenhuma persistência, dependência ou alteração de CI foi criada.

## 32. Histórico de alterações da SPEC

| Data | Alteração | Motivo | Autor | Aprovador, quando aplicável |
|---|---|---|---|---|
| 2026-08-10 | Criação aprovada da SPEC-011. | Definir dashboard financeiro MVP. | Equipe PlannerFin | Solicitante da tarefa |
