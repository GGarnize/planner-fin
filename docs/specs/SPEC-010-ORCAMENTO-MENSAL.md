# SPEC de funcionalidade — `SPEC-010 — Orçamento mensal`

> Esta SPEC define exclusivamente comportamento futuro. Não implementa código, banco de dados, API ou interface.

## 1. Identificação

| Campo | Valor |
|---|---|
| ID | `SPEC-010` |
| Título | Orçamento mensal |
| Responsável | Equipe Planner Fin |
| Data de criação | `2026-08-08` |
| Última atualização | `2026-08-08` |
| Tarefa relacionada | `PROMPT-SPEC-010-ORCAMENTO-MENSAL.md` |
| Documentos relacionados | [`SPEC-002`](SPEC-002-AUTENTICACAO-E-ISOLAMENTO-POR-USUARIO.md) a [`SPEC-009`](SPEC-009-DIVIDAS-E-FINANCIAMENTOS.md); [`ADR-001`](../adr/ADR-001-ARQUITETURA-GERAL.md) a [`ADR-006`](../adr/ADR-006-ESTRATEGIA-DE-TESTES.md); [visão](../product/VISION.md), [escopo](../product/SCOPE.md), [princípios](../product/PRODUCT-PRINCIPLES.md), [modelo TO-BE](../product/TO-BE-PRODUCT-MODEL.md), [Definition of Done](../quality/DEFINITION-OF-DONE.md), [estratégia de testes](../quality/TEST-STRATEGY.md), [processo de SPECs](README.md) e [fluxo Git](../process/GIT-WORKFLOW.md) |

## 2. Status

`Aprovada`

**Aprovada por:** solicitante da tarefa, em `2026-08-08`.

A aprovação autoriza uma implementação futura aderente a esta SPEC; esta unidade é somente documental.

## 3. Contexto

Os domínios de autenticação, contas, categorias, lançamentos, transferências, recorrências, cartões/faturas e dívidas possuem contratos aprovados. O orçamento mensal deve consumir esses fatos sem mudar suas fontes de verdade. Ele precede o dashboard para que visualizações futuras reutilizem uma projeção única, em vez de redefinir competência, realização ou dupla contagem.

O orçamento é meta de planejamento. Criá-lo ou editá-lo não movimenta dinheiro, não altera fatos financeiros e não modifica saldos.

## 4. Problema

O usuário ainda não consegue definir limites mensais nem comparar planejamento com despesas econômicas. Sem contrato explícito, vencimento e pagamento podem ser confundidos, compra e fatura podem ser contadas duas vezes, principal de dívida pode virar despesa e totais por categoria podem divergir do total geral.

## 5. Objetivo

Definir um orçamento por usuário e mês civil, com limite total positivo e limites opcionais por categoria, projeções exatas de realizado, comprometido, restante e percentuais, cópia explícita, edição segura e consulta de meses passados, atual e futuros, preservando ownership, precisão e ausência de dupla contagem.

## 6. Fora do escopo

- Implementação de código, Prisma, migration, API, web, dependências, seed ou CI nesta unidade.
- Dashboard, gráficos sofisticados, alertas, notificações e aconselhamento financeiro.
- Recorrência ou cópia automática de orçamento, rateio automático e sugestão de limites.
- Status `OPEN`/`CLOSED`, fechamento automático, versionamento histórico de limites e remoção integral do orçamento.
- Previsão de juros/tarifas futuros de dívida e criação de categoria artificial para custos de dívida.
- Alteração das fontes financeiras, de autenticação, CSRF, CORS ou workflow de CI.
- API de listagem por intervalo e paginação de orçamentos no MVP.

## 7. Termos

| Termo | Definição adotada nesta SPEC |
|---|---|
| Mês orçamentário | Mês civil estrito `YYYY-MM`, sem horário ou fuso. |
| Limite | Valor planejado; não é saldo nem movimentação. |
| Realizado | Despesa economicamente reconhecida segundo a fonte original. |
| Comprometido | Despesas previstas ou realizadas já atribuídas ao mês. |
| Restante | Limite menos a projeção indicada; pode ser negativo. |
| Sem limite por categoria | Gasto no total que não possui linha específica de limite. |
| Custo de dívida não categorizado | Juros e tarifas efetivamente pagos, sem `categoryId`. |
| Categoria vinculada | Categoria com um `MonthlyBudgetCategory` explícito. |

## 8. Comportamento atual

Não há orçamento mensal confirmado no repositório. A `SPEC-005` define `dueDate` como data planejada e `paidAt` como data exclusiva de caixa, sem campo de competência; a `SPEC-008` reconhece a despesa de cartão por `CardInstallment.referenceMonth`; a `SPEC-009` reconhece juros e tarifas diretamente de `DebtPayment` em `paymentDate` e exclui principal. Não há contradição entre essas regras para esta projeção.

## 9. Comportamento desejado

### 9.1 Princípio e mês

Existe no máximo um `MonthlyBudget` por `(userId, month)`. `month` aceita somente `^[0-9]{4}-(0[1-9]|1[0-2])$`, representa mês gregoriano e não é timestamp. Persistência futura usa texto canônico `char(7)` (ou tipo conceitualmente equivalente que preserve exatamente o contrato), sem conversão de fuso.

Orçamento pode ser criado e editado no passado, presente ou futuro. Não fecha automaticamente e não tem status. `updatedAt` oferece auditoria técnica, sem snapshot de cada versão.

### 9.2 Limites e ciclo de vida

`totalLimit` é obrigatório, `Decimal(19,2)` e estritamente positivo. Limites de categoria são opcionais e positivos. Sua soma pode ser menor, igual ou maior que o total: categorias são áreas monitoradas e o limite total é restrição global independente.

Não há remoção integral, `DELETE`, archive ou cancelamento do orçamento no MVP. O usuário pode editar total/notas e remover todos os limites por categoria com `categories: []`, mas deve conservar um `totalLimit` positivo. Essa retenção evita apagar uma configuração analítica e não cria um status sem significado para mês histórico.

### 9.3 Fontes e competência

O total mede despesa econômica, não fluxo de caixa:

1. `FinancialTransaction EXPENSE`: pertence ao mês de `dueDate`, pois a `SPEC-005` não define outra competência. `PENDING` contribui com `plannedAmount` apenas para comprometido. `PAID` contribui com `plannedAmount` para comprometido e `actualAmount` para realizado. O `paidAt` não muda o mês orçamentário; pagar em setembro uma despesa com `dueDate` em agosto realiza agosto. Reabrir remove o realizado, preservando o comprometido.
2. `CardInstallment`: pertence ao seu `referenceMonth`, contribui uma vez com `amount` para realizado e comprometido, independentemente do estado ou pagamento da fatura. Sua categoria é `CardPurchase.categoryId`, fonte aprovada pela `SPEC-008`.
3. `DebtPayment`: no mês civil de `paymentDate`, `interestAmount + feeAmount` contribui uma vez para realizado e comprometido. Não se prevê custo futuro. Principal é excluído. Como não há `categoryId`, o custo entra somente no total e nos campos próprios de custo de dívida não categorizado.

São excluídos `FinancialTransaction INCOME`, `FinancialTransfer`, `CardInvoicePayment`, `DebtFunding`, principal de `DebtPayment`, `openingBalance`, `realizedBalance` e qualquer criação/edição do orçamento. Nenhuma dessas fontes é transformada em fato artificial.

### 9.4 Fórmulas totais

```text
realizedExpense(month) =
  Σ FinancialTransaction.actualAmount
    onde type=EXPENSE, status=PAID e mês(dueDate)=month
+ Σ CardInstallment.amount onde referenceMonth=month
+ Σ (DebtPayment.interestAmount + DebtPayment.feeAmount)
    onde mês(paymentDate)=month

committedExpense(month) =
  Σ (status=PENDING ? plannedAmount : plannedAmount)
    de FinancialTransaction EXPENSE onde mês(dueDate)=month
+ Σ CardInstallment.amount onde referenceMonth=month
+ Σ (DebtPayment.interestAmount + DebtPayment.feeAmount)
    onde mês(paymentDate)=month

remainingAgainstRealized = totalLimit - realizedExpense
remainingAgainstCommitted = totalLimit - committedExpense
realizedPercent = realizedExpense / totalLimit * 100
committedPercent = committedExpense / totalLimit * 100
```

O uso de `plannedAmount` no comprometido, inclusive para `PAID`, preserva a comparação entre planejamento e realização da `SPEC-005`; `actualAmount` pode divergir. Não há dupla contagem entre os dois campos: eles são projeções paralelas, não parcelas somadas entre si.

### 9.5 Categorias e valores sem limite

Cada limite agrega apenas `FinancialTransaction EXPENSE` com o mesmo `categoryId` e `CardInstallment` cuja compra possui o mesmo `categoryId`, usando as mesmas regras totalizadoras. Custos de dívida nunca entram em categoria.

Fatos categorizados sem limite continuam no total e são somados em `unbudgetedRealizedExpense` e `unbudgetedCommittedExpense`. Custos de dívida são expostos separadamente como `uncategorizedDebtCostRealized` e `uncategorizedDebtCostCommitted`; ambos têm o mesmo valor no MVP, pois só custos pagos são reconhecidos. Para clareza, os campos `unbudgeted*` incluem somente transações/parcelas categorizadas sem limite e não incluem custos de dívida. A soma desses campos explica componentes fora das linhas, sem gerar linha automática.

Categoria própria, ativa e `EXPENSE` pode ser incluída. Categoria arquivada não pode ser adicionada. Se uma vinculada for arquivada depois, permanece visível, agrega fatos e pode ser preservada sem alteração ou removida em lista completa. Seu `limitAmount` não pode ser alterado enquanto arquivada; para mudar o valor, é necessário reativá-la no domínio de categorias. Enviar a mesma categoria arquivada com o mesmo valor é preservação válida. Nada a reativa automaticamente.

### 9.6 Edição e cópia

`PATCH` aceita `totalLimit` e `notes`. Quando `categories` está ausente, preserva o conjunto; quando presente, representa a lista completa, validada e substituída atomicamente. Corpo vazio ou sem campo reconhecido falha. Falha de qualquer item impede toda atualização.

A cópia explícita recebe somente `targetMonth`, copia `totalLimit`, `notes` e todos os limites vinculados, mas nenhum fato ou projeção. Destino sem orçamento cria novo recurso; destino ocupado retorna `409 BUDGET_MONTH_CONFLICT`, sem overwrite. Categorias arquivadas no momento da cópia tornam a operação incompatível e geram `422`, sem cópia parcial; o usuário deve removê-las da origem ou reativá-las. Não existe recorrência automática.

### 9.7 Precisão

Dinheiro persiste em `Decimal(19,2)` e trafega como string com exatamente duas casas. DTO de dinheiro aceita a mesma gramática positiva da `SPEC-005`, sem número JSON, sinal, expoente, separador ou arredondamento silencioso. Cálculos autoritativos usam decimal exato, nunca `Number`, `float` ou `double`.

Restantes são strings monetárias com duas casas e podem ser negativos. Gastos podem ser `"0.00"`. Percentuais são strings decimais com duas casas, podem superar `100.00` e são calculados em precisão decimal suficiente; somente o resultado percentual é arredondado `HALF_UP` para duas casas. O denominador nunca é zero porque cada limite é positivo. Valores monetários não recebem arredondamento além dos centavos persistidos.

### 9.8 Projeção eficiente e consistência

A implementação futura buscará orçamento/categorias e fará agregações em conjunto por owner, mês e categoria: uma agregação de transações, uma de parcelas de cartão e uma de custos pagos de dívida, ou plano equivalente comprovadamente sem N+1. A projeção é montada com decimal em memória. Não se executa consulta por linha e não se materializam gasto, restante ou percentual.

Uma consulta deve observar snapshot consistente conforme a capacidade transacional do PostgreSQL: todos os agregados representam o mesmo ponto lógico. Se pagamento/edição de fato concorrer, a resposta reflete integralmente o estado anterior ou posterior, nunca combinação parcial. O orçamento referencia fatos; não os copia nem os duplica.

## 10. Personas ou atores

| Ator | Necessidade | Ações autorizadas |
|---|---|---|
| Usuário autenticado | Planejar e acompanhar suas despesas | Criar, consultar, editar e copiar somente orçamento próprio |
| Visitante | Autenticar-se | Nenhum acesso a orçamento |
| Sistema | Derivar projeções | Ler fatos próprios e agregar sem mutá-los |

## 11. Fluxos

### 11.1 Fluxo principal

1. Usuário abre `/budgets`; a web solicita o mês atual.
2. Sem orçamento, a API responde `404` e a web oferece criação, sem confundir ausência com indisponibilidade.
3. Usuário informa total, notas opcionais e zero ou mais categorias ativas de despesa.
4. API deriva owner, valida e cria atomicamente.
5. Consulta agrega fatos e apresenta totais, categorias, custos de dívida e gastos sem limite.
6. Usuário navega entre meses sem listagem por intervalo e pode editar ou copiar explicitamente.

### 11.2 Fluxos alternativos e exceções

- Mês/decimal/DTO inválido → `400 VALIDATION_ERROR`, sem alteração.
- Recurso principal ou categoria ausente/alheia → `404`, indistinguível.
- Categoria própria incompatível ou arquivada em inclusão/alteração → `422`.
- Mês ou destino já ocupado → `409 BUDGET_MONTH_CONFLICT`.
- Corrida de `PATCH` → última transação confirmada vence; cada substituição é inteira, sem merge silencioso.
- API indisponível → web mostra erro recuperável, nunca “mês sem orçamento”.
- Sessão inválida → `401` e redirecionamento sem conteúdo privado.

## 12. Regras de negócio

| ID | Regra | Origem/decisão | Exemplo |
|---|---|---|---|
| `RN-01` | Um orçamento por owner e mês civil canônico. | Tarefa | `2026-08` é único. |
| `RN-02` | Total e limites de categoria são positivos e exatos. | Tarefa/padrão | `"5000.00"`. |
| `RN-03` | Soma das categorias independe do total. | Tarefa | `6000.00` em linhas para total `5000.00`. |
| `RN-04` | Orçamento não movimenta nem altera fatos. | Princípio central | PATCH não cria transação. |
| `RN-05` | Transação usa o mês de `dueDate`. | SPEC-005/decisão | Pago tardio fica no mês planejado. |
| `RN-06` | Comprometido de transação usa `plannedAmount`. | SPEC-005/decisão | Pago preserva plano. |
| `RN-07` | Realizado de transação paga usa `actualAmount`. | SPEC-005 | Pendente realiza zero. |
| `RN-08` | Parcela de cartão usa `referenceMonth` e entra uma vez. | SPEC-008 | Pagamento não duplica. |
| `RN-09` | Apenas juros/tarifas pagos entram pelo `paymentDate`. | SPEC-009 | Principal excluído. |
| `RN-10` | Custos de dívida são gerais e não categorizados. | Decisão MVP | Sem categoria artificial. |
| `RN-11` | Fontes sem limite continuam no total. | Tarefa | Categoria não vinculada é explicitada. |
| `RN-12` | Categoria arquivada vinculada é histórica e restrita. | Decisão MVP | Preservar/remover, não alterar. |
| `RN-13` | Lista de categorias no PATCH substitui atomicamente. | Tarefa | `[]` remove todas as linhas. |
| `RN-14` | Não há remoção integral ou status no MVP. | Decisão de produto | Sem rota `DELETE`. |
| `RN-15` | Cópia é explícita e nunca sobrescreve. | Tarefa | Destino ocupado dá `409`. |
| `RN-16` | Projeções são derivadas e sem N+1. | Qualidade | Sem `currentSpent`. |
| `RN-17` | Percentual usa decimal e `HALF_UP` só na apresentação. | Tarefa | `33.335` vira `33.34`. |
| `RN-18` | Owner vem exclusivamente do token. | SPEC-002 | Sem `userId` público. |

## 13. Modelo de dados

### 13.1 Entidades futuras

| Entidade | Campo | Tipo conceitual | Obrigatório | Regra |
|---|---|---|---|---|
| `MonthlyBudget` | `id` | UUID | Sim | PK gerada pelo servidor |
| | `userId` | UUID interno | Sim | FK owner, nunca público |
| | `month` | mês civil/texto canônico | Sim | `YYYY-MM`; unique com owner |
| | `totalLimit` | `Decimal(19,2)` | Sim | Estritamente positivo |
| | `notes` | texto até 2000 | Não | trim; vazio normaliza `null` |
| | `createdAt`, `updatedAt` | instante | Sim | auditoria técnica |
| `MonthlyBudgetCategory` | `id` | UUID | Sim | PK |
| | `budgetId` | UUID | Sim | FK para orçamento |
| | `categoryId` | UUID | Sim | categoria própria `EXPENSE` |
| | `limitAmount` | `Decimal(19,2)` | Sim | positivo |
| | `createdAt`, `updatedAt` | instante | Sim | auditoria técnica |

### 13.2 Migration, constraints e índices futuros

Uma única migration nova, aditiva e sem seed criará as tabelas. FKs de `user`, `category` e `budget` usam `ON DELETE RESTRICT`; não há exclusão física nem cascade. Constraints incluem `unique(userId, month)`, `unique(budgetId, categoryId)`, formato de mês e limites positivos. Índices: `(userId, month)` unique para consulta; `(budgetId, categoryId)` unique; `categoryId`; índices de agregação por owner/data já previstos nas SPECs de origem devem ser avaliados por `EXPLAIN`, sem criar índice redundante por suposição.

Não materializar `realizedExpense`, `committedExpense`, restantes, percentuais, `currentSpent`, nomes de categoria ou snapshots de fatos.

## 14. Contratos de API

### 14.1 Tipos públicos

```ts
type BudgetCategoryInput = { categoryId: string; limitAmount: string };

type BudgetTotals = {
  realizedExpense: string;
  committedExpense: string;
  remainingAgainstRealized: string;
  remainingAgainstCommitted: string;
  realizedPercent: string;
  committedPercent: string;
  unbudgetedRealizedExpense: string;
  unbudgetedCommittedExpense: string;
  uncategorizedDebtCostRealized: string;
  uncategorizedDebtCostCommitted: string;
};

type PublicMonthlyBudgetCategory = {
  categoryId: string;
  categoryName: string;
  categoryArchived: boolean;
  limitAmount: string;
  realizedExpense: string;
  committedExpense: string;
  remainingAgainstRealized: string;
  remainingAgainstCommitted: string;
  realizedPercent: string;
  committedPercent: string;
};

type PublicMonthlyBudget = {
  id: string;
  month: string;
  totalLimit: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  totals: BudgetTotals;
  categories: PublicMonthlyBudgetCategory[];
};
```

Nunca expor `userId`. Categorias são ordenadas por `categoryName` ascendente e `categoryId` ascendente como desempate.

### 14.2 Criar — `POST /api/budgets`

- Entrada: `{ month, totalLimit, notes?, categories: BudgetCategoryInput[] }`; `categories` é obrigatória e pode ser `[]`.
- Sucesso: `201` com `PublicMonthlyBudget`.
- Erros: `400` forma/duplicidade no DTO; `401`; `404` categoria ausente/alheia; `409 BUDGET_MONTH_CONFLICT`; `422` categoria própria arquivada/incompatível; `500`.
- Autorização: owner do token e categorias próprias.
- Idempotência: não idempotente; unicidade converte criação repetida/concorrente em conflito.

### 14.3 Consultar por mês — `GET /api/budgets?month=YYYY-MM`

- Entrada: exatamente um `month`; `from`, `to`, cursor e parâmetros extras são rejeitados.
- Sucesso: `200` com `PublicMonthlyBudget`.
- Ausência: `404 NOT_FOUND`; mantém recurso e projeção coesos. A web trata esse código como mês sem orçamento.
- Erros: `400`, `401`, `404`, `500`.
- Autorização: sempre filtrar por owner.
- Idempotência: leitura sem efeito.

### 14.4 Consultar por id — `GET /api/budgets/:id`

- Entrada: UUID canônico.
- Sucesso: `200` com a mesma projeção pública.
- Erros: `400`, `401`, `404` ausente/alheio, `500`.
- Autorização: owner do token.
- Idempotência: leitura sem efeito.

### 14.5 Editar — `PATCH /api/budgets/:id`

- Entrada: ao menos um de `{ totalLimit?, notes?, categories? }`; `month`, ids internos, timestamps e campos extras são proibidos. `categories`, se presente, é lista completa.
- Sucesso: `200` com projeção atualizada; substituição de linhas e atualização do orçamento são atômicas.
- Erros: `400`, `401`, `404`, `422` e `500`; conflito de corrida relacional pode resultar `409` sem parcialidade.
- Autorização: orçamento e categorias próprios.
- Idempotência: mesmo body canônico no mesmo estado é equivalente; implementação evita escrita desnecessária quando nada muda.

### 14.6 Copiar — `POST /api/budgets/:id/copy`

- Entrada: exatamente `{ "targetMonth": "YYYY-MM" }`.
- Sucesso: `201` com novo `PublicMonthlyBudget`, incluindo notas e limites, nunca fatos.
- Erros: `400`, `401`, `404`, `409 BUDGET_MONTH_CONFLICT`, `422` por categoria arquivada e `500`.
- Autorização: origem e categorias próprias.
- Idempotência: repetição após sucesso retorna `409`; target é criado no máximo uma vez.

Não há `DELETE`, endpoints CRUD filhos, listagem por intervalo ou paginação. Navegação mensal calcula anterior/próximo no cliente e consulta um mês por vez. Todas as rotas exigem auth, DTO explícito, whitelist e `forbidNonWhitelisted`; erros não expõem owner, SQL ou stack.

## 15. Interface

A rota protegida será `/budgets`, consistente com o recurso plural da API. Exibe seletor do mês, anterior, próximo e “Mês atual”. Um `404` válido apresenta “Nenhum orçamento para este mês” e ação de criar; falha de rede/`500` apresenta indisponibilidade e tentar novamente.

A tela permite criar, editar total/notas, adicionar/remover limites de categorias, copiar para outro mês e visualizar limite, realizado, comprometido, ambos os restantes e percentuais. Destaca total ou categoria acima do limite, gastos sem limite específico e custos de dívida não categorizados. Categoria vinculada arquivada recebe indicador e oferece somente preservar ou remover.

Uma barra de progresso simples pode representar cada percentual, sem truncar o valor textual acima de 100%. Nunca se usa “saldo” para orçamento. Loading não mostra valores antigos como atuais; sucesso só aparece após confirmação. Layout é responsivo, sem rolagem horizontal obrigatória para ação primária, com rótulos, foco visível, teclado, contraste, regiões de erro anunciáveis e alvos de toque adequados.

## 16. Validações

| Campo ou ação | Validação | Mensagem/resultado esperado |
|---|---|---|
| `month`/`targetMonth` | Formato estrito e mês 01..12 | `400 VALIDATION_ERROR` |
| `totalLimit`/`limitAmount` | String decimal positiva, precisão 19, escala até 2 na entrada e 2 na saída | `400`; sem coerção |
| `notes` | texto simples, trim, até 2000; vazio vira `null` | `400` por excesso |
| `categories` | array, UUIDs únicos, lista integral | `400` por duplicidade/forma |
| categoria | própria, ativa para inclusão/alteração e `EXPENSE` | `404` alheia; `422` incompatível/arquivada |
| PATCH | ao menos um campo permitido | `400` |
| cópia | destino diferente da origem e livre | `409` se ocupado; `400` se igual |

## 17. Permissões

| Ação | Ator autorizado | Condição | Comportamento quando negado |
|---|---|---|---|
| Criar | Usuário autenticado | categorias próprias elegíveis | `401`, `404` ou `422` |
| Consultar | Usuário autenticado | orçamento próprio | `404` indistinguível |
| Editar | Usuário autenticado | orçamento/categorias próprios | `404` indistinguível |
| Copiar | Usuário autenticado | origem própria e destino livre | `404`/`409`/`422` |
| Acessar web | Usuário autenticado | sessão válida | redirecionar ao login |

## 18. Segurança e privacidade

- Dados envolvidos: valores planejados, projeções financeiras e notas pessoais.
- Ameaças: IDOR, mass assignment, enumeração de owner, injeção, vazamento em log/cache e corrida inconsistente.
- Proteções: autenticação obrigatória, `userId` do token, filtro por owner no backend, DTO explícito, whitelist, `forbidNonWhitelisted`, validação relacional transacional, queries parametrizadas e respostas privadas sem cache compartilhado.
- Recurso alheio e ausente são `404` indistinguíveis; categoria alheia é `404`.
- Não registrar valores, notas, tokens ou payload financeiro real. Logs podem conter request/correlation id, operação, resultado e código de erro sanitizado.
- Auth, CSRF e CORS permanecem intactos; autorização nunca depende apenas da web.

## 19. Erros e estados vazios

| Situação | Estado apresentado | Recuperação esperada |
|---|---|---|
| Mês sem orçamento (`404`) | vazio explícito | criar ou navegar |
| Orçamento sem categorias | total e bloco de linhas vazio | adicionar limite |
| Sem fatos | valores `0.00` e percentuais `0.00` | manter/editar plano |
| Acima do limite | restante negativo e destaque | revisar plano, sem aconselhamento |
| API indisponível | erro, não vazio | tentar novamente |
| Sessão expirada | sem conteúdo privado | login |
| Conflito de cópia | destino já possui orçamento | escolher outro mês |
| Categoria arquivada | indicador e restrição | preservar/remover ou reativar fora da tela |

## 20. Observabilidade

Registrar de forma estruturada operação, rota lógica, status, duração, request id e código de conflito/validação, sem mês associado ao usuário, valores, notas, token ou nomes. Medir latência e taxa de erro das projeções e quantidade de queries para detectar N+1. Alertas seguem infraestrutura existente; não se adiciona serviço nesta SPEC.

## 21. Migração e compatibilidade

- Dados existentes: permanecem intactos; fatos são lidos, não migrados ou copiados.
- Compatibilidade retroativa: aditiva; APIs existentes não mudam.
- Migração necessária: sim, uma migration futura aditiva para os dois modelos, fora desta unidade.
- Implantação gradual: migration antes da futura API; web depois da API. CI continua desativado e inalterado.

## 22. Critérios de aceite

### `CA-01 — Mês canônico`
**Dado** `2026-08` **Quando** valida o mês **Então** aceita sem fuso ou timestamp.

### `CA-02 — Mês inválido`
**Dado** `2026-00`, `2026-13`, `26-08` ou data completa **Quando** valida **Então** rejeita com `400`.

### `CA-03 — Virada de ano`
**Dado** dezembro de 2026 **Quando** navega ao próximo mês **Então** consulta `2027-01`.

### `CA-04 — Unicidade mensal`
**Dado** orçamento próprio em agosto **Quando** cria outro em agosto **Então** recebe `409`.

### `CA-05 — Meses livres`
**Dado** meses passado, atual e futuro **Quando** cria orçamento válido **Então** todos são permitidos.

### `CA-06 — Sem fechamento`
**Dado** orçamento passado **Quando** edita **Então** atualiza sem estado `OPEN/CLOSED`.

### `CA-07 — Total obrigatório`
**Dado** criação sem `totalLimit` **Quando** envia **Então** recebe `400` sem recurso.

### `CA-08 — Total positivo`
**Dado** zero ou valor negativo **Quando** envia **Então** rejeita sem coerção.

### `CA-09 — Categorias vazias`
**Dado** total válido e `categories: []` **Quando** cria **Então** orçamento é criado sem linhas.

### `CA-10 — Soma menor`
**Dado** linhas somando menos que o total **Quando** cria **Então** aceita.

### `CA-11 — Soma igual`
**Dado** linhas somando o total **Quando** cria **Então** aceita.

### `CA-12 — Soma maior`
**Dado** linhas somando mais que o total **Quando** cria **Então** aceita e mantém total independente.

### `CA-13 — Categoria duplicada`
**Dado** mesmo `categoryId` duas vezes **Quando** envia **Então** recebe `400` sem parcialidade.

### `CA-14 — Categoria de receita`
**Dado** categoria própria `INCOME` **Quando** inclui **Então** recebe `422`.

### `CA-15 — Categoria alheia`
**Dado** categoria de outro usuário **Quando** inclui **Então** recebe `404` indistinguível.

### `CA-16 — Categoria arquivada nova`
**Dado** categoria própria arquivada não vinculada **Quando** inclui **Então** recebe `422`.

### `CA-17 — Categoria arquivada histórica`
**Dado** categoria vinculada arquivada depois **Quando** consulta **Então** linha e fatos permanecem com indicador.

### `CA-18 — Preservar arquivada`
**Dado** linha arquivada com mesmo valor **Quando** envia lista completa **Então** preserva a linha.

### `CA-19 — Alterar arquivada`
**Dado** linha arquivada **Quando** muda seu limite **Então** recebe `422` sem atualizar qualquer linha.

### `CA-20 — Remover arquivada`
**Dado** linha arquivada **Quando** omite da lista completa **Então** remove somente o limite, não categoria nem fatos.

### `CA-21 — Transação pendente comprometida`
**Dado** `EXPENSE PENDING` com vencimento em agosto **Quando** projeta agosto **Então** soma `plannedAmount` apenas ao comprometido.

### `CA-22 — Transação paga realizada`
**Dado** `EXPENSE PAID` de agosto **Quando** projeta **Então** soma `actualAmount` ao realizado.

### `CA-23 — Plano de transação paga`
**Dado** `EXPENSE PAID` de agosto **Quando** projeta comprometido **Então** soma `plannedAmount`.

### `CA-24 — Pago em outro mês`
**Dado** vencimento em agosto e `paidAt` em setembro **Quando** consulta ambos **Então** realização fica em agosto e não em setembro.

### `CA-25 — Reabertura`
**Dado** despesa paga de agosto **Quando** reabre **Então** sai do realizado e permanece no comprometido de agosto.

### `CA-26 — Diferença plano-real`
**Dado** previsto `100.00` e realizado `90.00` **Quando** projeta **Então** comprometido é `100.00` e realizado `90.00`.

### `CA-27 — Receita excluída`
**Dado** `FinancialTransaction INCOME` **Quando** projeta **Então** não altera qualquer gasto.

### `CA-28 — Transferência excluída`
**Dado** `FinancialTransfer` no mês **Quando** projeta **Então** não altera o orçamento.

### `CA-29 — Parcela no ciclo`
**Dado** parcela com `referenceMonth=2026-08` **Quando** projeta agosto **Então** soma `amount` uma vez em realizado e comprometido.

### `CA-30 — Categoria da compra`
**Dado** parcela cuja compra tem categoria vinculada **Quando** projeta **Então** soma na linha dessa categoria.

### `CA-31 — Fatura aberta`
**Dado** parcela em fatura `OPEN` **Quando** projeta **Então** a despesa já entra uma vez.

### `CA-32 — Pagamento de fatura excluído`
**Dado** `CardInvoicePayment` **Quando** projeta **Então** não soma nova despesa nem muda o mês da parcela.

### `CA-33 — Sem dupla contagem do cartão`
**Dado** parcela e pagamento integral **Quando** projeta **Então** somente a parcela integra o gasto.

### `CA-34 — Funding excluído`
**Dado** `DebtFunding` **Quando** projeta **Então** não altera orçamento.

### `CA-35 — Principal excluído`
**Dado** pagamento com principal `100.00` **Quando** projeta **Então** principal não entra no gasto.

### `CA-36 — Juros e tarifa realizados`
**Dado** pagamento em agosto com juros `8.00` e tarifa `2.00` **Quando** projeta **Então** soma `10.00` uma vez no total.

### `CA-37 — Mês do custo de dívida`
**Dado** parcela vence em agosto e é paga em setembro **Quando** projeta **Então** juros/tarifas entram somente em setembro.

### `CA-38 — Custo futuro não previsto`
**Dado** parcela de dívida pendente com juros contratados **Quando** projeta comprometido **Então** não soma juros/tarifas futuros.

### `CA-39 — Dívida sem categoria`
**Dado** juros pagos **Quando** projeta categorias **Então** nenhuma linha os recebe e o campo próprio os explica.

### `CA-40 — Categoria sem limite no total`
**Dado** despesa em categoria sem linha **Quando** projeta **Então** integra o total.

### `CA-41 — Sem limite realizado`
**Dado** fato realizado categorizado sem linha **Quando** projeta **Então** soma em `unbudgetedRealizedExpense`.

### `CA-42 — Sem limite comprometido`
**Dado** fato comprometido categorizado sem linha **Quando** projeta **Então** soma em `unbudgetedCommittedExpense`.

### `CA-43 — Separação do custo de dívida`
**Dado** despesa sem linha e juros pagos **Quando** projeta **Então** aparecem em campos distintos e ambos integram total.

### `CA-44 — Restante realizado positivo`
**Dado** limite `500.00` e realizado `200.00` **Quando** calcula **Então** retorna `300.00`.

### `CA-45 — Restante negativo`
**Dado** limite `500.00` e comprometido `550.00` **Quando** calcula **Então** retorna `-50.00`.

### `CA-46 — Percentual zero`
**Dado** nenhum gasto e limite positivo **Quando** calcula **Então** retorna `0.00` sem divisão por zero.

### `CA-47 — Percentual acima de cem`
**Dado** gasto maior que limite **Quando** calcula **Então** percentual supera `100.00` sem truncar.

### `CA-48 — Arredondamento percentual`
**Dado** divisão percentual com terceira casa 5 **Quando** apresenta **Então** arredonda `HALF_UP` para duas casas.

### `CA-49 — Dinheiro em string`
**Dado** número JSON, expoente, vírgula ou três casas **Quando** envia limite **Então** recebe `400`, sem arredondamento.

### `CA-50 — Projeção monetária exata`
**Dado** vários valores em centavos **Quando** agrega **Então** devolve soma decimal exata com duas casas.

### `CA-51 — PATCH simples`
**Dado** orçamento existente **Quando** altera total/notas **Então** preserva mês, categorias e fatos.

### `CA-52 — Categorias ausentes no PATCH`
**Dado** PATCH sem `categories` **Quando** conclui **Então** mantém o conjunto atual.

### `CA-53 — Substituição completa`
**Dado** nova lista válida **Quando** edita **Então** substitui todas as linhas atomicamente.

### `CA-54 — Falha atômica no PATCH`
**Dado** uma linha inválida entre válidas **Quando** edita **Então** nenhuma alteração é confirmada.

### `CA-55 — Remover todas as linhas`
**Dado** orçamento com categorias **Quando** envia `categories: []` **Então** remove limites e preserva total/fatos.

### `CA-56 — Sem remoção integral`
**Dado** orçamento existente **Quando** procura ação ou rota de exclusão **Então** nenhuma está disponível no MVP.

### `CA-57 — Cópia completa do plano`
**Dado** origem válida e destino livre **Quando** copia **Então** replica total, notas e limites.

### `CA-58 — Cópia sem fatos`
**Dado** origem com gastos **Quando** copia **Então** destino projeta somente fatos próprios do target.

### `CA-59 — Destino ocupado`
**Dado** target com orçamento **Quando** copia **Então** recebe `409` sem overwrite.

### `CA-60 — Cópia com arquivada`
**Dado** origem contém categoria agora arquivada **Quando** copia **Então** recebe `422` sem criação parcial.

### `CA-61 — Sem recorrência automática`
**Dado** orçamento de agosto **Quando** chega setembro **Então** nenhum orçamento é criado sem ação explícita.

### `CA-62 — Ausência por mês`
**Dado** mês sem orçamento **Quando** faz GET válido **Então** recebe `404 NOT_FOUND`.

### `CA-63 — Ausência versus indisponibilidade`
**Dado** `404` ou falha de rede **Quando** a web trata **Então** mostra criação no primeiro e retry no segundo.

### `CA-64 — Consulta por id alheio`
**Dado** id de outro usuário **Quando** consulta **Então** recebe `404` indistinguível.

### `CA-65 — Projeção sem userId`
**Dado** resposta de orçamento **Quando** serializa **Então** não expõe `userId`.

### `CA-66 — DTO fechado`
**Dado** `userId`, timestamp ou campo extra no body **Quando** envia **Então** recebe `400` sem mass assignment.

### `CA-67 — Create concorrente`
**Dado** duas criações simultâneas para owner/mês **Quando** concluem **Então** uma cria e a outra recebe conflito.

### `CA-68 — PATCH concorrente`
**Dado** dois PATCH simultâneos válidos **Quando** concluem **Então** cada transação é inteira e o último commit vence, sem mistura de listas.

### `CA-69 — Copy versus create`
**Dado** copy e create concorrentes no target **Quando** concluem **Então** somente um orçamento existe e o perdedor recebe conflito.

### `CA-70 — Copy versus copy`
**Dado** duas cópias ao mesmo target **Quando** concluem **Então** target é criado uma vez.

### `CA-71 — Archive versus edição`
**Dado** archive de categoria concorrente ao PATCH **Quando** concluem **Então** ou edição valida antes do archive ou falha integralmente após ele.

### `CA-72 — Fato concorrente à consulta`
**Dado** pagamento/edição de fato durante GET **Quando** projeta **Então** observa estado completo anterior ou posterior, nunca parcial.

### `CA-73 — Sem N+1`
**Dado** muitas linhas de categoria **Quando** consulta **Então** quantidade de queries agregadas não cresce por linha.

### `CA-74 — Navegação mensal`
**Dado** tela `/budgets` **Quando** usa anterior, próximo ou mês atual **Então** consulta exatamente o mês selecionado.

### `CA-75 — Sem paginação desnecessária`
**Dado** navegação MVP **Quando** consulta **Então** não exige intervalo, cursor ou lista de meses.

### `CA-76 — Destaque total`
**Dado** total excedido **Quando** exibe **Então** mostra restante negativo, percentual e destaque acessível.

### `CA-77 — Destaque de categoria`
**Dado** linha excedida **Quando** exibe **Então** destaca a categoria sem alterar o total.

### `CA-78 — Terminologia`
**Dado** tela de orçamento **Quando** renderiza rótulos **Então** usa Limite, Realizado, Comprometido e Restante, nunca saldo.

### `CA-79 — Responsividade e acessibilidade`
**Dado** viewport móvel/desktop e teclado **Quando** opera fluxo **Então** ações permanecem utilizáveis, rotuladas e com foco visível.

### `CA-80 — E2E sem dupla contagem`
**Dado** transação, parcela, juros/tarifa, transferência e pagamento de fatura em agosto **Quando** consulta **Então** soma somente as três fontes incluídas uma vez.

## 23. Testes obrigatórios

| Nível | Cenários mínimos | Critérios relacionados | Evidência esperada |
|---|---|---|---|
| Unitário | mês, decimal, fórmulas, arredondamento, negativo, duplicidade, fontes incluídas/excluídas, categoria arquivada | CA-01–03, 08–50 | testes determinísticos aprovados |
| Serviço | create/get/PATCH/copy, ownership, archive concorrente, nenhuma mutação financeira e plano sem N+1 | CA-04–20, 51–73 | suíte e contagem/spy de queries |
| Integração PostgreSQL | migration, checks, uniques/FKs, concorrência, replace atômico, Decimal e `EXPLAIN` das agregações | CA-04, 13, 49–50, 67–73 | banco real controlado e planos anexados |
| Contrato | DTOs, projeção, strings, códigos `400/401/404/409/422`, campos proibidos | CA-02, 49, 62–66 | testes HTTP aprovados |
| Web | vazio, navegação, criação, edição, categorias, copy, excedido, indisponibilidade, redirect e acessibilidade | CA-63, 74–79 | testes de componente/integração e auditoria acessível |
| E2E | login; categorias/conta; orçamento de agosto; transação; parcela; dívida paga; exclusões; copy; logout | CA-24, 27–43, 57–61, 80 | fluxo sintético aprovado com totais exatos |
| Aceitação manual | terminologia, clareza entre vazio/erro, responsividade e barras simples | CA-63, 74–79 | checklist e evidência sanitizada |

## 24. Arquivos permitidos

- Em uma implementação futura: novos arquivos estritamente necessários aos modelos, migration, serviço/API, web `/budgets` e testes da `SPEC-010`, detalhados pela tarefa de implementação.
- Nesta unidade documental: somente `docs/specs/SPEC-010-ORCAMENTO-MENSAL.md`.

## 25. Arquivos proibidos

- Nesta unidade: código, Prisma, migrations, dependências, lockfile, outras SPECs, docs de produto, ADRs, auth, CI e seed.
- Em implementação futura: migrations já aplicadas, workflow de CI e domínios financeiros para criar categoria ou fato artificial, salvo nova SPEC aprovada.

## 26. Dependências

| Dependência | Motivo | Estado da aprovação | Impacto |
|---|---|---|---|
| SPEC-002 a SPEC-009 | Ownership e fatos financeiros | Aprovadas | Fontes e segurança estáveis |
| ADR-001 a ADR-006 | Arquitetura, persistência e testes | Aprovadas | Restringem implementação futura |
| Nova dependência de pacote | Não necessária | Não aplicável | Nenhuma adição autorizada |
| CI | Desativado por decisão de custo | Não aplicável | Validação local obrigatória |

## 27. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Dupla contagem de cartão | Média | Total incorreto | Somar parcela, excluir pagamento e testar E2E |
| Confundir caixa e competência | Média | Mês incorreto | `dueDate`, `referenceMonth` e `paymentDate` explícitos |
| Plano e realizado divergentes | Média | Interpretação errada | Campos paralelos e terminologia explicada |
| Custos sem categoria confundirem usuário | Média | Baixa explicabilidade | Campos próprios de dívida e sem limite separados |
| Corridas perderem linhas | Média | Atualização parcial | transação atômica; última escrita documentada |
| N+1 e agregação lenta | Média | Latência | agregações em conjunto, métrica e `EXPLAIN` |
| Edição histórica mudar análise | Baixa | Comparação muda | `updatedAt`, ausência de alteração dos fatos e explicação de camada analítica |
| Sem remoção integral frustrar UX | Baixa | Configuração indesejada retida | remover linhas e editar total; reavaliar em nova SPEC |

## 28. Rollback

Nesta unidade, reverter o commit documental remove somente esta SPEC. Na implementação futura, rollback deve desabilitar web/API e reverter código; como a migration será aditiva e pode conter dados, não derrubar tabelas automaticamente. Preservar dados, reimplantar versão anterior e validar que APIs existentes e fatos financeiros permanecem inalterados. Qualquer remoção de schema exigirá decisão e plano separados.

## 29. Dúvidas

Não há dúvidas abertas. A `SPEC-005` não possui campo de competência distinto, portanto `dueDate` é a data orçamentária; `paidAt` continua exclusivamente data de caixa. As demais fontes preservam sem conflito as decisões de `referenceMonth` da `SPEC-008` e `paymentDate` da `SPEC-009`.

## 30. Decisões aprovadas

| Data | Decisão | Responsável pela aprovação | Consequência |
|---|---|---|---|
| `2026-08-08` | Aprovar modelo com total obrigatório e linhas opcionais independentes | Solicitante | Plano simples, sem fechamento forçado |
| `2026-08-08` | Usar `dueDate`, `referenceMonth` e `paymentDate` conforme cada fonte | Solicitante | Competência inequívoca e sem nova data |
| `2026-08-08` | Separar gastos categorizados sem linha de custos de dívida | Solicitante | Projeção explicável sem categoria artificial |
| `2026-08-08` | Restringir categoria arquivada a preservar/remover | Solicitante | Histórico retido sem reativação implícita |
| `2026-08-08` | Não remover orçamento inteiro nem criar status | Solicitante | Menor modelo e retenção da configuração |
| `2026-08-08` | GET por mês ausente retorna `404` | Solicitante | Recurso/projeção coesos; web diferencia rede |
| `2026-08-08` | Não listar intervalo no MVP | Solicitante | Navegação consulta um mês por vez |
| `2026-08-08` | Percentual string com duas casas e `HALF_UP` | Solicitante | Contrato exato sem float |

## 31. Definition of Done específica

Além da [Definition of Done do projeto](../quality/DEFINITION-OF-DONE.md), esta SPEC exige:

- [x] Todas as 32 seções do template estão preenchidas.
- [x] Há ao menos 65 critérios Dado/Quando/Então (80 definidos).
- [x] Fontes incluídas, excluídas e prevenção de dupla contagem estão fechadas.
- [x] Modelo, API, persistência, concorrência, segurança, precisão, web e testes futuros estão definidos.
- [x] Nenhuma dúvida funcional, financeira, arquitetural ou de segurança permanece aberta.
- [x] Esta unidade altera somente o arquivo autorizado e não depende do CI desativado.
- [ ] Em implementação futura, todos os critérios de aceite aplicáveis foram atendidos.
- [ ] Em implementação futura, as evidências obrigatórias foram anexadas.

## 32. Histórico de alterações da SPEC

| Data | Alteração | Motivo | Autor | Aprovador, quando aplicável |
|---|---|---|---|---|
| `2026-08-08` | Criação da `SPEC-010` com status Aprovada | Definir orçamento mensal antes do dashboard | Equipe Planner Fin | Solicitante da tarefa |
