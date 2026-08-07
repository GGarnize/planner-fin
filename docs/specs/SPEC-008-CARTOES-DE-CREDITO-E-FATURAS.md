# SPEC de funcionalidade — `SPEC-008 — Cartões de crédito e faturas`

> Esta SPEC define exclusivamente o comportamento futuro. Não implementa código, banco de dados, API ou interface.

## 1. Identificação

| Campo | Valor |
|---|---|
| ID | `SPEC-008` |
| Título | Cartões de crédito e faturas |
| Responsável | Equipe Planner Fin |
| Data de criação | `2026-08-07` |
| Última atualização | `2026-08-07` |
| Tarefa relacionada | `PROMPT-SPEC-008-CARTOES-E-FATURAS.md` |
| Documentos relacionados | `SPEC-002` a `SPEC-007`; `ADR-001` a `ADR-006`; documentos de produto, qualidade e processo |

## 2. Status

`Aprovada`

**Aprovada por:** solicitante da tarefa, em `2026-08-07`.

A aprovação autoriza uma implementação futura aderente a esta SPEC; esta unidade é somente documental.

## 3. Contexto

Autenticação e isolamento por usuário, contas, categorias, lançamentos, transferências e recorrências já possuem contratos. O produto precisa representar cartão, compras à vista ou parceladas, ciclos, faturas e pagamento integral sem confundir obrigação de crédito com conta financeira nem contar a mesma despesa duas vezes.

O cartão de crédito **não é** uma `FinancialAccount`. A compra é o fato econômico de despesa, reconhecido por suas parcelas; o pagamento integral da fatura é somente a quitação da obrigação e a saída efetiva da conta pagadora.

## 4. Problema

Sem uma fonte única e regras de ciclo, precisão e concorrência, compra e pagamento podem ser tratados como duas despesas, parcelas podem cair em faturas erradas, centavos podem divergir e pagamentos simultâneos podem retirar dinheiro duas vezes. Também é necessário preservar histórico e dívida quando recursos são arquivados.

## 5. Objetivo

Definir um contrato verificável para cadastro de cartão, compra em uma ou até 36 parcelas, materialização e fechamento manual de faturas, pagamento integral, agregação de despesas, saldo de conta pagadora, segurança por proprietário e experiência web responsiva, preservando invariantes monetários e idempotência.

## 6. Fora do escopo

- Pagamento parcial ou mínimo, rotativo, juros, multa e atraso financeiro.
- Estorno, chargeback, cancelamento/antecipação de parcelas e reabertura de fatura.
- Parcelamento de fatura, cartão adicional ou compartilhado, cashback e pontos.
- Multimoeda, integração/importação de operadora, automação por IA.
- Fechamento automático por scheduler.
- Implementação de código, Prisma, migration, dependências, endpoints, telas ou CI nesta unidade documental.

## 7. Termos

| Termo | Definição adotada nesta SPEC |
|---|---|
| Cartão | Instrumento de crédito do usuário; não é conta financeira e seu limite é informativo. |
| Compra | Fonte única do fato econômico, representada por `CardPurchase`. |
| Parcela | Fração monetária indivisível da compra atribuída a exatamente uma fatura. |
| Ciclo | Mês civil `YYYY-MM` da data de fechamento da fatura. |
| Fatura corrente | Fatura cujo fechamento é o primeiro fechamento aplicável à data da compra. |
| Obrigação | Soma de parcelas em faturas `OPEN` ou `CLOSED`, nunca persistida como dívida corrente duplicada. |
| Pagamento | Quitação integral de fatura fechada mediante saída de uma `FinancialAccount`; não é despesa. |
| Data civil | Texto `YYYY-MM-DD`, sem horário nem conversão de fuso. |
| Alteração estrutural | Mudança de `totalAmount`, `installmentCount`, `purchaseDate` ou `cardId`. |

## 8. Comportamento atual

O repositório já especifica autenticação, propriedade, contas, categorias `EXPENSE`, lançamentos, transferências e recorrências. Não há nesta unidade uma implementação confirmada de cartões e faturas. Esta SPEC não altera decisões anteriores nem afirma que os modelos aqui descritos já existam.

## 9. Comportamento desejado

### 9.1 Princípio e fontes de verdade

- `CardPurchase` é a única fonte da compra; suas `CardInstallment` são a decomposição exata usada em faturas e totais de despesa.
- `CardInvoice` agrega parcelas de um cartão/ciclo; seu total é sempre derivado, nunca um total independente editável.
- `CardInvoicePayment` é a única fonte da quitação e da saída na conta pagadora.
- Não se cria `FinancialTransaction` para a compra no cartão nem `FinancialTransaction EXPENSE` para pagar a fatura.
- Não se cria `FinancialTransfer` artificial entre conta e cartão.
- Não se persiste `currentDebt`; a obrigação é derivada de parcelas de faturas não pagas.

### 9.2 Cadastro e arquivamento do cartão

O usuário cria, consulta e edita somente seus cartões. Nome recebe `trim` e é obrigatório. Em nenhum ponto se aceita ou persiste PAN completo, CVV, senha ou token. `last4`, quando informado, contém exatamente quatro dígitos. `creditLimit`, quando informado, é positivo, tem duas casas e caráter apenas informativo.

Arquivamento e restauração são idempotentes. Cartão arquivado não recebe compra nova, mas histórico, parcelas, faturas abertas e obrigação permanecem visíveis e quitáveis. Não há exclusão física de cartão, compra, fatura ou pagamento.

### 9.3 Compra e parcelas

A compra exige cartão próprio e ativo, categoria própria, ativa e do tipo `EXPENSE`, descrição não vazia após `trim`, data civil, valor positivo e `installmentCount` inteiro de 1 a 36. Valores monetários atravessam JSON como string decimal canônica com duas casas; `float` e `double` são proibidos.

A criação da compra, das exatas N parcelas e das faturas necessárias ocorre atomicamente. Uma parcela significa compra 1x no cartão. Cada parcela pertence a uma única fatura.

### 9.4 Algoritmo exato de ciclo

1. Para qualquer ano/mês e dia configurado `d`, calcular `dataAjustada(ano, mês, d)` como o dia `min(d, últimoDiaDoMês)`.
2. Calcular o fechamento do mês da compra usando `closingDay`.
3. Se `purchaseDate` for anterior ou igual a esse fechamento, o ciclo inicial é o mês desse fechamento. Se for posterior, o ciclo inicial é o mês civil seguinte.
4. A parcela 1 pertence ao ciclo inicial; a parcela `n` pertence ao mês obtido ao adicionar `n - 1` meses ao ciclo inicial, com virada de ano civil.
5. `closingDate` é `dataAjustada(anoDoCiclo, mêsDoCiclo, closingDay)`.
6. Para obter `dueDate`, calcular primeiro `dataAjustada` com `dueDay` no mês do fechamento. Se essa data for **posterior** a `closingDate`, ela é o vencimento; caso contrário, usar `dataAjustada` com `dueDay` no mês seguinte. Assim, vencimento sempre ocorre depois do fechamento.
7. Todas as comparações usam datas civis, sem UTC, horário ou fuso.

Exemplos:

| Configuração e compra | Resultado |
|---|---|
| fecha 10, vence 17, compra `2026-08-10` | ciclo `2026-08`, fecha `2026-08-10`, vence `2026-08-17` |
| fecha 10, vence 17, compra `2026-08-11` | ciclo `2026-09`, fecha `2026-09-10`, vence `2026-09-17` |
| fecha 28, vence 5, compra `2026-02-28` | ciclo `2026-02`, fecha `2026-02-28`, vence `2026-03-05` |
| fecha 31, vence 31, ciclo `2026-02` | fecha `2026-02-28`, vence `2026-03-31` |
| fecha 31, vence 30, ciclo `2028-02` | fecha `2028-02-29`, vence `2028-03-30` |
| fecha 30, vence 31, ciclo `2026-04` | fecha `2026-04-30`, vence `2026-05-31` |

O cartão guarda a configuração vigente usada na criação. Faturas já materializadas preservam `closingDate` e `dueDate`; alterar dias do cartão não recalcula ciclos existentes. Compras novas usam a configuração atual.

### 9.5 Parcelamento e centavos

O cálculo usa centavos inteiros:

1. converter `totalAmount` para inteiro `T` em centavos;
2. definir `base = floor(T / N)` e `resto = T mod N`;
3. para parcelas 1 até `resto`, atribuir `base + 1` centavos;
4. para as demais, atribuir `base` centavos.

Logo, `100,00` em 3x gera `33,34 + 33,33 + 33,33 = 100,00`. A soma deve ser exatamente o total, sem aproximação. Uma compra é rejeitada se o total em centavos for menor que N, pois toda parcela deve ser positiva.

### 9.6 Faturas e estados

- `OPEN`: recebe parcelas do ciclo, tem total derivado e pode crescer; não pode ser paga.
- `CLOSED`: composição imutável, `closedAt` registrado; aceita exclusivamente pagamento integral.
- `PAID`: possui exatamente um pagamento efetivo e `paidAt` correspondente; não aceita novo pagamento.
- Transições permitidas: `OPEN -> CLOSED -> PAID`. Não há reabertura ou transição inversa.

A materialização sob demanda é determinística e idempotente. Uma fatura existe no máximo uma vez por `cardId + cycle`. O fechamento manual bloqueia/serializa a composição, registra `closedAt` uma vez e devolve o mesmo resultado em repetição. Compra posterior à decisão de fechamento não entra retroativamente na fatura fechada: o servidor recalcula o primeiro ciclo futuro ainda `OPEN` aplicável, mantendo parcelas mensais consecutivas a partir dele. Uma compra cuja parcela inicial teria de entrar em ciclo já `CLOSED` é realocada integralmente para o próximo ciclo `OPEN`; nunca se altera fatura fechada.

### 9.7 Edição da compra

`description`, `notes` e `categoryId` podem ser editados enquanto nenhuma fatura relacionada estiver `CLOSED` ou `PAID`. Alterações estruturais também só são permitidas nessa condição e regeneram todas as parcelas e vínculos em uma única transação, validando novamente cartão, categoria, ciclo, soma e concorrência. Após qualquer fatura relacionada fechar, toda edição da compra é bloqueada; ajuste e estorno ficam para versão futura.

### 9.8 Pagamento integral e efeito financeiro

O pagamento exige fatura `CLOSED` e conta pagadora própria e ativa. O corpo não aceita valor: o servidor deriva a soma exata das parcelas, cria um único `CardInvoicePayment` com esse valor, registra `paidAt` e muda a fatura para `PAID` atomicamente. Uma repetição ou corrida retorna o pagamento já efetivado, sem nova saída.

Total de despesas realizadas no período:

```text
soma(FinancialTransaction com status PAID e type EXPENSE)
+ soma(CardInstallment pela competência/ciclo consultado)
```

O pagamento nunca integra despesas. A parcela entra uma única vez, inclusive antes da quitação.

Saldo realizado da `FinancialAccount`:

```text
openingBalance
+ FinancialTransaction PAID INCOME
- FinancialTransaction PAID EXPENSE
- FinancialTransfer COMPLETED de saída
+ FinancialTransfer COMPLETED de entrada
- CardInvoicePayment
```

A compra não reduz saldo bancário antes do pagamento. O pagamento reduz exatamente uma vez o saldo da conta, na `paymentDate`. A obrigação do cartão é a soma das parcelas em faturas `OPEN` e `CLOSED` e exclui faturas `PAID`.

### 9.9 Concorrência

Operações críticas usam transação de banco, unicidades e bloqueio/controle otimista equivalente:

- materialização x materialização: `unique(cardId, cycle)` converge para uma fatura;
- close x close: somente uma transição registra `closedAt`; ambas observam a mesma fatura fechada;
- pay x pay: `unique(invoiceId)` e transação produzem um pagamento e uma saída;
- compra x close: serialização decide se a parcela integrou a composição antes do close ou migra a compra para o primeiro ciclo aberto posterior;
- edição estrutural x close: ou regeneração conclui antes do fechamento, ou edição falha sem alteração parcial;
- archive de cartão/categoria x compra: ou compra conclui com recurso ativo antes do archive, ou é rejeitada;
- archive de conta x pay: ou pagamento conclui antes do archive, ou é rejeitado.

Invariantes: uma compra produz exatamente N parcelas; soma exata; uma parcela tem uma fatura; uma fatura por cartão/ciclo; um pagamento por fatura; nenhuma saída, parcela ou despesa duplicada.

## 10. Personas ou atores

| Ator | Necessidade | Ações autorizadas |
|---|---|---|
| Usuário autenticado | Administrar seus cartões, compras, faturas e pagamentos | Operar somente recursos próprios e referências próprias/ativas conforme o estado |
| Visitante | Acessar tela pública de autenticação | Nenhuma operação financeira |
| Sistema | Aplicar cálculo e persistência futura | Derivar proprietário do token, materializar ciclos e preservar invariantes |

## 11. Fluxos

### 11.1 Fluxo principal

1. Usuário autenticado cadastra cartão com fechamento e vencimento.
2. Registra compra 1x ou parcelada com categoria `EXPENSE`.
3. Servidor calcula centavos, ciclos e materializa faturas `OPEN` atomicamente.
4. Usuário consulta fatura atual, parcelas futuras e obrigação.
5. Usuário fecha manualmente a fatura; sua composição se torna imutável.
6. Usuário escolhe conta ativa e data para pagamento integral.
7. Servidor deriva o total, registra pagamento, marca `PAID` e o saldo da conta passa a refletir uma única saída.
8. Relatórios mantêm uma única despesa por parcela, sem incluir pagamento.

### 11.2 Fluxos alternativos e exceções

- Recurso ausente ou alheio → `404`, indistinguível.
- Sem autenticação → `401` e nenhuma mutação.
- Entrada inválida ou campo extra → `400` com erro seguro por campo.
- Categoria não `EXPENSE`, arquivada, ou cartão/conta arquivado → `422` sem efeito parcial.
- Fatura `OPEN` no pagamento ou estado inválido → `409`.
- Close/pay repetido → sucesso idempotente com representação corrente, sem duplicação.
- API indisponível → interface preserva dados preenchidos quando seguro e oferece tentar novamente, sem simular sucesso.

## 12. Regras de negócio

| ID | Regra | Origem/decisão | Exemplo |
|---|---|---|---|
| `RN-01` | Cartão não é `FinancialAccount`. | Princípio aprovado | Não aparece como conta pagadora. |
| `RN-02` | Compra/parcela é despesa; pagamento é quitação. | Princípio aprovado | Pagar 100 não soma mais 100 à despesa. |
| `RN-03` | Dias são inteiros de 1 a 31 e ajustados ao último dia válido. | Tarefa | Dia 31 em fevereiro vira 28/29. |
| `RN-04` | Compra até fechamento, inclusive, entra no ciclo corrente. | Tarefa | Compra dia 10 com fechamento 10. |
| `RN-05` | Parcelas ocupam ciclos consecutivos. | Tarefa | 3x em agosto: ago/set/out. |
| `RN-06` | Quantidade aceita é 1 a 36. | Decisão desta SPEC | 37 é rejeitado. |
| `RN-07` | Soma das parcelas equivale exatamente ao total. | Tarefa | 100/3 conforme regra de centavos. |
| `RN-08` | Fatura totaliza parcelas, sem total persistido editável. | Fonte única | Total muda enquanto `OPEN`. |
| `RN-09` | Apenas `OPEN -> CLOSED -> PAID`. | Tarefa | `OPEN -> PAID` é rejeitado. |
| `RN-10` | Pagamento é integral, derivado no servidor e único. | Tarefa | Corpo não informa amount. |
| `RN-11` | Compra usa categoria própria, ativa e `EXPENSE`. | SPEC-004/tarefa | Categoria `INCOME` falha. |
| `RN-12` | Recursos financeiros referenciados são próprios e ativos. | SPEC-002/tarefa | ID alheio resulta 404. |
| `RN-13` | Fatura fechada é imutável. | Tarefa | Compra posterior não retroage. |
| `RN-14` | Arquivar cartão não apaga nem oculta a obrigação. | Tarefa | Fatura fechada segue pagável. |
| `RN-15` | Dinheiro usa decimal exato `Decimal(19,2)` e string JSON. | ADR/padrão anterior | `"10.00"`, nunca 10.0. |
| `RN-16` | Nenhuma entidade histórica possui DELETE nesta versão. | Tarefa | Não existe rota DELETE. |

## 13. Modelo de dados

### 13.1 Modelos conceituais e persistência futura

| Entidade | Campo | Tipo conceitual | Obrigatório | Regra |
|---|---|---|---|---|
| `FinancialCreditCard` | `id` | UUID | Sim | PK |
| | `userId` | UUID interno | Sim | FK owner; nunca público |
| | `name` | texto | Sim | trim, não vazio |
| | `issuer` | texto | Não | trim; nulo quando vazio |
| | `last4` | texto | Não | exatamente `^[0-9]{4}$` |
| | `creditLimit` | `Decimal(19,2)` | Não | positivo; informativo |
| | `closingDay`, `dueDay` | inteiro | Sim | 1..31 |
| | `archivedAt` | instante | Não | soft archive |
| | `createdAt`, `updatedAt` | instante | Sim | auditoria técnica |
| `CardPurchase` | `id` | UUID | Sim | PK |
| | `userId`, `cardId`, `categoryId` | UUID | Sim | owner redundante protegido; FKs RESTRICT |
| | `description` | texto | Sim | trim, não vazio |
| | `notes` | texto | Não | trim; nulo quando vazio |
| | `purchaseDate` | data civil | Sim | `YYYY-MM-DD` válida |
| | `totalAmount` | `Decimal(19,2)` | Sim | positivo e suficiente para N parcelas |
| | `installmentCount` | inteiro | Sim | 1..36 |
| | `createdAt`, `updatedAt` | instante | Sim | auditoria técnica |
| `CardInstallment` | `id` | UUID | Sim | PK |
| | `purchaseId` | UUID | Sim | FK RESTRICT |
| | `installmentNumber`, `installmentCount` | inteiro | Sim | 1..N e cópia auditável de N |
| | `amount` | `Decimal(19,2)` | Sim | positivo |
| | `referenceMonth` | mês civil | Sim | `YYYY-MM`, competência/ciclo |
| | `invoiceId` | UUID | Sim | FK RESTRICT |
| | `createdAt` | instante | Sim | auditoria técnica |
| `CardInvoice` | `id` | UUID | Sim | PK |
| | `userId`, `cardId` | UUID | Sim | owner e FK RESTRICT |
| | `referenceMonth` | mês civil | Sim | ciclo `YYYY-MM` |
| | `closingDate`, `dueDate` | data civil | Sim | vencimento posterior ao fechamento |
| | `status` | enum | Sim | `OPEN`, `CLOSED`, `PAID` |
| | `closedAt`, `paidAt` | instante | Não | coerentes com status |
| | `createdAt`, `updatedAt` | instante | Sim | auditoria técnica |
| `CardInvoicePayment` | `id` | UUID | Sim | PK |
| | `userId`, `invoiceId`, `accountId` | UUID | Sim | owner; FKs RESTRICT |
| | `amount` | `Decimal(19,2)` | Sim | total derivado integral |
| | `paymentDate` | data civil | Sim | `YYYY-MM-DD` válida |
| | `createdAt` | instante | Sim | auditoria técnica |

### 13.2 Constraints, índices e retenção

- Enums futuros: `CardInvoiceStatus` com `OPEN | CLOSED | PAID`.
- Uniques: `(cardId, referenceMonth)`, `(purchaseId, installmentNumber)` e `CardInvoicePayment.invoiceId`.
- Checks equivalentes: dias 1..31, N 1..36, número da parcela 1..N, valores positivos, `last4` com quatro dígitos e coerência dos estados/timestamps.
- Índices iniciados por `userId` para listagens e cursores; índices para `cardId + referenceMonth`, `invoiceId`, `categoryId`, `accountId`, status e chaves de paginação.
- FKs financeiras usam `ON DELETE RESTRICT`; nenhuma cascade destrutiva.
- Migration futura será nova, aditiva e transacional quando suportado; migrations anteriores permanecem intactas; sem seed.
- `userId` redundante não é confiado a DTO e deve ser coerente entre agregados por validação/transação.

## 14. Contratos de API

### 14.1 Convenções

Todas as rotas futuras ficam sob `/api`, exigem autenticação, derivam `userId` do token, usam DTO explícito com `whitelist` e `forbidNonWhitelisted`, devolvem UUIDs e datas como string e dinheiro como string decimal de duas casas. Respostas nunca incluem `userId`. Recurso principal ou referência alheia/ausente retorna `404`. `400` representa forma inválida, `401` ausência/invalidade de autenticação, `409` conflito de estado/concorrência e `422` regra de domínio.

Listagens de compras e faturas exigem `limit` de 1 a 100 (padrão 20) e cursor opaco estável. Ordem padrão: chave temporal descendente, depois `id` descendente. Resposta: `{ "items": [...], "nextCursor": "..." | null }`. Cursor incompatível com filtros retorna `400`.

### 14.2 Cartões

| Operação | Entrada | Sucesso | Regras específicas |
|---|---|---|---|
| `POST /api/cards` | `{name, issuer?, last4?, creditLimit?, closingDay, dueDay}` | `201` cartão | Não idempotente; valida campos e owner. |
| `GET /api/cards` | `archived?`, padrão somente ativos | `200 {items}` | Lista própria; volume pequeno sem paginação obrigatória. |
| `GET /api/cards/:id` | path UUID | `200` cartão e resumo derivado | `404` indistinguível. |
| `PATCH /api/cards/:id` | subconjunto dos campos editáveis | `200` atualizado | Dias novos só afetam compras/faturas novas; corpo vazio `400`. |
| `POST /api/cards/:id/archive` | sem corpo | `200` | Idempotente; preserva histórico/dívida. |
| `POST /api/cards/:id/restore` | sem corpo | `200` | Idempotente. |

### 14.3 Compras

| Operação | Entrada | Sucesso | Regras específicas |
|---|---|---|---|
| `POST /api/card-purchases` | `{cardId, categoryId, description, notes?, purchaseDate, totalAmount, installmentCount}` | `201` compra com parcelas | Atomicidade; cartão/categoria ativos; cria N parcelas uma vez. |
| `GET /api/card-purchases` | `limit`, `cursor?`, `cardId?`, `categoryId?`, `dateFrom?`, `dateTo?` | `200` página | Paginação obrigatória e filtros próprios. |
| `GET /api/card-purchases/:id` | path UUID | `200` compra e parcelas | Inclui fatura/ciclo, não `userId`. |
| `PATCH /api/card-purchases/:id` | campos permitidos | `200` compra e parcelas | Bloqueia se qualquer fatura relacionada não estiver `OPEN`; regeneração estrutural atômica. |

### 14.4 Faturas

| Operação | Entrada | Sucesso | Regras específicas |
|---|---|---|---|
| `GET /api/card-invoices` | `limit`, `cursor?`, `cardId?`, `status?`, `cycleFrom?`, `cycleTo?` | `200` página | Pode materializar determinística e idempotentemente ciclos demandados; paginação obrigatória. |
| `GET /api/card-invoices/:id` | path UUID | `200` fatura, parcelas, total derivado e pagamento opcional | `404` indistinguível. |
| `POST /api/card-invoices/:id/close` | sem corpo | `200` fatura `CLOSED` | Idempotente; `OPEN -> CLOSED`; `PAID` permanece `PAID`; sem scheduler. |
| `POST /api/card-invoices/:id/pay` | `{accountId, paymentDate}` | `200` fatura `PAID` e pagamento | Somente integral; idempotente; valor recusado como campo extra. |

Não existem rotas `DELETE`. Idempotência de close/pay significa repetição para o mesmo recurso e intenção já concluída; uma repetição de pay com conta/data divergentes retorna `409` e nunca cria outra saída.

## 15. Interface

Rotas protegidas futuras: `/cards` e `/cards/:id`, com navegação coerente ao produto. A interface responsiva deve:

- cadastrar, editar, arquivar e restaurar cartão;
- lançar compra 1x ou parcelada e selecionar apenas categoria `EXPENSE` ativa;
- mostrar valor total, `N x`, distribuição exata, fatura atual e parcelas futuras;
- listar e detalhar faturas `OPEN`, `CLOSED` e `PAID`, total, fechamento e vencimento;
- permitir close apenas em `OPEN` e pay apenas em `CLOSED`, escolhendo conta ativa;
- explicar junto ao pagamento: “O pagamento reduz o saldo da conta e não registra uma nova despesa”;
- oferecer loading, esqueleto/feedback, vazio com ação principal, erro de validação, indisponibilidade e retry;
- impedir duplo envio enquanto uma mutação está em curso, sem depender disso para idempotência;
- manter legibilidade e operação por teclado em telas móveis e desktop, sem rolagem horizontal obrigatória.

## 16. Validações

| Campo ou ação | Validação | Resultado esperado |
|---|---|---|
| `name`, `description` | string, trim, não vazio e limite de tamanho definido no DTO futuro | `400` por campo |
| `issuer`, `notes` | string opcional; vazio vira nulo; limite de tamanho | `400` por campo |
| `last4` | ausente ou quatro dígitos ASCII | `400` sem revelar dado |
| `creditLimit` | string decimal positiva, máximo `Decimal(19,2)` | `400/422` |
| `closingDay`, `dueDay` | inteiro 1..31 | `400` |
| `purchaseDate`, `paymentDate` | data civil real em `YYYY-MM-DD` | `400` |
| `totalAmount` | string decimal positiva; sem expoente; duas casas | `400/422` |
| `installmentCount` | inteiro 1..36 e total >= N centavos | `422` |
| categoria | própria, ativa, `EXPENSE` | `404` se alheia/ausente; `422` se inválida |
| cartão | próprio e ativo para compra | `404` ou `422` |
| conta | própria e ativa para pagamento | `404` ou `422` |
| close | fatura própria e `OPEN`, ou já fechada | fecha ou responde idempotentemente |
| pay | fatura `CLOSED`, ou mesma quitação concluída | paga uma vez, repete resultado ou `409` se intenção divergir |
| campos extras | proibidos em todos os DTOs | `400` |

## 17. Permissões

| Ação | Ator autorizado | Condição | Comportamento quando negado |
|---|---|---|---|
| Consultar/mutar cartão | Usuário autenticado | Cartão próprio | `404` se alheio; `401` sem token |
| Criar/editar compra | Usuário autenticado | Referências próprias/ativas e faturas abertas | `404`, `409` ou `422` |
| Consultar/fechar fatura | Usuário autenticado | Fatura própria | `404` ou `401` |
| Pagar fatura | Usuário autenticado | Fatura própria fechada e conta própria/ativa | `404`, `409` ou `422` |
| Acessar rota web | Usuário autenticado | Sessão válida | Redireciona para login sem expor dados |

## 18. Segurança e privacidade

- Dados pessoais/financeiros: nome do cartão, emissor, últimos quatro dígitos, limite, descrições, notas, valores, datas e vínculos financeiros.
- PAN completo, CVV, senha, PIN e tokens de operadora são proibidos em entrada, persistência, resposta, telemetria e logs.
- Todas as rotas são autenticadas; autorização ocorre no backend e owner é derivado exclusivamente do token.
- `cardId`, `categoryId`, `accountId`, `invoiceId` e `purchaseId` são validados no escopo do owner; recurso alheio é `404` indistinguível.
- DTOs usam allowlist, rejeitam extras e evitam mass assignment; `userId`, `status`, totais derivados e timestamps não são graváveis pelo cliente.
- Logs e evidências não contêm tokens, notes/description completas, PAN/CVV, valores financeiros reais ou payload integral. IDs devem ser minimizados/pseudonimizados.
- Entradas textuais são tratadas como texto, escapadas na apresentação e limitadas contra abuso.
- Corridas não podem atravessar owners ou contornar estado/arquivamento.

## 19. Erros e estados vazios

| Situação | Estado apresentado | Recuperação esperada |
|---|---|---|
| Sem cartões | Explicação e ação “Cadastrar cartão” | Abrir formulário |
| Cartão sem compras/faturas | Estado vazio contextual | Lançar compra |
| Filtro sem resultado | Mensagem sem apagar filtro | Limpar/alterar filtros |
| API indisponível | Erro não confundido com vazio; sem sucesso otimista falso | Tentar novamente |
| Validação | Mensagem junto ao campo e resumo acessível | Corrigir e reenviar |
| Conflito de estado | Atualizar detalhe com estado real | Prosseguir conforme estado |
| Sessão inválida | Nenhum dado financeiro renderizado | Redirecionar ao login |

## 20. Observabilidade

Registrar eventos técnicos sanitizados de criação/edição/archive/restore de cartão, criação/edição de compra, materialização, close e pay, com tipo do evento, resultado, duração, status anterior/novo e identificador de correlação. Medir conflitos de unicidade, retries idempotentes e falhas de transação. Nunca registrar payload completo, tokens, notas, descrição, PAN/CVV ou valores de usuário. Alertas futuros devem observar aumento de falhas/duplicidade sem expor dados financeiros.

## 21. Migração e compatibilidade

- Dados existentes: preservados; nenhuma conversão de conta, lançamento, transferência ou recorrência.
- Compatibilidade: agregações de despesa e saldo deverão ser estendidas na implementação futura conforme fórmulas desta SPEC, mantendo contratos anteriores.
- Migration necessária na implementação: nova e aditiva para cinco modelos e enum, com FKs `RESTRICT`, uniques, checks/validações e índices; nunca editar migrations aplicadas; sem seed.
- Implantação gradual: não aplicável nesta unidade documental. A futura implementação deve coordenar API/web e recomputar apenas derivados, sem backfill de cartões inexistentes.

## 22. Critérios de aceite

### `CA-01 — Criar cartão válido`
**Dado** usuário autenticado **Quando** envia cartão válido **Então** recebe seu cartão ativo sem `userId` público.

### `CA-02 — Nome obrigatório e trim`
**Dado** nome vazio após trim **Quando** cria cartão **Então** recebe `400` sem persistência.

### `CA-03 — Últimos quatro dígitos`
**Dado** `last4` diferente de quatro dígitos **Quando** cria/edita **Então** a entrada é rejeitada.

### `CA-04 — Dados de cartão proibidos`
**Dado** payload com PAN ou CVV **Quando** é enviado **Então** campo extra é rejeitado e não é logado.

### `CA-05 — Limite informativo`
**Dado** cartão com limite **Quando** compras excedem esse limite **Então** o sistema não trata limite como saldo nem bloqueia por esta SPEC.

### `CA-06 — Dias no intervalo`
**Dado** fechamento ou vencimento fora de 1..31 **Quando** salva cartão **Então** recebe erro de validação.

### `CA-07 — Compra 1x`
**Dado** cartão/categoria válidos **Quando** cria compra com N=1 **Então** há uma compra, uma parcela de valor total e uma fatura.

### `CA-08 — Compra parcelada`
**Dado** compra válida em 6x **Quando** é criada **Então** gera exatamente seis parcelas em ciclos consecutivos.

### `CA-09 — Limite de parcelas`
**Dado** N=0 ou N=37 **Quando** cria compra **Então** recebe `422` sem registros parciais.

### `CA-10 — Categoria de receita`
**Dado** categoria própria `INCOME` **Quando** cria compra **Então** recebe `422`.

### `CA-11 — Categoria arquivada`
**Dado** categoria própria arquivada **Quando** cria compra **Então** recebe `422` sem parcelas.

### `CA-12 — Valor positivo`
**Dado** total zero ou negativo **Quando** cria compra **Então** recebe erro sem persistência.

### `CA-13 — Decimal em string`
**Dado** valor JSON numérico/float **Quando** envia compra **Então** recebe `400`; string decimal exata é aceita.

### `CA-14 — Cem em três parcelas`
**Dado** total `100.00` e N=3 **Quando** parcela **Então** valores são `33.34`, `33.33`, `33.33`.

### `CA-15 — Resto determinístico`
**Dado** divisão com resto **Quando** a operação é repetida **Então** centavos extras ficam nas primeiras parcelas na mesma ordem.

### `CA-16 — Total menor que parcelas`
**Dado** `0.02` em 3x **Quando** cria compra **Então** recebe `422`, pois nenhuma parcela pode ser zero.

### `CA-17 — Compra antes do fechamento`
**Dado** fechamento dia 10 e compra dia 9 **Quando** calcula ciclo **Então** parcela inicial pertence ao mês da compra.

### `CA-18 — Compra no fechamento`
**Dado** fechamento dia 10 e compra dia 10 **Quando** calcula ciclo **Então** parcela inicial pertence ao mês da compra.

### `CA-19 — Compra após fechamento`
**Dado** fechamento dia 10 e compra dia 11 **Quando** calcula ciclo **Então** parcela inicial pertence ao mês seguinte.

### `CA-20 — Dia 31 em fevereiro comum`
**Dado** ciclo fevereiro de 2026 e fechamento 31 **Quando** materializa **Então** fechamento é `2026-02-28`.

### `CA-21 — Dia 31 em fevereiro bissexto`
**Dado** ciclo fevereiro de 2028 e fechamento 31 **Quando** materializa **Então** fechamento é `2028-02-29`.

### `CA-22 — Dia 31 em mês de 30`
**Dado** ciclo abril e dia 31 **Quando** materializa **Então** usa 30 de abril.

### `CA-23 — Vencimento posterior`
**Dado** fechamento 28 e vencimento 5 **Quando** materializa fevereiro **Então** vence 5 de março.

### `CA-24 — Vencimento ajustado`
**Dado** vencimento 31 em mês sem dia 31 **Quando** materializa **Então** usa o último dia válido do mês de vencimento escolhido.

### `CA-25 — Virada de ano`
**Dado** primeira parcela em dezembro **Quando** gera próxima **Então** seu ciclo é janeiro do ano seguinte.

### `CA-26 — Data civil`
**Dado** data com horário/fuso ou data inexistente **Quando** envia **Então** recebe `400`; `YYYY-MM-DD` válida não sofre conversão.

### `CA-27 — Fatura única por ciclo`
**Dado** duas materializações simultâneas do mesmo cartão/ciclo **Quando** concluem **Então** existe uma única fatura.

### `CA-28 — Total de fatura derivado`
**Dado** fatura com três parcelas **Quando** consulta **Então** total é soma exata e não campo editável.

### `CA-29 — Fatura aberta cresce`
**Dado** fatura `OPEN` **Quando** nova compra elegível conclui antes do close **Então** sua parcela integra o total.

### `CA-30 — Fatura aberta não paga`
**Dado** fatura `OPEN` **Quando** tenta pagar **Então** recebe `409` sem saída da conta.

### `CA-31 — Fechamento`
**Dado** fatura `OPEN` **Quando** fecha **Então** fica `CLOSED` e registra `closedAt` uma vez.

### `CA-32 — Close idempotente`
**Dado** fatura já `CLOSED` **Quando** repete close **Então** recebe a mesma composição sem novo efeito.

### `CA-33 — Close concorrente`
**Dado** dois closes simultâneos **Quando** concluem **Então** há uma transição e um `closedAt` efetivo.

### `CA-34 — Compra versus close`
**Dado** compra e close concorrentes **Quando** serializam **Então** parcela fica integralmente antes do close ou no primeiro ciclo aberto posterior, nunca perdida/duplicada.

### `CA-35 — Sem retroatividade após close`
**Dado** fatura fechada **Quando** cria nova compra que originalmente cairia nela **Então** a compra inicia no primeiro ciclo aberto posterior.

### `CA-36 — Pagamento integral`
**Dado** fatura `CLOSED` e conta ativa **Quando** paga **Então** servidor deriva total, cria um pagamento e muda para `PAID`.

### `CA-37 — Valor não aceito no pagamento`
**Dado** pay contendo `amount` **Quando** envia **Então** recebe `400` por campo não permitido.

### `CA-38 — Pay idempotente`
**Dado** mesma quitação já concluída **Quando** repete conta/data iguais **Então** recebe resultado existente sem nova saída.

### `CA-39 — Pay divergente após quitação`
**Dado** fatura paga **Quando** repete com outra conta ou data **Então** recebe `409` sem outro pagamento.

### `CA-40 — Pay concorrente`
**Dado** dois pagamentos simultâneos **Quando** concluem **Então** há no máximo um pagamento e uma saída bancária.

### `CA-41 — Pagamento reduz saldo`
**Dado** saldo realizado 500 e fatura de 120 **Quando** paga **Então** saldo realizado passa a 380, mantidos os demais termos.

### `CA-42 — Compra não reduz conta antes do pay`
**Dado** compra de 120 e fatura não paga **Quando** consulta conta **Então** saldo bancário não muda por causa da compra.

### `CA-43 — Compra é despesa uma vez`
**Dado** parcela de 120 no período **Quando** agrega despesas **Então** soma 120 exatamente uma vez.

### `CA-44 — Pagamento não é despesa`
**Dado** despesa por parcela já reconhecida **Quando** paga fatura **Então** total de despesas não aumenta.

### `CA-45 — Sem lançamento/transferência artificial`
**Dado** compra e pagamento concluídos **Quando** consulta persistência **Então** não existe `FinancialTransaction` nem `FinancialTransfer` criado para representá-los.

### `CA-46 — Obrigação derivada`
**Dado** faturas `OPEN`, `CLOSED` e `PAID` **Quando** calcula obrigação **Então** soma apenas parcelas das duas primeiras sem `currentDebt` persistido.

### `CA-47 — Edição não estrutural antes do close`
**Dado** todas as faturas relacionadas `OPEN` **Quando** edita descrição/notas/categoria válida **Então** alteração é aplicada.

### `CA-48 — Edição estrutural atômica`
**Dado** faturas relacionadas `OPEN` **Quando** muda total/N/data/cartão **Então** parcelas são regeneradas atomicamente e mantêm soma exata.

### `CA-49 — Edição após close`
**Dado** ao menos uma fatura relacionada `CLOSED` ou `PAID` **Quando** tenta editar a compra **Então** recebe `409` sem alteração.

### `CA-50 — Edição versus close`
**Dado** edição estrutural e close concorrentes **Quando** serializam **Então** edição conclui antes do close ou falha integralmente.

### `CA-51 — Arquivar cartão`
**Dado** cartão ativo **Quando** arquiva duas vezes **Então** fica arquivado sem duplicar efeito.

### `CA-52 — Compra em cartão arquivado`
**Dado** cartão arquivado **Quando** cria compra **Então** recebe `422`.

### `CA-53 — Histórico após archive`
**Dado** cartão arquivado com obrigação **Quando** consulta **Então** histórico/faturas/dívida continuam visíveis e fatura fechada pode ser paga.

### `CA-54 — Restaurar cartão`
**Dado** cartão arquivado **Quando** restaura duas vezes **Então** fica ativo e volta a aceitar compra válida.

### `CA-55 — Conta arquivada no pagamento`
**Dado** conta própria arquivada **Quando** tenta pagar **Então** recebe `422` sem saída.

### `CA-56 — Archive versus pay`
**Dado** archive da conta e pay concorrentes **Quando** serializam **Então** o pagamento conclui antes do archive ou falha sem efeito parcial.

### `CA-57 — Referência alheia`
**Dado** ID de cartão, categoria, conta, compra ou fatura de outro usuário **Quando** referencia **Então** recebe `404` indistinguível.

### `CA-58 — Sem autenticação`
**Dado** ausência de token válido **Quando** acessa qualquer rota **Então** recebe `401` sem leitura/mutação.

### `CA-59 — UserId e mass assignment`
**Dado** payload contendo `userId`, status ou timestamp **Quando** envia **Então** recebe `400` e owner continua vindo do token.

### `CA-60 — Paginação de compras`
**Dado** mais compras que o limite **Quando** percorre cursores **Então** recebe todas uma vez em ordem estável.

### `CA-61 — Paginação de faturas`
**Dado** mais faturas que o limite e filtro de status **Quando** percorre cursores **Então** resultados próprios não repetem nem omitem registros.

### `CA-62 — Sem exclusão física`
**Dado** qualquer cartão/compra/fatura/pagamento **Quando** procura operação DELETE **Então** não existe contrato para exclusão.

### `CA-63 — Estado vazio web`
**Dado** usuário sem cartão **Quando** abre `/cards` **Então** vê estado vazio e ação de cadastro.

### `CA-64 — Fluxo responsivo`
**Dado** viewport móvel ou desktop **Quando** cria compra, consulta, fecha e paga **Então** conclui sem rolagem horizontal obrigatória e com controles acessíveis.

### `CA-65 — Indicação sem dupla contagem`
**Dado** tela de pagamento **Quando** usuário escolhe conta **Então** a UI informa que haverá saída, mas não nova despesa.

### `CA-66 — API indisponível`
**Dado** falha de API **Quando** lista ou envia formulário **Então** UI não simula sucesso, distingue erro de vazio e oferece retry.

### `CA-67 — Redirecionamento web`
**Dado** sessão inválida **Quando** abre rota de cartões **Então** é redirecionado ao login sem conteúdo financeiro.

### `CA-68 — Fluxo E2E sem duplicação`
**Dado** usuário logado com conta/categoria **Quando** cria cartão, compra parcelada, fecha e paga **Então** vê parcelas/fatura, uma saída no saldo e despesa não duplicada, podendo sair com segurança.

## 23. Testes obrigatórios

| Nível | Cenários mínimos | Critérios relacionados | Evidência esperada |
|---|---|---|---|
| Unitário | Dias 28/29/30/31, bissexto, fechamento inclusivo, pós-fechamento, vencimento posterior, virada de ano, 100/3, restos, soma, N, datas, estados, edição, fórmulas de despesa/saldo/obrigação | CA-06 a CA-26, CA-28 a CA-50 | Execução determinística aprovada com dinheiro exato e relógio controlado |
| Integração PostgreSQL | Migration aditiva, FKs/checks/uniques/índices, owner, criação 1x/Nx atômica, materialização, close/pay, corridas, archives, paginação, saldos e dupla contagem; migrations anteriores intactas | CA-07 a CA-62 | Banco real isolado, resultados/constraints e concorrência aprovados |
| Contrato | DTOs, strings decimais, datas, paginação/filtros, códigos 400/401/404/409/422, ausência de `userId`, DELETE e campos extras | CA-01 a CA-13, CA-30 a CA-40, CA-57 a CA-62 | Testes da fronteira HTTP aprovados |
| Web | Vazio, cadastro, 1x/Nx, parcelas, faturas, close/pay, conta, archive/restore, loading, erro, API indisponível, redirect e responsividade | CA-63 a CA-67 | Testes de componentes/integração web e evidência visual sanitizada |
| E2E | Login, cartão, compra parcelada, fatura, close, pay, saldo, despesa única e logout | CA-68 | Fluxo crítico automatizado aprovado com dados fictícios |
| Aceitação manual | Clareza da competência, distribuição, estados, mensagem de pagamento, acessibilidade e viewport móvel/desktop | CA-14, CA-31, CA-36, CA-64 a CA-68 | Checklist e capturas sanitizadas; exigido na futura implementação |

Dados de teste são inteiramente fictícios. Não usar PAN/CVV real. A futura implementação deverá executar lint, typecheck, unitários, integração, contrato, web/E2E e build conforme comandos então existentes. Nesta entrega somente documental, essas execuções de produto são não aplicáveis; verificações documentais e de escopo são obrigatórias.

## 24. Arquivos permitidos

Nesta unidade de criação da SPEC:

- `docs/specs/SPEC-008-CARTOES-DE-CREDITO-E-FATURAS.md`

Uma implementação futura exigirá unidade/branch própria e escopo de arquivos explicitamente autorizado antes de qualquer mudança.

## 25. Arquivos proibidos

- Todo arquivo diferente de `docs/specs/SPEC-008-CARTOES-DE-CREDITO-E-FATURAS.md` nesta unidade.
- Código, Prisma/schema, migrations, dependências, endpoints, telas, autenticação, contas, categorias, lançamentos, transferências, recorrências e CI.
- Documentos de produto, ADRs e SPECs anteriores.

## 26. Dependências

| Dependência | Motivo | Estado da aprovação | Impacto |
|---|---|---|---|
| SPEC-002 a SPEC-007 | Reutilizar autenticação, owner e domínios existentes | Aprovadas/existentes | Contratos futuros devem permanecer compatíveis |
| ADR-001 a ADR-006 | Respeitar arquitetura, cliente, backend, persistência, organização e testes | Aprovadas/existentes | Orientam implementação futura |
| PostgreSQL/Prisma já adotados | Persistência futura dos modelos e constraints | Existente; sem nova dependência | Migration aditiva futura |
| Nova dependência | Não aplicável | Não requerida | Nenhuma dependência adicionada por esta SPEC |

## 27. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Dupla contagem de compra e pagamento | Alta | Totais financeiros incorretos | Fontes separadas, fórmulas explícitas e testes antes/depois |
| Dias inexistentes e bissexto | Alta | Ciclo/vencimento incorreto | `min(d, último dia)` e matriz 28/29/30/31 |
| Compra no instante do fechamento | Média | Parcela perdida ou composição mutável | Data civil inclusiva e serialização compra x close |
| Distribuição divergente de centavos | Alta | Soma diferente do total | Centavos inteiros, resto nas primeiras e invariantes |
| Edição após fechamento | Média | Histórico financeiro reescrito | Bloqueio integral após qualquer close |
| Materialização concorrente | Média | Duas faturas/parcelas duplicadas | Uniques, transação e upsert/retry seguro |
| Pagamento duplicado | Alta | Dupla saída bancária | Unique por invoice e transição/pagamento atômicos |
| Arquivamento com dívida | Média | Obrigação oculta ou impagável | Histórico/obrigação visíveis e pagamento permitido |
| Parcial, juros e estorno futuros | Alta | Modelo insuficiente/evolução complexa | Não antecipar comportamento; nova SPEC e migration aditiva |
| Crescimento do volume | Média | Listagens/agregações lentas | Cursor obrigatório, índices por owner/ciclo e testes de plano futuros |
| Alteração dos dias do cartão | Média | Reclassificação histórica | Datas materializadas imutáveis; configuração nova só no futuro |
| Dados sensíveis de cartão | Baixa | Incidente de segurança | Rejeitar PAN/CVV/segredos e sanitizar logs |

Riscos residuais: a futura evolução para pagamento parcial/juros/estorno exigirá novo desenho de saldo da fatura e razão de ajustes; não deve reutilizar silenciosamente `CardInvoicePayment` integral. Agregações muito longas podem exigir estratégia derivada/cache em SPEC posterior, sem criar fonte de verdade concorrente.

## 28. Rollback

Nesta unidade documental, rollback é `git revert <hash-do-commit>` do único arquivo criado. Não há efeito em dados, runtime ou migrations. Na futura implementação, rollback deve desativar exposição das rotas/telas antes de remover código; migrations aditivas não serão apagadas/destrutivas e dados financeiros não serão excluídos. O plano específico deverá constar da unidade de implementação.

## 29. Dúvidas

| ID | Dúvida | Impacto | Responsável | Estado |
|---|---|---|---|---|
| `D-01` | Qual a quantidade máxima de parcelas? | Validação e modelo | Solicitante/SPEC | Resolvida: 36 |
| `D-02` | Compra no dia do fechamento entra em qual ciclo? | Competência | Solicitante | Resolvida: ciclo corrente |
| `D-03` | Como determinar vencimento quando `dueDay <= closingDay`? | Data da fatura | SPEC aprovada | Resolvida: primeiro dia ajustado estritamente posterior ao fechamento |
| `D-04` | Alterar dias recalcula faturas existentes? | Integridade histórica | SPEC aprovada | Resolvida: não; somente futuras |
| `D-05` | Como tratar compra concorrente/posterior a fatura fechada? | Imutabilidade | SPEC aprovada | Resolvida: primeiro ciclo aberto posterior |

Nenhuma dúvida de comportamento, escopo, dados, segurança ou dependência permanece aberta.

## 30. Decisões aprovadas

| Data | Decisão | Responsável pela aprovação | Consequência |
|---|---|---|---|
| `2026-08-07` | Cartão não é conta; parcela é despesa e pagamento é quitação | Solicitante | Impede `EXPENSE`/transfer artificial e dupla contagem |
| `2026-08-07` | Fechamento inclusivo e dias inexistentes ajustados | Solicitante | Algoritmo civil determinístico |
| `2026-08-07` | Máximo de 36 parcelas e resto nas primeiras | Solicitante/SPEC | Precisão e validação explícitas |
| `2026-08-07` | Somente pagamento integral de fatura fechada | Solicitante | Um pagamento e transição `CLOSED -> PAID` |
| `2026-08-07` | Fechamento manual, materialização sob demanda | Solicitante | Scheduler fica fora do escopo |
| `2026-08-07` | Sem DELETE e com archive/restore de cartão | Solicitante | Histórico e obrigação preservados |
| `2026-08-07` | Configuração alterada não reescreve ciclos existentes | SPEC aprovada pela tarefa | Integridade histórica |

## 31. Definition of Done específica

Para esta entrega documental:

- [x] SPEC criada com status `Aprovada` e somente no arquivo autorizado.
- [x] Modelo conceitual, ciclo, centavos, estados, pagamento, efeitos financeiros, segurança, concorrência, persistência e web futuros definidos.
- [x] Pelo menos 50 critérios Dado/Quando/Então definidos (68 cenários).
- [x] Riscos e testes futuros em todos os níveis aplicáveis documentados.
- [x] Nenhuma dependência, código, Prisma, migration, endpoint, tela ou CI alterado.
- [x] Verificações documentais e revisão de escopo previstas para a entrega.
- [ ] Implementação, testes automatizados de produto e evidências visuais: não aplicáveis a esta unidade; exigidos somente na futura implementação.
- [x] Todas as decisões necessárias a esta SPEC estão registradas e não há dúvida aberta.

## 32. Histórico de alterações da SPEC

| Data | Alteração | Motivo | Autor | Aprovador, quando aplicável |
|---|---|---|---|---|
| `2026-08-07` | Criação da SPEC-008 com status Aprovada | Definir cartões e faturas antes da implementação | Equipe Planner Fin | Solicitante da tarefa |
