# SPEC de funcionalidade — `SPEC-009 — Dívidas e financiamentos`

> Esta SPEC define exclusivamente o comportamento futuro. Não implementa código, banco de dados, API ou interface.

## 1. Identificação

| Campo | Valor |
|---|---|
| ID | `SPEC-009` |
| Título | Dívidas e financiamentos |
| Responsável | Equipe Planner Fin |
| Data de criação | `2026-08-07` |
| Última atualização | `2026-08-07` |
| Tarefa relacionada | `PROMPT-SPEC-009-DIVIDAS-E-FINANCIAMENTOS.md` |
| Documentos relacionados | [`SPEC-002`](SPEC-002-AUTENTICACAO-E-ISOLAMENTO-POR-USUARIO.md) a [`SPEC-008`](SPEC-008-CARTOES-DE-CREDITO-E-FATURAS.md); [`ADR-001`](../adr/ADR-001-ARQUITETURA-GERAL.md) a [`ADR-006`](../adr/ADR-006-ESTRATEGIA-DE-TESTES.md); [visão](../product/VISION.md), [escopo](../product/SCOPE.md), [princípios](../product/PRODUCT-PRINCIPLES.md), [modelo TO-BE](../product/TO-BE-PRODUCT-MODEL.md), [Definition of Done](../quality/DEFINITION-OF-DONE.md), [estratégia de testes](../quality/TEST-STRATEGY.md), [processo de SPECs](README.md) e [fluxo Git](../process/GIT-WORKFLOW.md) |

## 2. Status

`Aprovada`

**Aprovada por:** solicitante da tarefa, em `2026-08-07`.

A aprovação autoriza uma implementação futura aderente a esta SPEC; esta unidade é somente documental.

## 3. Contexto

Autenticação e isolamento, contas, categorias, lançamentos, transferências, recorrências e cartões/faturas já têm contratos. O próximo domínio do MVP é o acompanhamento manual de empréstimos, financiamentos e outras obrigações com cronograma conhecido. O PR #32, que corrigiu o delta de edição de compra da `SPEC-008`, é premissa já incorporada à base desta unidade.

Dívida é obrigação financeira, não receita artificial e não `FinancialAccount`. Principal contratado, cronograma previsto, funding efetivo, pagamentos, custos financeiros e efeito na conta precisam de fontes rastreáveis distintas para impedir dupla contagem.

## 4. Problema

Sem um contrato próprio, a entrada de um empréstimo pode ser contada como receita, o pagamento do principal pode ser contado novamente como despesa e o saldo devedor pode divergir do histórico. Corridas de pagamento também podem retirar dinheiro ou amortizar principal duas vezes. Financiamentos sem entrada de caixa trazem ainda o risco de reconhecer automaticamente receita, despesa ou ativo inexistente no modelo atual.

## 5. Objetivo

Definir comportamento verificável para cadastrar e acompanhar manualmente dívidas com cronograma explícito, registrar no máximo um funding real quando permitido, pagar parcelas somente de forma integral, derivar saldo devedor e atraso, quitar e arquivar a obrigação, refletir uma única saída na conta pagadora e reconhecer juros/tarifas uma única vez como custo financeiro, com segurança por proprietário e web responsiva.

## 6. Fora do escopo

- Cartões e faturas, cobertos pela `SPEC-008`.
- Open Finance, importação, compartilhamento, anexos e notificações.
- Renegociação, refinanciamento, portabilidade, reabertura, estorno e exclusão.
- Cálculo automático SAC/PRICE, inferência de taxa, juros variáveis, indexadores, multa ou mora automática.
- Cobrança judicial, garantias, score e aconselhamento financeiro.
- Pagamento parcial, antecipação parcial, pagamento ou funding automático e scheduler.
- Reconhecimento automático de ativo/bem financiado ou da despesa original associada à obrigação.
- Multimoeda e automação por IA.
- Implementação de código, Prisma, migration, dependências, endpoints, telas, seed ou CI nesta unidade documental.

## 7. Termos

| Termo | Definição adotada nesta SPEC |
|---|---|
| Dívida | Obrigação financeira registrada em `FinancialDebt`; não é conta nem receita. |
| Principal original | Capital contratado, fonte imutável da obrigação inicial e soma exata dos principais das parcelas. |
| Funding | Entrada real de dinheiro de um empréstimo em conta própria, registrada por `DebtFunding`; não é receita. |
| Parcela | Componente previsto indivisível, composto por principal, juros e tarifa explicitamente informados. |
| Pagamento | Evento efetivo e integral de uma parcela, registrado por `DebtPayment` e debitado uma vez da conta. |
| Saldo devedor | Principal original menos principal dos pagamentos efetivos; projeção derivada, nunca fonte independente. |
| Custo financeiro | Soma de juros e tarifas efetivamente pagos; despesa financeira agregada diretamente de pagamentos. |
| Atrasada | Parcela `PENDING` com `dueDate` anterior à data civil atual; projeção `OVERDUE`, não estado persistido. |
| Quitação | Estado `PAID_OFF`, atingido exatamente quando todas as parcelas estão `PAID`. |
| Alteração estrutural | Mudança em tipo, principal, data inicial, quantidade, funding, vencimento ou componentes de parcela. |
| Data civil | Texto `YYYY-MM-DD`, sem horário nem conversão de fuso. |

## 8. Comportamento atual

O repositório especifica os domínios anteriores, mas não há nesta unidade uma implementação confirmada de dívidas. O modelo TO-BE anterior distingue obrigação, parcela, pagamento e conta, e deixa a regra específica para esta SPEC. Esta SPEC resolve essas decisões para o MVP sem alterar os documentos anteriores nem alegar que os modelos futuros já existam.

## 9. Comportamento desejado

### 9.1 Princípio e fontes de verdade

- `FinancialDebt` guarda contrato e estado; não persiste `currentDebt` ou saldo corrente editável.
- `DebtInstallment` guarda o cronograma contratado explícito.
- `DebtFunding` é a única fonte de eventual entrada real de caixa do empréstimo.
- `DebtPayment` é a única fonte de pagamento efetivo, amortização e saída da conta.
- Funding nunca gera `FinancialTransaction INCOME` nem `FinancialTransfer`.
- Pagamento nunca gera `FinancialTransaction EXPENSE` nem transferência artificial.
- Principal pago reduz passivo e conta, mas não é nova despesa. Somente juros e tarifas pagos entram uma vez na agregação de despesas financeiras.

### 9.2 Tipo, origem e funding

O enum fechado `DebtType` contém `LOAN`, `FINANCING`, `NEGOTIATED_DEBT` e `OTHER`:

| Tipo | Funding | Efeito na conta | Efeito em receita |
|---|---|---|---|
| `LOAN` | Obrigatório nesta versão; representa a entrada real integral do principal | Soma `DebtFunding.amount` uma vez ao saldo da conta indicada | Nenhum |
| `FINANCING` | Proibido | Nenhum no cadastro | Nenhum |
| `NEGOTIATED_DEBT` | Proibido | Nenhum no cadastro | Nenhum |
| `OTHER` | Proibido | Nenhum no cadastro | Nenhum |

Para `LOAN`, `funding.amount` deve ser exatamente `originalPrincipal`, pois esta versão suporta uma única liberação integral, e dívida, cronograma e funding são criados na mesma transação. Liberação em tranches fica futura. Nos demais tipos, não há entrada nova de caixa: o cadastro não cria receita, despesa, conta, transferência nem ativo. Se uma obrigação que conceitualmente seria `OTHER` tiver entrada real de dinheiro, deve ser classificada como `LOAN` neste enum fechado.

### 9.3 Cadastro e cronograma explícito

O usuário informa `installmentCount` e exatamente essa quantidade de itens em `installments`. Cada item contém `installmentNumber`, `dueDate`, `principalAmount`, `interestAmount` e `feeAmount`. Não há atalho uniforme nesta versão: explicitar todos os componentes mantém o contrato simples, auditável e sem arredondamento escondido.

Os números formam a sequência sem lacunas `1..installmentCount`, vencimentos são estritamente crescentes e não anteriores a `startDate`, e a soma dos `principalAmount` é exatamente `originalPrincipal`. Cada principal é positivo; juros e tarifa podem ser zero ou positivos. Não se aceita parcela de total zero, taxa para cálculo, valor negativo, mais de duas casas ou número JSON. A API não infere juros nem redistribui centavos.

### 9.4 Precisão monetária

Dinheiro atravessa JSON como string decimal canônica `^[0-9]+\.[0-9]{2}$` e será `Decimal(19,2)` no banco futuro. `float`, `double`, notação exponencial, vírgula decimal, sinal, `NaN`, arredondamento e truncamento silenciosos são proibidos. Somas e subtrações usam decimal exato; resultado fora de `Decimal(19,2)` é rejeitado sem efeito parcial.

### 9.5 Estados, atraso e quitação

- Dívida persiste somente `ACTIVE` ou `PAID_OFF`.
- Parcela persiste somente `PENDING` ou `PAID`.
- Criação produz dívida `ACTIVE` e todas as parcelas `PENDING`.
- `PENDING -> PAID` é a única transição de parcela.
- A dívida muda `ACTIVE -> PAID_OFF` na mesma transação que paga a última parcela pendente.
- Não há reabertura, estorno, transição inversa ou `DELETE` nesta versão.
- `OVERDUE` é somente projeção: `status == PENDING && dueDate < hoje`; hoje e futuro não estão atrasados. Não se persiste esse valor nem se calcula multa.

### 9.6 Pagamento integral e reconhecimento econômico

O usuário escolhe uma parcela `PENDING`, uma conta própria ativa e `paymentDate`. O corpo não aceita valor. O servidor copia para `DebtPayment` os três componentes exatos da parcela, deriva `total = principalAmount + interestAmount + feeAmount`, cria um único pagamento, marca a parcela `PAID` e, se não restar parcela pendente, marca a dívida `PAID_OFF`, tudo atomicamente.

O pagamento pode ocorrer antes, no dia ou depois do vencimento. Não há bloqueio por saldo insuficiente nesta SPEC, em coerência com contas que podem apresentar saldo negativo; a conta precisa apenas ser própria e ativa.

Reconhecimento:

```text
amortização do passivo = soma(DebtPayment.principalAmount)
despesa financeira realizada = soma(DebtPayment.interestAmount + DebtPayment.feeAmount)
```

O principal não entra na agregação de despesas. Juros/tarifas entram diretamente de `DebtPayment`, uma única vez e na `paymentDate`, sem categoria ou `FinancialTransaction` artificial. Esta escolha limita a classificação detalhada desses custos nesta versão; uma evolução exigirá nova SPEC sem recontar o histórico.

### 9.7 Saldos e projeções derivadas

Saldo devedor:

```text
outstandingPrincipal = originalPrincipal
  - soma(principalAmount de DebtPayment efetivo da dívida)
```

Também são derivados: principal pago, juros/tarifas pagos e pendentes, total futuro contratado das parcelas `PENDING`, quantidade paga/pendente, parcelas vencidas e próxima parcela. A próxima parcela é a `PENDING` de menor `(dueDate, installmentNumber)`; se não houver, é `null`. Nenhuma dessas projeções é fonte persistida independente.

Saldo realizado da conta:

```text
openingBalance
+ FinancialTransaction PAID INCOME
- FinancialTransaction PAID EXPENSE
- FinancialTransfer COMPLETED de saída
+ FinancialTransfer COMPLETED de entrada
- CardInvoicePayment
+ DebtFunding
- DebtPayment.total
```

`DebtFunding` aumenta saldo sem aumentar receita. `DebtPayment.total` reduz saldo uma vez; somente seus juros/tarifas aumentam despesa. No financiamento de bem, o produto não reconhece automaticamente ativo nem despesa de principal: o cadastro apenas acompanha a obrigação e esta limitação deve aparecer na UI.

### 9.8 Edição

Enquanto não existir `DebtPayment`, pode-se editar campos descritivos e, atomicamente, tipo, principal, data inicial, quantidade, funding e cronograma, reaplicando todas as regras. Alterar entre `LOAN` e outro tipo cria/remove funding apenas como parte dessa edição anterior a pagamentos e ajusta o saldo da conta atomicamente pelo delta entre funding anterior e novo; não cria receita/despesa. Funding não pode ser editado por rota própria.

Após o primeiro pagamento, somente `creditorName`, `description` e `notes` são editáveis. Tipo, principal, `startDate`, `installmentCount`, funding, parcelas, valores e datas são imutáveis. Parcela paga e pagamento nunca são alterados. Um PATCH misto que contenha campo proibido falha por inteiro. Renegociação é futura.

### 9.9 Arquivamento

Somente dívida `PAID_OFF` pode ser arquivada. Dívida `ACTIVE`, mesmo sem parcela vencida, retorna erro de domínio. `archive` e `restore` são lógicos e idempotentes; restaurar limpa `archivedAt`, mas preserva `PAID_OFF` e não reabre parcelas. Funding, cronograma e pagamentos continuam visíveis e imutáveis. Dívida arquivada não aceita edição ou pagamento; não existe exclusão física.

### 9.10 Concorrência e atomicidade

Operações críticas usam transação de banco, unicidades, leitura bloqueada ou controle otimista equivalente:

- criação dívida + funding + parcelas: tudo persiste ou nada persiste; `unique(debtId)` impede segundo funding;
- `pay x pay`: `unique(installmentId)` converge para um pagamento; retry idêntico retorna o existente, sem segunda saída;
- última parcela x última parcela: a dívida fica `PAID_OFF` exatamente após todas estarem `PAID`, uma única vez;
- edição estrutural x pay: ou edição termina antes e o pagamento usa o novo contrato, ou pagamento vence e a edição estrutural falha integralmente;
- archive x pay: dívida só pode arquivar após quitação; serialização evita arquivar e pagar parcialmente;
- archive da conta x pay: ou pagamento conclui com conta ainda ativa antes do archive, ou falha sem pagamento/saída;
- archive da conta x criação/edição de funding: ou funding conclui com conta ativa antes do archive, ou toda mutação da dívida falha.

Invariantes: no máximo um funding por dívida, um pagamento por parcela, uma saída por pagamento e um abatimento de principal; soma contratada exata; `PAID_OFF` se e somente se todas as parcelas estiverem pagas; nenhuma operação parcial.

## 10. Personas ou atores

| Ator | Necessidade | Ações autorizadas |
|---|---|---|
| Usuário autenticado | Acompanhar suas obrigações e pagamentos | Operar somente dívidas, parcelas e contas próprias conforme estado |
| Visitante | Acessar autenticação | Nenhuma operação financeira |
| Sistema | Aplicar contratos e derivações | Obter owner do token, validar componentes e preservar invariantes |

## 11. Fluxos

### 11.1 Fluxo principal

1. Usuário autenticado escolhe tipo, informa contrato e cronograma explícito.
2. Para `LOAN`, informa conta ativa e data de funding integral; para os demais, não informa funding.
3. Servidor valida proprietário, dinheiro, datas, sequência e soma do principal e cria o agregado atomicamente.
4. Usuário consulta saldo devedor, custos, parcelas, atraso e próxima parcela derivados.
5. Escolhe parcela pendente, conta ativa e data para pagamento integral.
6. Servidor deriva os componentes, registra pagamento e saída, e atualiza estados atomicamente.
7. Ao pagar a última parcela, a dívida fica `PAID_OFF` e pode ser arquivada ou restaurada sem reabertura.

### 11.2 Fluxos alternativos e exceções

- Ausência de autenticação → `401`, sem leitura ou mutação.
- Recurso principal ou referência ausente/alheia → `404`, indistinguível.
- DTO, decimal, data, cursor ou campo extra inválido → `400`, sem efeito parcial.
- Recurso próprio arquivado, tipo/funding incompatível, soma ou transição de domínio inválida → `422`.
- Corrida ou repetição divergente de pagamento → `409`; repetição idêntica → `200` com o pagamento existente.
- API indisponível → web não simula sucesso, preserva entrada quando seguro e oferece retry.

## 12. Regras de negócio

| ID | Regra | Origem/decisão | Exemplo |
|---|---|---|---|
| `RN-01` | Dívida é obrigação, não conta ou receita. | Princípio aprovado | Principal não aparece como renda. |
| `RN-02` | `DebtType` é fechado nos quatro valores definidos. | Tarefa | Tipo desconhecido recebe `400`. |
| `RN-03` | `LOAN` exige um funding integral; outros tipos o proíbem. | Decisão desta SPEC | Empréstimo de 10.000 libera 10.000. |
| `RN-04` | Funding é único, atômico e aumenta saldo sem receita. | Tarefa | Retry não credita novamente. |
| `RN-05` | Cronograma é explícito e contém exatamente N parcelas. | Tarefa | N=3 exige itens 1, 2 e 3. |
| `RN-06` | Soma dos principais equivale exatamente ao original. | Tarefa | `600.00 + 400.00 = 1000.00`. |
| `RN-07` | Principal de parcela é positivo; juros/tarifa são não negativos. | Decisão desta SPEC | Parcela sem amortização é rejeitada. |
| `RN-08` | Dinheiro usa string e `Decimal(19,2)`, sem arredondar. | Padrão aprovado | `"10.00"` é válido. |
| `RN-09` | Pagamento é integral, derivado e único por parcela. | Tarefa | Corpo não contém `amount`. |
| `RN-10` | Principal pago reduz passivo, não despesa. | Princípio aprovado | Amortização não duplica custo. |
| `RN-11` | Juros/tarifas pagos entram uma vez em despesa financeira. | Princípio aprovado | Agregação lê `DebtPayment`. |
| `RN-12` | Saldo devedor e atraso são derivados. | Tarefa | Não existe `currentDebt`/`OVERDUE` persistido. |
| `RN-13` | Última parcela paga quita a dívida. | Tarefa | Todas `PAID` implicam `PAID_OFF`. |
| `RN-14` | Após pagamento, somente textos seguros são editáveis. | Tarefa | Vencimento histórico não muda. |
| `RN-15` | Somente dívida quitada pode ser arquivada. | Tarefa | `ACTIVE` recebe `422`. |
| `RN-16` | Não há DELETE, reabertura ou estorno. | Tarefa | Histórico é preservado. |
| `RN-17` | Recursos financeiros referenciados são próprios e ativos. | SPEC-002/003 | Conta alheia retorna `404`. |
| `RN-18` | Financiamento não cria ativo ou despesa automaticamente. | Limite aprovado | Bem fica fora do modelo. |

## 13. Modelo de dados

### 13.1 Modelos conceituais e Prisma futuro

| Entidade | Campo | Tipo conceitual | Obrigatório | Regra |
|---|---|---|---|---|
| `FinancialDebt` | `id` | UUID | Sim | PK |
| | `userId` | UUID interno | Sim | Owner; nunca aceito/exposto publicamente |
| | `type` | enum | Sim | `LOAN`, `FINANCING`, `NEGOTIATED_DEBT`, `OTHER` |
| | `creditorName` | texto | Sim | `trim`, não vazio |
| | `description` | texto | Sim | `trim`, não vazio |
| | `notes` | texto | Não | `trim`; nulo quando vazio |
| | `originalPrincipal` | `Decimal(19,2)` | Sim | Positivo; soma dos principais |
| | `startDate` | data civil | Sim | Data contratual válida |
| | `installmentCount` | inteiro | Sim | 1..600 nesta versão |
| | `status` | enum | Sim | `ACTIVE` ou `PAID_OFF` |
| | `archivedAt` | instante | Não | Archive lógico |
| | `createdAt`, `updatedAt` | instante | Sim | Auditoria técnica |
| `DebtFunding` | `id` | UUID | Sim | PK |
| | `userId`, `debtId`, `accountId` | UUID | Sim | Owner/FKs `RESTRICT`; `debtId` unique |
| | `amount` | `Decimal(19,2)` | Sim | Igual ao principal original |
| | `fundingDate` | data civil | Sim | Entrada real; pode ser anterior, igual ou posterior a `startDate` |
| | `createdAt` | instante | Sim | Auditoria técnica |
| `DebtInstallment` | `id` | UUID | Sim | PK |
| | `debtId` | UUID | Sim | FK `RESTRICT` |
| | `installmentNumber` | inteiro | Sim | Sequência 1..N; unique com `debtId` |
| | `dueDate` | data civil | Sim | Crescente e não anterior a `startDate` |
| | `principalAmount` | `Decimal(19,2)` | Sim | Positivo |
| | `interestAmount`, `feeAmount` | `Decimal(19,2)` | Sim | Zero ou positivo |
| | `status` | enum | Sim | `PENDING` ou `PAID` |
| | `createdAt`, `updatedAt` | instante | Sim | Auditoria e transição |
| `DebtPayment` | `id` | UUID | Sim | PK |
| | `userId`, `debtId`, `installmentId`, `accountId` | UUID | Sim | Owner/FKs `RESTRICT`; `installmentId` unique |
| | `paymentDate` | data civil | Sim | Efetivação informada |
| | `principalAmount`, `interestAmount`, `feeAmount` | `Decimal(19,2)` | Sim | Cópia imutável dos componentes da parcela |
| | `createdAt` | instante | Sim | Auditoria técnica |

`DebtPayment.debtId` e os `userId` redundantes dão suporte a isolamento/agregação, mas devem ser coerentes com as relações e nunca confiados ao cliente. Não existe campo persistido para total da parcela, saldo devedor, atraso, próxima parcela ou despesa financeira; são derivações.

### 13.2 Migration, constraints e índices futuros

- Enums futuros: `DebtType`, `DebtStatus` e `DebtInstallmentStatus` com os valores fechados desta SPEC.
- Uniques: `(debtId, installmentNumber)`, `DebtFunding.debtId`, `DebtPayment.installmentId`.
- Checks equivalentes: principal original/principal de parcela positivos; juros/tarifa não negativos; `installmentCount` 1..600; número 1..N; valores dentro de `Decimal(19,2)`; coerência de estados.
- Validações agregadas/transacionais garantem quantidade, sequência, vencimentos, soma exata, funding por tipo, componentes copiados e `PAID_OFF` se e somente se todas as parcelas estiverem pagas.
- Índices: `FinancialDebt(userId, archivedAt, status, type, createdAt, id)`; índices por `userId`, `status`, `type`; `DebtInstallment(debtId, dueDate, installmentNumber)` e por `dueDate/status`; `DebtFunding.accountId`; `DebtPayment.accountId`, `(userId, paymentDate, id)` e chaves dos cursores.
- Todas as FKs financeiras usam `ON DELETE RESTRICT`; não há cascade destrutiva.
- A implementação criará uma única migration nova, aditiva e transacional quando suportado. Migrations anteriores ficam intactas; não haverá seed.

## 14. Contratos de API

### 14.1 Convenções compartilhadas

Todas as rotas futuras exigem autenticação e derivam `userId` do token. DTOs explícitos usam `whitelist` e `forbidNonWhitelisted`; respostas não expõem `userId`. UUID, data e dinheiro saem como strings, sendo dinheiro sempre decimal com duas casas.

Erros usam envelope seguro `{ "statusCode": 400, "code": "VALIDATION_ERROR", "message": "...", "errors"?: [{ "field": "...", "code": "..." }] }`. `400`: forma/DTO/cursor; `401`: autenticação; `404`: ausente ou alheio; `409`: repetição divergente/conflito concorrente; `422`: regra de domínio própria. Não há `DELETE` nem endpoint separado de funding.

Listagem usa `limit` inteiro de 1 a 100, padrão 20, e cursor opaco que vincula filtros e chave `(createdAt, id)`. Ordem padrão: `createdAt DESC, id DESC`. Resposta: `{ "items": [...], "nextCursor": "..." | null }`. Cursor malformado, expirado ou usado com filtros diferentes recebe `400`.

Projeções de dívida incluem `outstandingPrincipal`, `paidPrincipal`, custos pagos/pendentes, `paidInstallmentCount`, `pendingInstallmentCount`, `overdueInstallmentCount`, `nextInstallment` e `totalFutureAmount`, todos derivados. Parcela inclui `projectedStatus: "PENDING" | "OVERDUE" | "PAID"`.

### 14.2 Criar — `POST /api/debts`

- Entrada comum: `{ type, creditorName, description, notes?, originalPrincipal, startDate, installmentCount, installments: [{ installmentNumber, dueDate, principalAmount, interestAmount, feeAmount }] }`.
- Para `LOAN`, acrescentar obrigatoriamente `funding: { accountId, amount, fundingDate }`; nos demais tipos, `funding` é proibido.
- Sucesso: `201` com dívida, funding quando existente, cronograma e projeções.
- Erros: códigos compartilhados; `422` para conta própria arquivada, soma/quantidade/sequência/data incompatível ou funding incompatível.
- Autorização: conta do funding deve pertencer ao token; alheia/ausente retorna `404`.
- Idempotência: criação não é idempotente nesta versão; duplo envio intencional cria duas dívidas. A atomicidade impede agregado parcial.

### 14.3 Listar — `GET /api/debts`

- Entrada query: `status?=ACTIVE|PAID_OFF`, `type?`, `archived?=false|true|all` (padrão `false`), `due?=overdue|upcoming|all` (padrão `all`), `limit?`, `cursor?`.
- `due=overdue` seleciona dívida com ao menos uma parcela atrasada; `upcoming` seleciona dívida com parcela pendente e nenhuma atrasada. Em `PAID_OFF`, ambos produzem lista vazia quando combinados.
- Sucesso: `200 { items, nextCursor }`, somente recursos próprios, com resumo derivado.
- Idempotência: leitura sem efeito.

### 14.4 Consultar — `GET /api/debts/:id`

- Entrada: UUID no path.
- Sucesso: `200` com dívida, funding, cronograma ordenado por número, pagamentos ordenados por `paymentDate DESC, id DESC` e projeções.
- Erros: `400` UUID inválido; `404` ausente/alheia. Dívida própria arquivada permanece consultável.
- Idempotência: leitura sem efeito.

### 14.5 Editar — `PATCH /api/debts/:id`

- Entrada antes de pagamento: subconjunto não vazio dos campos de criação; qualquer mudança estrutural envia o agregado estrutural completo (`type`, `originalPrincipal`, `startDate`, `installmentCount`, `installments` e `funding` conforme tipo) para substituição atômica. Campos descritivos podem vir isolados.
- Entrada após pagamento: subconjunto não vazio de `{ creditorName, description, notes }`.
- Sucesso: `200` com representação e projeções atualizadas.
- Erros: `404` ausente/alheia; `422` arquivada, campo estrutural após pagamento, conta arquivada ou contrato incompatível; `409` se corrida com pagamento impedir a edição.
- Idempotência: repetir o mesmo PATCH produz o mesmo estado; ajuste de funding aplica somente o delta uma vez na transação.

### 14.6 Arquivar — `POST /api/debts/:id/archive`

- Entrada: path UUID; corpo ausente.
- Sucesso: `200` com dívida `PAID_OFF` arquivada. Repetição retorna o mesmo estado.
- Erros: `404` ausente/alheia; `422` dívida `ACTIVE`.
- Idempotência: sim, sem novo efeito.

### 14.7 Restaurar — `POST /api/debts/:id/restore`

- Entrada: path UUID; corpo ausente.
- Sucesso: `200` com `archivedAt = null`, ainda `PAID_OFF`. Repetição retorna o mesmo estado.
- Erros: `404` ausente/alheia.
- Idempotência: sim, sem reabertura.

### 14.8 Pagar — `POST /api/debt-installments/:id/pay`

- Entrada: `{ "accountId": "uuid", "paymentDate": "YYYY-MM-DD" }`; valor/componentes são proibidos.
- Sucesso novo: `201` com pagamento, parcela e dívida atualizadas e projeções. Retry com mesma conta/data: `200` com o pagamento existente.
- Erros: `404` parcela/dívida/conta ausente ou alheia; `422` dívida arquivada, parcela incompatível ou conta própria arquivada; `409` parcela já paga com conta/data divergentes ou corrida divergente.
- Autorização: token é owner de dívida e conta.
- Idempotência: natural por `installmentId`; mesma intenção converge, divergente nunca cria segunda saída.

## 15. Interface

As rotas `/debts` e `/debts/:id` são protegidas e redirecionam sessão inválida ao login sem exibir dados. `/debts` oferece estado vazio, cadastro, filtros, resumo e archive/restore. O formulário mostra tipo/origem, credor, descrição/notas, principal, data inicial e editor explícito do cronograma. Somente `LOAN` exige bloco de funding com conta, valor integral e data; os outros tipos explicam que o cadastro não movimenta caixa.

O detalhe mostra status, saldo devedor, principal pago/pendente, juros/tarifas pagos e pendentes, total futuro, próxima parcela, atraso derivado e histórico de funding/pagamentos. Cada parcela pendente oferece pagamento integral com conta/data. A UI explica: “principal pago reduz a dívida e o saldo da conta, mas não é nova despesa; juros e tarifas pagos são custo financeiro”. Em financiamento, informa que nenhum ativo ou despesa do bem é reconhecido automaticamente.

Estados obrigatórios: loading sem conteúdo enganoso; vazio; validação por campo e resumo; sucesso; `PAID_OFF`; arquivada; API indisponível distinta de vazio; retry seguro; bloqueios de edição explicados. Layout móvel e desktop não exige rolagem horizontal para ações primárias, preserva foco, rótulos, contraste e alvos de toque. A UI não faz cálculo financeiro autoritativo nem antecipa sucesso.

## 16. Validações

| Campo ou ação | Validação | Mensagem/resultado esperado |
|---|---|---|
| `type` | Enum fechado | `400` para valor desconhecido |
| `creditorName`, `description` | String, `trim`, não vazia, limites explícitos no DTO futuro | Erro por campo; valor normalizado |
| `notes` | String opcional; vazia vira nulo | Erro seguro se exceder limite |
| Dinheiro | String canônica, duas casas, faixa `Decimal(19,2)` | Sem coerção/arredondamento |
| `originalPrincipal` | Maior que zero | `400` se forma; `422` se regra agregada |
| `installmentCount` | Inteiro 1..600 e igual ao tamanho do cronograma | `422` sem persistência |
| `installmentNumber` | Sequência única e completa 1..N | `422` sem lacuna/duplicidade |
| `dueDate` | Data civil válida, crescente e >= `startDate` | `400` por forma; `422` por ordem |
| Componentes | Principal > 0; juros/tarifa >= 0 | `422`; total exato derivado |
| Soma dos principais | Igual ao principal original | `422`, sem ajuste automático |
| Funding | Obrigatório e integral só em `LOAN` | `422` para ausência/excesso/incompatibilidade |
| Conta | UUID existente, própria e ativa na decisão transacional | `404` alheia/ausente; `422` arquivada |
| Pay | Parcela `PENDING`; corpo sem valor | Integral derivado ou erro sem efeito |
| Edição | Estrutural somente antes de pagamentos | `422` ou `409` em corrida |
| Archive | Somente `PAID_OFF` | `422` para `ACTIVE` |
| Campos extras | Rejeitados | `400`; impede mass assignment |

Limites textuais exatos serão os já padronizados na implementação vigente; se não houver padrão aprovado, a unidade de implementação deverá propor revisão desta SPEC antes de escolher limites que alterem contrato.

## 17. Permissões

| Ação | Ator autorizado | Condição | Comportamento quando negado |
|---|---|---|---|
| Criar dívida | Usuário autenticado | Funding, se houver, usa conta própria ativa | `401`, `404` ou `422` |
| Listar/consultar | Usuário autenticado | Recurso próprio; arquivado consultável | Lista isolada ou `404` |
| Editar | Usuário autenticado owner | Estado/campos compatíveis e não arquivada | `404`, `422` ou `409` |
| Pagar | Usuário autenticado owner | Parcela pendente, dívida não arquivada, conta própria ativa | `404`, `422` ou `409` |
| Arquivar/restaurar | Usuário autenticado owner | Archive somente quitada | `404` ou `422` |
| Operar recurso alheio | Ninguém | Nunca | `404` indistinguível |

## 18. Segurança e privacidade

- Dados pessoais/financeiros: credor, descrição, notas, valores, contas, datas, dívida e pagamentos.
- Ameaças: IDOR, mass assignment, enumeração, injeção, funding/pagamento duplicado, corrida com archive, vazamento em logs e adulteração de componentes.
- Proteções: autenticação obrigatória da `SPEC-002`; `userId` exclusivo do token; owner verificado no backend em toda relação; DTO explícito; `whitelist` e `forbidNonWhitelisted`; consultas sempre por owner; transação, unique e locks; validação decimal/data; FKs `RESTRICT`.
- Ausente e alheio são `404` indistinguíveis. Recurso próprio arquivado/incompatível é `422` quando a regra de domínio se aplica.
- Logs, métricas, traces, screenshots e fixtures não contêm payload completo, nomes de credores, notas, valores financeiros reais, tokens, cookies ou identificadores pessoais. Usar IDs de correlação e dados fictícios sanitizados.
- Auth, CSRF, CORS e CI permanecem intactos; esta SPEC não reduz proteções existentes nem reativa CI.

## 19. Erros e estados vazios

| Situação | Estado apresentado | Recuperação esperada |
|---|---|---|
| Sem dívida | Vazio orientativo, não erro | Criar primeira dívida |
| Filtro sem resultado | Vazio contextual | Limpar/alterar filtros |
| Sem parcela pendente | Quitada, ações de pay ocultas | Arquivar ou consultar histórico |
| Validação | Campos e resumo, sem perder entrada segura | Corrigir e reenviar |
| Conflito/idempotência divergente | Estado atual recarregado e mensagem clara | Revisar pagamento existente |
| Conta arquivada | Conta indisponível | Escolher conta ativa |
| API indisponível | Erro distinto de vazio; sem sucesso otimista | Tentar novamente |
| Sessão inválida | Nenhum conteúdo financeiro | Redirecionar ao login |

## 20. Observabilidade

Eventos estruturados futuros: `debt.created`, `debt.updated`, `debt.archived`, `debt.restored`, `debt_installment.paid`, `debt.paid_off`, `debt.conflict` e falha de validação por código agregado. Registrar timestamp, correlation ID, nome do evento, resultado, latência e IDs internos minimizados; nunca payload, credor, notas, valores, conta, token ou cookie.

Métricas: contagem/latência/erro por operação e código; conflitos de unique/retry; rollbacks atômicos; sem labels de alta cardinalidade ou financeiras. Alertar sobre crescimento anormal de 5xx, rollbacks ou conflitos, não sobre comportamento financeiro individual. Auditoria funcional adicional não é nova entidade nesta SPEC; funding e pagamento já são registros imutáveis.

## 21. Migração e compatibilidade

- Dados existentes: não há conversão ou backfill; domínios anteriores permanecem intactos.
- Compatibilidade: fórmulas de saldo/agregação serão estendidas aditivamente com funding, pagamento e custo financeiro, sem reinterpretar lançamentos, transferências ou cartões.
- Migration necessária: sim, somente na implementação futura, nova e aditiva com quatro modelos, enums, FKs, checks, índices e uniques descritos.
- Implantação gradual: API/banco antes da web quando a unidade futura definir estratégia; não há scheduler, seed ou feature flag obrigatória nesta SPEC.
- CI permanece desativado por decisão externa e não será alterado nesta unidade.

## 22. Critérios de aceite

### `CA-01 — Criar empréstimo com funding`
**Dado** contrato `LOAN`, cronograma válido e conta própria ativa **Quando** cria **Então** dívida, parcelas e funding integral são persistidos atomicamente.

### `CA-02 — Empréstimo exige funding`
**Dado** tipo `LOAN` sem funding **Quando** cria **Então** recebe `422` sem dívida parcial.

### `CA-03 — Funding integral`
**Dado** principal `10000.00` e funding diferente **Quando** cria **Então** recebe `422` sem crédito na conta.

### `CA-04 — Financiamento sem funding`
**Dado** `FINANCING` e cronograma válido sem entrada de caixa **Quando** cria **Então** dívida nasce ativa e nenhuma conta muda.

### `CA-05 — Dívida negociada sem funding`
**Dado** `NEGOTIATED_DEBT` válido **Quando** cria **Então** não há funding, receita, despesa ou ativo automático.

### `CA-06 — Outro tipo sem funding`
**Dado** `OTHER` válido **Quando** cria **Então** acompanha obrigação sem movimentar caixa.

### `CA-07 — Funding proibido fora de LOAN`
**Dado** financiamento com bloco funding **Quando** envia **Então** recebe `422` sem mutação.

### `CA-08 — Enum fechado`
**Dado** tipo não enumerado **Quando** envia **Então** recebe `400` e não cria dívida.

### `CA-09 — Funding aumenta saldo`
**Dado** saldo realizado `500.00` **Quando** funding `10000.00` conclui **Então** saldo passa a `10500.00`, mantidos os demais termos.

### `CA-10 — Funding não é receita`
**Dado** funding concluído **Quando** agrega receitas **Então** o valor não aparece e nenhum `FinancialTransaction INCOME` existe.

### `CA-11 — Funding único`
**Dado** dívida com funding **Quando** há tentativa concorrente de segundo funding **Então** existe somente um crédito e um registro.

### `CA-12 — Conta de funding alheia`
**Dado** `accountId` de outro usuário **Quando** cria `LOAN` **Então** recebe `404` indistinguível e nada persiste.

### `CA-13 — Conta de funding arquivada`
**Dado** conta própria arquivada **Quando** cria `LOAN` **Então** recebe `422` sem dívida/funding/parcelas.

### `CA-14 — Arquivamento da conta versus funding`
**Dado** archive da conta e criação do empréstimo concorrentes **Quando** serializam **Então** o funding conclui antes do archive ou toda criação falha.

### `CA-15 — Cronograma explícito`
**Dado** N parcelas válidas numeradas de 1 a N **Quando** cria **Então** todas e somente elas ficam `PENDING`.

### `CA-16 — Quantidade divergente`
**Dado** `installmentCount=3` e dois itens **Quando** cria **Então** recebe `422` sem persistência.

### `CA-17 — Numeração com lacuna ou duplicidade`
**Dado** números que não formam `1..N` **Quando** cria **Então** recebe `422`.

### `CA-18 — Limite de parcelas`
**Dado** quantidade zero ou acima de 600 **Quando** cria **Então** recebe `422`; 1 e 600 são aceitos com cronograma válido.

### `CA-19 — Vencimentos crescentes`
**Dado** datas iguais, decrescentes ou anteriores ao início **Quando** cria **Então** recebe `422` sem reordenar silenciosamente.

### `CA-20 — Soma exata do principal`
**Dado** principal `1000.00` e parcelas de principal `600.00` e `400.00` **Quando** cria **Então** aceita soma exata.

### `CA-21 — Soma divergente`
**Dado** soma `999.99` para principal `1000.00` **Quando** cria **Então** recebe `422` sem ajustar centavo.

### `CA-22 — Principal positivo`
**Dado** principal original ou de parcela zero/negativo **Quando** envia **Então** rejeita sem coerção.

### `CA-23 — Juros e tarifa não negativos`
**Dado** juros/tarifa zero ou positivo **Quando** valida **Então** aceita; componente negativo é rejeitado.

### `CA-24 — Total da parcela derivado`
**Dado** principal `90.00`, juros `8.00` e tarifa `2.00` **Quando** consulta **Então** total é `100.00` e não editável separadamente.

### `CA-25 — Decimal em string`
**Dado** dinheiro como número JSON, exponencial, vírgula ou três casas **Quando** envia **Então** recebe `400` sem arredondamento.

### `CA-26 — Preservação decimal`
**Dado** componentes válidos no limite **Quando** persistem e retornam **Então** mantêm exatamente duas casas e o mesmo valor.

### `CA-27 — Data civil`
**Dado** data inexistente ou com horário/fuso **Quando** envia **Então** recebe `400`; data `YYYY-MM-DD` válida não muda por timezone.

### `CA-28 — Dívida inicia ativa`
**Dado** criação válida **Quando** conclui **Então** status é `ACTIVE`, parcelas são `PENDING` e `archivedAt` é nulo.

### `CA-29 — Atraso derivado`
**Dado** parcela pendente com vencimento anterior a hoje **Quando** projeta **Então** mostra `OVERDUE` sem persistir esse estado.

### `CA-30 — Hoje e futuro não atrasados`
**Dado** parcela pendente vencendo hoje ou depois **Quando** projeta **Então** mostra `PENDING`, sem multa automática.

### `CA-31 — Parcela paga não atrasada`
**Dado** parcela `PAID` com vencimento antigo **Quando** projeta **Então** mostra `PAID`, não `OVERDUE`.

### `CA-32 — Próxima parcela`
**Dado** múltiplas pendentes **Quando** consulta **Então** próxima é a de menor vencimento/número; quitada retorna nulo.

### `CA-33 — Saldo devedor derivado`
**Dado** principal `1000.00` e pagamentos efetivos com principal total `400.00` **Quando** consulta **Então** outstanding é `600.00` sem campo independente.

### `CA-34 — Pagar integralmente`
**Dado** parcela pendente e conta própria ativa **Quando** envia conta/data **Então** servidor copia todos os componentes, cria um pagamento e marca `PAID` atomicamente.

### `CA-35 — Valor proibido no pay`
**Dado** pay contendo amount ou componentes **Quando** envia **Então** recebe `400` por campo extra.

### `CA-36 — Pagamento reduz saldo`
**Dado** saldo `500.00` e parcela total `120.00` **Quando** paga **Então** saldo realizado passa a `380.00` uma vez.

### `CA-37 — Principal reduz obrigação`
**Dado** parcela paga com principal `100.00` **Quando** deriva dívida **Então** saldo devedor reduz `100.00` exatamente uma vez.

### `CA-38 — Principal não é despesa`
**Dado** pagamento com principal `100.00` **Quando** agrega despesas **Então** principal não aumenta o total e não há `FinancialTransaction EXPENSE` artificial.

### `CA-39 — Juros e tarifa são despesa única`
**Dado** pagamento com juros `8.00` e tarifa `2.00` **Quando** agrega despesas financeiras **Então** soma `10.00` uma vez, diretamente do pagamento.

### `CA-40 — Sem transferência artificial`
**Dado** funding e pagamento concluídos **Quando** consulta persistência **Então** nenhum `FinancialTransfer` foi criado para representá-los.

### `CA-41 — Pagamento antecipado ou atrasado`
**Dado** parcela pendente **Quando** paga antes, no dia ou após vencimento **Então** aceita data civil válida sem juros/multa inferidos.

### `CA-42 — Conta pagadora alheia`
**Dado** conta de outro usuário **Quando** paga **Então** recebe `404` e parcela permanece pendente.

### `CA-43 — Conta pagadora arquivada`
**Dado** conta própria arquivada **Quando** paga **Então** recebe `422` sem pagamento/saída/amortização.

### `CA-44 — Retry idempotente`
**Dado** pagamento concluído **Quando** repete mesma conta/data **Então** recebe `200` com registro existente sem nova saída.

### `CA-45 — Retry divergente`
**Dado** parcela paga **Quando** repete com conta ou data diferente **Então** recebe `409` sem segundo pagamento.

### `CA-46 — Pay concorrente`
**Dado** dois pays simultâneos da mesma parcela **Quando** concluem **Então** há um pagamento, uma saída e um abatimento de principal.

### `CA-47 — Última parcela quita`
**Dado** somente uma parcela pendente **Quando** seu pagamento conclui **Então** parcela fica `PAID` e dívida `PAID_OFF` na mesma transação.

### `CA-48 — Quitação concorrente`
**Dado** pagamentos simultâneos das últimas parcelas distintas **Quando** concluem **Então** dívida fica `PAID_OFF` exatamente quando todas estão pagas.

### `CA-49 — Sem reabertura ou estorno`
**Dado** parcela paga ou dívida quitada **Quando** procura transição inversa **Então** não existe contrato e histórico fica imutável.

### `CA-50 — Edição estrutural antes do pagamento`
**Dado** dívida sem pagamentos **Quando** substitui contrato por agregado válido **Então** cronograma/funding e saldo são ajustados atomicamente.

### `CA-51 — Edição textual após pagamento`
**Dado** dívida com pagamento **Quando** edita credor, descrição ou notas **Então** altera somente esses textos.

### `CA-52 — Edição estrutural após pagamento`
**Dado** ao menos um pagamento **Quando** tenta mudar principal, tipo, funding, parcela, valor ou data **Então** recebe `422` sem reescrever histórico.

### `CA-53 — PATCH misto inválido`
**Dado** dívida paga em parte e PATCH com texto e campo estrutural **Quando** envia **Então** tudo falha, inclusive o texto.

### `CA-54 — Edição versus pay`
**Dado** edição estrutural e pay concorrentes **Quando** serializam **Então** edição conclui antes do pay ou falha integralmente.

### `CA-55 — Arquivar quitada`
**Dado** dívida `PAID_OFF` **Quando** arquiva duas vezes **Então** fica arquivada sem apagar funding, parcelas ou pagamentos.

### `CA-56 — Bloquear archive ativo`
**Dado** dívida `ACTIVE` com saldo pendente **Quando** arquiva **Então** recebe `422` sem ocultar obrigação.

### `CA-57 — Restaurar sem reabrir`
**Dado** dívida quitada arquivada **Quando** restaura duas vezes **Então** fica visível e `PAID_OFF`, sem parcela pendente.

### `CA-58 — Archive versus pay`
**Dado** archive e pay concorrentes **Quando** serializam **Então** archive falha enquanto ativa ou ocorre somente após quitação completa, sem operação parcial.

### `CA-59 — Archive da conta versus pay`
**Dado** archive da conta e pay concorrentes **Quando** serializam **Então** pay conclui antes do archive ou falha sem saída.

### `CA-60 — Recurso alheio indistinguível`
**Dado** ID de dívida/parcela/conta de outro usuário **Quando** consulta ou muta **Então** recebe o mesmo `404` de recurso ausente.

### `CA-61 — Sem autenticação`
**Dado** token ausente ou inválido **Quando** acessa qualquer rota de dívida **Então** recebe `401` sem leitura/mutação.

### `CA-62 — Mass assignment`
**Dado** payload com `userId`, status, timestamps ou campo extra **Quando** envia **Então** recebe `400` e owner permanece vindo do token.

### `CA-63 — Paginação opaca`
**Dado** mais dívidas que o limite **Quando** percorre cursores com filtros estáveis **Então** recebe cada item próprio uma vez, em ordem estável.

### `CA-64 — Cursor ou filtros incompatíveis`
**Dado** cursor malformado ou reutilizado com filtro diferente **Quando** lista **Então** recebe `400` sem dados indevidos.

### `CA-65 — Filtros`
**Dado** dívidas de tipos, status, archive e vencimentos distintos **Quando** combina filtros **Então** recebe apenas recursos próprios correspondentes.

### `CA-66 — Sem DELETE`
**Dado** qualquer entidade do agregado **Quando** procura rota de exclusão **Então** não existe contrato DELETE.

### `CA-67 — Estado vazio web`
**Dado** usuário sem dívida **Quando** abre `/debts` **Então** vê orientação e ação de cadastro, não erro.

### `CA-68 — Cadastro web responsivo`
**Dado** viewport móvel ou desktop **Quando** informa tipo, funding aplicável e cronograma **Então** conclui sem rolagem horizontal obrigatória e com validação acessível.

### `CA-69 — Detalhe e explicação econômica`
**Dado** dívida com pagamentos **Quando** abre `/debts/:id` **Então** vê obrigação/custos/histórico e explicação de que principal não é despesa e juros/tarifas são custo.

### `CA-70 — Web paga e quita`
**Dado** parcela pendente e conta ativa **Quando** paga pela web **Então** mostra loading, resultado único, novo saldo devedor e `PAID_OFF` quando aplicável.

### `CA-71 — API indisponível`
**Dado** falha de API **Quando** lista ou envia formulário **Então** web distingue erro de vazio, não simula sucesso e oferece retry seguro.

### `CA-72 — Redirecionamento web`
**Dado** sessão inválida **Quando** abre rota protegida **Então** redireciona ao login sem conteúdo financeiro.

### `CA-73 — Financiamento não reconhece bem`
**Dado** financiamento cadastrado **Quando** consulta agregações **Então** nenhum ativo ou despesa de principal foi criado automaticamente e a limitação é explicada.

### `CA-74 — Fluxo E2E sem dupla contagem`
**Dado** usuário logado com conta **Quando** cria `LOAN` com funding, paga parcelas com juros, quita e sai **Então** saldo recebe funding e pagamentos uma vez, receita não aumenta, principal não vira despesa e apenas juros/tarifas aumentam custo.

## 23. Testes obrigatórios

| Nível | Cenários mínimos | Critérios relacionados | Evidência esperada |
|---|---|---|---|
| Unitário | Decimal exato, soma de principal, total, funding fora de receita, fórmulas de saldo/obrigação/despesa, overdue, próxima parcela, estados, idempotência e bloqueio de edição | CA-03, CA-09 a CA-11, CA-15 a CA-39, CA-44 a CA-54 | Execução determinística aprovada, com relógio e dinheiro exatos |
| Integração PostgreSQL | Migration/FKs/checks/uniques/índices, owner, funding único, pagamento único, corridas, última parcela, archives de dívida/conta, edição x pay, saldos e ausência de dupla contagem; migrations anteriores intactas | CA-01 a CA-14, CA-20 a CA-26, CA-33 a CA-66 | Banco real isolado; constraints, transações e concorrência aprovadas |
| Contrato | DTOs, strings decimais, datas, contratos HTTP, filtros/cursor, códigos 400/401/404/409/422, campos extras, ausência de `userId`, DELETE e endpoint de funding | CA-01 a CA-08, CA-25 a CA-27, CA-34 a CA-66 | Testes da fronteira HTTP aprovados |
| Web | Vazio, cadastro, cronograma, funding, detalhe, overdue, pay, quitação, edição, archive/restore, indisponibilidade, redirect e responsividade | CA-67 a CA-73 | Testes de componente/integração e evidência visual sanitizada |
| E2E | Login, conta, `LOAN` com funding, saldo sem receita, parcelas, amortização, juros/tarifas únicos, quitação e logout | CA-74 | Fluxo crítico automatizado com dados fictícios |
| Aceitação manual | Clareza de origem, cronograma, obrigação versus custo, bloqueios, acessibilidade e móvel/desktop | CA-04 a CA-10, CA-67 a CA-74 | Checklist e capturas sanitizadas; exigido na implementação futura |

Dados de teste serão inteiramente fictícios. A implementação futura executará lint, typecheck, unitários, integração PostgreSQL, contrato, web/E2E e build conforme comandos então existentes. Nesta entrega somente documental, testes de produto e screenshot não são aplicáveis; verificações documentais e de escopo são obrigatórias.

## 24. Arquivos permitidos

Nesta unidade de criação da SPEC:

- `docs/specs/SPEC-009-DIVIDAS-E-FINANCIAMENTOS.md`

Uma implementação futura exige unidade/branch própria e escopo de arquivos explicitamente autorizado.

## 25. Arquivos proibidos

- Todo arquivo diferente de `docs/specs/SPEC-009-DIVIDAS-E-FINANCIAMENTOS.md` nesta unidade.
- Código, Prisma/schema, migrations, dependências, endpoints, telas, seed, autenticação, CSRF, CORS e CI.
- SPECs anteriores, documentos de produto/processo/qualidade e ADRs.

## 26. Dependências

| Dependência | Motivo | Estado da aprovação | Impacto |
|---|---|---|---|
| `SPEC-002` a `SPEC-008` | Reutilizar autenticação, contas e fórmulas dos domínios existentes | Aprovadas/existentes | Contratos futuros permanecem compatíveis |
| `ADR-001` a `ADR-006` | Arquitetura, cliente, backend, persistência, organização e testes | Aprovadas/existentes | Orientam implementação futura |
| PostgreSQL/Prisma já adotados | Persistência futura e invariantes | Existente; sem nova dependência | Migration aditiva futura |
| Nova dependência | Não aplicável | Não requerida | Nenhuma dependência adicionada |

## 27. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Funding contado como receita | Alta | Renda e saldo incoerentes | Fonte própria, fórmulas e testes negativos |
| Principal contado como despesa | Alta | Despesa duplicada | Agregar só juros/tarifas de pagamento |
| Pagamento/funding duplicado | Alta | Caixa e obrigação incorretos | Unique, transação, locks e retries |
| Soma/centavos divergentes | Alta | Saldo devedor residual | Decimal exato e soma contratual obrigatória |
| Edição reescrever histórico | Alta | Perda de auditabilidade | Bloqueio estrutural após primeiro pagamento |
| Corrida com archive de conta/dívida | Média | Registro sem efeito ou saída indevida | Validação transacional e serialização |
| Funding integral insuficiente para casos reais | Média | Empréstimo em tranches não representável | Limite explícito; futura SPEC para liberações múltiplas |
| Pagamento parcial/renegociação futura | Alta | Modelo atual insuficiente | Não antecipar; evolução aditiva e novo contrato |
| Financiamento sem ativo/despesa original | Alta | Visão patrimonial incompleta | Limitação visível e sem reconhecimento artificial |
| Custos sem categoria detalhada | Média | Relatório menos granular | Agregação financeira direta e evolução futura sem duplicação |
| Agregações em histórico longo | Média | Latência | Índices/cursor e análise de plano na implementação |
| Dados sensíveis em observabilidade | Média | Incidente de privacidade | Logs mínimos e evidências fictícias/sanitizadas |

Riscos residuais: a versão não representa saldo oficial conciliado externo, renegociação, tranche, pagamento parcial, estorno, bem financiado ou juros variáveis. Esses casos não devem ser improvisados sobre os quatro modelos; exigem nova SPEC e migração aditiva. Saldo negativo da conta continua possível conforme o domínio de contas e não é tratado como aconselhamento ou crédito regulado.

## 28. Rollback

Nesta unidade documental, rollback é `git revert <hash-do-commit>` do único arquivo criado; não há efeito em dados, runtime ou migrations. Na implementação futura, rollback deve primeiro retirar rotas/telas sem apagar dados; migration aditiva não será revertida de forma destrutiva e registros financeiros serão preservados. O plano exato será definido naquela unidade.

## 29. Dúvidas

| ID | Dúvida | Impacto | Responsável | Estado |
|---|---|---|---|---|
| `D-01` | Funding é opcional por tipo? | Saldo e origem | Solicitante/SPEC | Resolvida: obrigatório e integral somente em `LOAN`; proibido nos demais |
| `D-02` | Cronograma pode ser inferido? | Precisão e UX | Solicitante/SPEC | Resolvida: não; cronograma sempre explícito |
| `D-03` | Pagamento parcial é permitido? | Modelo e saldo | Solicitante | Resolvida: somente integral por parcela |
| `D-04` | Principal pago é despesa? | Dupla contagem | Solicitante | Resolvida: não; é redução de passivo |
| `D-05` | Como reconhecer juros/tarifas? | Agregação | Solicitante/SPEC | Resolvida: diretamente do pagamento, uma vez, sem lançamento artificial |
| `D-06` | Há archive de dívida ativa? | Visibilidade da obrigação | Solicitante | Resolvida: não; apenas `PAID_OFF` |
| `D-07` | Qual paginação usar? | Contrato/listagem | SPEC aprovada | Resolvida: cursor opaco `(createdAt,id)`, limit 1..100/padrão 20 |
| `D-08` | Como tratar funding em tranches ou outro tipo com caixa? | Escopo | SPEC aprovada | Resolvida: fora do escopo; entrada real usa `LOAN` integral nesta versão |

Nenhuma dúvida de comportamento, escopo, dados, segurança, API, concorrência ou dependência permanece aberta.

## 30. Decisões aprovadas

| Data | Decisão | Responsável pela aprovação | Consequência |
|---|---|---|---|
| `2026-08-07` | Entidades finais são `FinancialDebt`, `DebtFunding`, `DebtInstallment` e `DebtPayment` | Solicitante | Fontes contratuais e efetivas separadas |
| `2026-08-07` | Enum fechado: `LOAN`, `FINANCING`, `NEGOTIATED_DEBT`, `OTHER` | Solicitante | Origem validável sem tipo livre |
| `2026-08-07` | Funding único, integral e obrigatório só para `LOAN`, criado com a dívida | Solicitante/SPEC | Uma entrada auditável e atômica, sem endpoint próprio |
| `2026-08-07` | Funding aumenta saldo e nunca receita | Solicitante | Impede renda artificial |
| `2026-08-07` | Cronograma é sempre explícito, sem SAC/PRICE ou atalho | Solicitante/SPEC | Componentes e centavos não ficam escondidos |
| `2026-08-07` | Soma dos principais deve igualar exatamente o principal original | Solicitante | Saldo devedor pode ser derivado sem resíduo |
| `2026-08-07` | Pagamento é somente integral, único e derivado pelo servidor | Solicitante | Um evento e uma saída por parcela |
| `2026-08-07` | Principal reduz passivo, não despesa; juros/tarifas pagos são despesa direta uma vez | Solicitante | Evita dupla contagem sem lançamento artificial |
| `2026-08-07` | Estados persistidos são dívida `ACTIVE/PAID_OFF` e parcela `PENDING/PAID`; atraso é derivado | Solicitante | Sem estado redundante ou multa implícita |
| `2026-08-07` | Primeiro pagamento bloqueia toda edição estrutural | Solicitante | Histórico não é reescrito |
| `2026-08-07` | Só `PAID_OFF` arquiva; restore não reabre; não há DELETE | Solicitante | Obrigação ativa permanece visível |
| `2026-08-07` | Paginação usa cursor opaco estável, limite padrão 20/máximo 100 | SPEC aprovada pela tarefa | Listagem determinística e escalável |
| `2026-08-07` | Contratos HTTP são exatamente as sete rotas da seção 14 | Solicitante | Sem endpoint redundante de funding/exclusão |
| `2026-08-07` | Uniques, transações e serialização garantem funding/pay/saída/amortização únicos | Solicitante | Retries e corridas não geram efeitos parciais |
| `2026-08-07` | Financiamento não reconhece ativo nem despesa original automaticamente | Solicitante | Limitação do MVP explícita |

## 31. Definition of Done específica

Para esta entrega documental:

- [x] SPEC criada com status `Aprovada` no único arquivo autorizado.
- [x] Entidades, tipos, funding, cronograma, pagamento, dinheiro, efeitos, derivações, estados, edição e archive definidos.
- [x] Segurança, concorrência, persistência, contratos HTTP, paginação e web futuros definidos.
- [x] Pelo menos 55 critérios Dado/Quando/Então definidos (74 cenários).
- [x] Riscos, limitações e testes futuros em todos os níveis aplicáveis documentados.
- [x] Nenhuma dependência, código, Prisma, migration, endpoint, tela, seed ou CI alterado.
- [x] Todas as decisões obrigatórias registradas e nenhuma dúvida aberta.
- [x] Verificações documentais e de escopo previstas para a entrega.
- [ ] Implementação, testes de produto e evidências visuais: não aplicáveis a esta unidade; obrigatórios somente na implementação futura.

## 32. Histórico de alterações da SPEC

| Data | Alteração | Motivo | Autor | Aprovador, quando aplicável |
|---|---|---|---|---|
| `2026-08-07` | Criação da SPEC-009 com status Aprovada | Definir dívidas e financiamentos antes da implementação | Equipe Planner Fin | Solicitante da tarefa |
