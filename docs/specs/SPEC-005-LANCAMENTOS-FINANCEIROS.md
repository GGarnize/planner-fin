# SPEC de funcionalidade — `SPEC-005 — Lançamentos financeiros básicos`

## 1. Identificação

| Campo | Valor |
|---|---|
| ID | `SPEC-005` |
| Título | Lançamentos financeiros básicos |
| Responsável | Codex Cloud |
| Data de criação | `2026-08-07` |
| Última atualização | `2026-08-07` |
| Tarefa relacionada | `PROMPT-SPEC-005-LANCAMENTOS-FINANCEIROS.md` |
| Documentos relacionados | SPEC-002, SPEC-003, SPEC-004, ADR-001 a ADR-006, visão, escopo, princípios, modelo TO-BE e glossário do produto |

## 2. Status

`Aprovada`

**Aprovada por:** tarefa `PROMPT-SPEC-005-LANCAMENTOS-FINANCEIROS.md`, em `2026-08-07`.

## 3. Contexto

Autenticação e isolamento por usuário, contas com saldo inicial e categorias de receita ou despesa já possuem contratos aprovados. O próximo núcleo do produto precisa registrar receitas e despesas, distinguindo previsão de realização, sem confundir saldo inicial, transferência ou recorrência com lançamento financeiro.

Esta SPEC detalha somente o comportamento futuro. A persistência seguirá PostgreSQL e Prisma, os contratos HTTP seguirão o monólito NestJS e a interface seguirá a aplicação Vue/Quasar, conforme ADRs aprovadas. Transferências e recorrências dependerão de SPECs próprias.

## 4. Problema

O usuário ainda não possui um registro explícito e isolado de receitas e despesas previstas ou realizadas. Sem um contrato único para valores, datas, estados, propriedade, transições e efeito no saldo, implementações independentes poderiam arredondar centavos, deslocar datas civis, expor recursos alheios, aceitar combinações incoerentes ou contar previsões no saldo realizado.

## 5. Objetivo

Definir contratos verificáveis de dados, API, web, segurança e testes para criar, consultar, listar, editar, pagar e reabrir lançamentos `INCOME` e `EXPENSE`, preservando precisão decimal, isolamento por usuário e derivação exata do saldo realizado.

## 6. Fora do escopo

- Transferências, recorrências, parcelamento, cartões e faturas.
- Dívidas, orçamento, estorno, pagamento parcial e cancelamento.
- Estado persistido `CANCELLED`, `PARTIALLY_PAID`, `REVERSED`, `SCHEDULED` ou `OVERDUE`.
- Exclusão física, `DELETE` ou arquivamento de lançamentos.
- Anexos, importação, inteligência artificial e multimoeda.
- Aplicativos Android/iOS e deploy.
- Alterações de autenticação, contas, categorias, ADRs, SPECs anteriores ou workflow de CI.
- Implementação de código, Prisma, migration, dependência, endpoint ou tela nesta tarefa documental.

## 7. Termos

| Termo | Definição adotada nesta SPEC |
|---|---|
| Lançamento | Receita ou despesa pertencente a uma conta, categoria e usuário. |
| Previsto | `plannedAmount`, valor obrigatório planejado, sem efeito no saldo realizado. |
| Realizado | `actualAmount`, valor efetivo de um lançamento `PAID`. |
| Pendente | Estado `PENDING`; ainda não realizado. |
| Pago | Estado `PAID`; realizado, inclusive quando a natureza é receita. |
| Vencido | Condição derivada quando `status=PENDING` e `dueDate` é anterior à data civil atual; não é persistida. |
| Data civil | Data gregoriana `YYYY-MM-DD`, sem horário nem conversão de fuso. |
| Saldo realizado | `openingBalance` mais receitas pagas menos despesas pagas da conta. |
| Owner | Usuário autenticado, sempre derivado do token. |

## 8. Comportamento atual

SPEC-002 fornece autenticação e isolamento. SPEC-003 fornece contas e `openingBalance`; esse valor não é receita nem despesa. SPEC-004 fornece categorias tipadas e arquiváveis. Não existe `FinancialTransaction`, API ou tela de lançamentos confirmada no comportamento atual.

## 9. Comportamento desejado

### 9.1 Natureza, estado e coerência

- `type` é enum fechado `INCOME | EXPENSE`; `TRANSFER` é rejeitado.
- `status` é enum fechado `PENDING | PAID`.
- Categoria `INCOME` aceita somente lançamento `INCOME`; categoria `EXPENSE`, somente `EXPENSE`.
- `PENDING` exige `actualAmount=null` e `paidAt=null`.
- `PAID` exige `actualAmount>0` e `paidAt` presente.
- “Vencido” é calculado no servidor e na interface usando uma data civil atual controlável em testes. `dueDate` igual a hoje não está vencida.

### 9.2 Valores e datas

- `plannedAmount` é obrigatório e `actualAmount`, quando exigido, também. Ambos usam magnitude positiva entre `0.01` e `99999999999999999.99`.
- Requests aceitam somente string decimal sem sinal, expoente ou separador de milhar, com um a 17 algarismos inteiros e uma ou duas casas (`^(?:0|[1-9][0-9]{0,16})\\.[0-9]{1,2}$`); zero, excesso de escala ou precisão e números JSON são rejeitados.
- Respostas sempre usam string com exatamente duas casas. Persistência usa `Decimal(19,2)`; nenhuma camada usa `float`/`double`, coerção aproximada ou arredondamento silencioso.
- `dueDate` e `paidAt` são datas gregorianas existentes, no formato estrito `YYYY-MM-DD`, persistidas como `Date`/`@db.Date` e devolvidas sem deslocamento de fuso.

### 9.3 Texto

- `description` é string obrigatória, recebe trim, deve conter de 1 a 200 pontos de código e não aceita controles nem quebras de linha.
- `notes` é opcional: omissão ou `null` resulta em `null`; string recebe trim, aceita 0 a 2.000 pontos de código, sem controles, e string vazia após trim normaliza para `null`. Quebras de linha são permitidas como texto simples.
- Nenhum campo aceita HTML executável; clientes renderizam ambos como texto, nunca como marcação.

### 9.4 Relações e ciclo de vida

- Cada lançamento pertence exatamente a uma conta e categoria ativas do mesmo owner no momento da criação.
- `accountId` e `categoryId` vêm do cliente, mas são resolvidos com o owner. `userId` nunca é aceito.
- Conta ou categoria arquivada não recebe lançamento novo nem pode ser selecionada em edição. Arquivamento posterior preserva consulta e histórico do lançamento.
- Não há exclusão ou arquivamento do lançamento nesta versão.

### 9.5 Transições e edição

- Criação aceita `PENDING` ou `PAID`, obedecendo à coerência de valores e datas.
- `POST /api/transactions/:id/pay` realiza somente a transição `PENDING -> PAID` e exige `actualAmount` e `paidAt`.
- Repetir `pay` em um `PAID` com os mesmos valores canônicos retorna `200` sem alterar `updatedAt`; valores diferentes retornam `409 TRANSACTION_ALREADY_PAID`. Assim, retentativa idêntica é idempotente e não sobrescreve efeito financeiro.
- `POST /api/transactions/:id/reopen` realiza `PAID -> PENDING`, limpando atomicamente `actualAmount` e `paidAt`. Repeti-lo em `PENDING` retorna `200` sem alterar `updatedAt`.
- `description` e `notes` são editáveis em ambos os estados. `plannedAmount`, `dueDate`, `accountId`, `categoryId` e `type` são editáveis somente em `PENDING`, com nova validação integral de owner, atividade e compatibilidade.
- `actualAmount`, `paidAt`, `status` e campos internos são proibidos no PATCH. Em `PAID`, qualquer campo de efeito financeiro exige `reopen` primeiro.
- Pay, reopen e PATCH usam operação atômica/condicional para que concorrência não duplique ou perca transições.

### 9.6 Efeito no saldo

- `PENDING` não afeta saldo realizado. `PAID INCOME` soma `actualAmount`; `PAID EXPENSE` subtrai `actualAmount`.
- Para cada conta, `saldoAtual = openingBalance + soma(actualAmount de PAID INCOME) - soma(actualAmount de PAID EXPENSE)`.
- Pagar inclui o efeito uma única vez; reabrir o remove uma única vez. Diferença entre planejado e realizado nunca afeta o saldo além do `actualAmount`.
- Não persistir `currentBalance`, cache ou materialização nesta unidade. O saldo inicial permanece posição inicial, não lançamento.

## 10. Personas ou atores

| Ator | Necessidade | Ações autorizadas |
|---|---|---|
| Usuário autenticado | Registrar e acompanhar as próprias receitas e despesas. | Criar, listar, consultar, editar, pagar e reabrir somente lançamentos próprios. |
| Visitante/sessão inválida | Nenhuma sobre dados financeiros. | Autenticar-se; não recebe dados de lançamentos. |

## 11. Fluxos

### 11.1 Fluxo principal

1. O usuário abre `/transactions` autenticado.
2. A web busca uma página ordenada e permite filtros.
3. O usuário escolhe receita ou despesa, conta ativa e categoria ativa compatível.
4. Informa descrição, previsto, vencimento e, se realizado, realizado e data do pagamento.
5. A API deriva o owner, valida DTO, relações e coerência e persiste o lançamento.
6. A listagem exibe previsto e realizado separadamente e o indicador derivado de vencido.
7. Um pendente pode ser pago; um pago pode ser reaberto.

### 11.2 Fluxos alternativos e exceções

- Relação inexistente ou alheia → `404` indistinguível, sem indicar qual owner existe.
- Relação própria arquivada → `409 RELATED_RESOURCE_ARCHIVED`.
- Tipo incompatível com categoria → `409 CATEGORY_TYPE_MISMATCH`.
- Estado/valor/data incoerente → `400 VALIDATION_ERROR`, sem persistência parcial.
- API indisponível → web preserva entrada segura, informa falha e permite tentar novamente, sem falso sucesso.
- Sessão ausente/expirada → API `401`; web não renderiza dado privado e redireciona ao login.

## 12. Regras de negócio

| ID | Regra | Origem/decisão | Exemplo |
|---|---|---|---|
| `RN-01` | Natureza aceita somente `INCOME` ou `EXPENSE`. | Tarefa | `TRANSFER` falha. |
| `RN-02` | Estado aceita somente `PENDING` ou `PAID`. | Tarefa | `CANCELLED` falha. |
| `RN-03` | Valores são magnitudes positivas decimais exatas. | Tarefa/ADR-004 | Despesa `10.00`, não `-10.00`. |
| `RN-04` | Pendente não possui realizado nem data de pagamento. | Tarefa | Ambos são `null`. |
| `RN-05` | Pago possui realizado positivo e data de pagamento. | Tarefa | `actualAmount="9.50"`. |
| `RN-06` | Datas são civis estritas, sem fuso. | Tarefa/SPEC-003 | `2028-02-29` é válida. |
| `RN-07` | Conta, categoria e lançamento têm o owner autenticado. | Tarefa/SPEC-002 | Referência alheia dá `404`. |
| `RN-08` | Categoria e lançamento têm a mesma natureza. | Tarefa/SPEC-004 | Despesa não usa categoria de receita. |
| `RN-09` | Relação arquivada impede nova referência, mas não invalida histórico. | Tarefa/SPEC-003/004 | Lançamento antigo continua legível. |
| `RN-10` | Vencido é derivado, não estado. | Tarefa | Pendente de ontem está vencido. |
| `RN-11` | Somente pagos afetam saldo pelo realizado. | Tarefa | Previsto não entra na soma. |
| `RN-12` | Pay e reopen são idempotentes conforme seção 9.5. | Tarefa | Retentativa idêntica não duplica efeito. |
| `RN-13` | Não há exclusão de lançamento. | Tarefa | Nenhuma rota `DELETE`. |
| `RN-14` | Projeções públicas nunca expõem `userId`. | Tarefa/SPEC-002 | Owner permanece interno. |

## 13. Modelo de dados

### 13.1 Entidade conceitual e Prisma futuro

| Entidade | Campo | Tipo conceitual/futuro | Obrigatório | Regra |
|---|---|---|---|---|
| `FinancialTransaction` | `id` | UUID | Sim | Gerado pelo servidor; PK. |
| `FinancialTransaction` | `userId` | UUID | Sim | FK para `User`; interno. |
| `FinancialTransaction` | `accountId` | UUID | Sim | FK para `FinancialAccount`; mesmo owner. |
| `FinancialTransaction` | `categoryId` | UUID | Sim | FK para `FinancialCategory`; mesmo owner e tipo compatível. |
| `FinancialTransaction` | `type` | `INCOME | EXPENSE` | Sim | Enum fechado. |
| `FinancialTransaction` | `status` | `PENDING | PAID` | Sim | Enum fechado. |
| `FinancialTransaction` | `description` | `String`/`varchar(200)` | Sim | Texto validado e com trim. |
| `FinancialTransaction` | `notes` | `String?`/`varchar(2000)` | Não | Texto simples ou `null`. |
| `FinancialTransaction` | `plannedAmount` | `Decimal @db.Decimal(19,2)` | Sim | `> 0`. |
| `FinancialTransaction` | `actualAmount` | `Decimal? @db.Decimal(19,2)` | Não | Nulo em pendente; `> 0` em pago. |
| `FinancialTransaction` | `dueDate` | `DateTime @db.Date` | Sim | Data civil. |
| `FinancialTransaction` | `paidAt` | `DateTime? @db.Date` | Não | Nula em pendente; presente em pago. |
| `FinancialTransaction` | `createdAt` | `DateTime @default(now()) @db.Timestamptz(3)` | Sim | Instante do servidor. |
| `FinancialTransaction` | `updatedAt` | `DateTime @updatedAt @db.Timestamptz(3)` | Sim | Não muda em repetição idempotente sem alteração. |

Relações obrigatórias: `FinancialTransaction.user`, `.account` e `.category`; relações inversas em `User`, `FinancialAccount` e `FinancialCategory`. As FKs usam preferencialmente `ON DELETE RESTRICT`; não há cascade de histórico financeiro.

### 13.2 Migration futura e índices

- Criar uma migration nova; migrations anteriores não podem ser editadas.
- Criar enums/tabela, FKs `RESTRICT`, checks `plannedAmount > 0`, `actualAmount IS NULL OR actualAmount > 0` e coerência: `(status='PENDING' AND actualAmount IS NULL AND paidAt IS NULL) OR (status='PAID' AND actualAmount IS NOT NULL AND paidAt IS NOT NULL)`.
- Checks de texto/enum compatíveis com o contrato devem existir quando suportados sem duplicar normalização insegura. Coerência de owner e tipo entre tabelas permanece transacional no serviço e é comprovada por integração.
- Índice `(userId, dueDate DESC, createdAt DESC, id)` sustenta listagem padrão e cursor.
- Índices `(userId, accountId, dueDate)`, `(userId, categoryId, dueDate)` e `(userId, status, dueDate)` sustentam filtros isolados por owner.
- Índice `(userId, paidAt)` sustenta intervalo de realização. `type` pode integrar `(userId, type, dueDate)` se o plano real justificar; a implementação deve registrar `EXPLAIN` antes de adicionar índice redundante.
- Sem colunas de transferência, recorrência, `currentBalance` ou `archivedAt`.

## 14. Contratos de API

Todas as rotas exigem `Authorization: Bearer`. Corpos e queries usam DTOs explícitos com whitelist e rejeição de campos desconhecidos; nenhum body é repassado diretamente ao ORM. Content-Type JSON é obrigatório onde há body.

### 14.1 Contratos compartilhados

```ts
type FinancialTransactionType = 'INCOME' | 'EXPENSE';
type FinancialTransactionStatus = 'PENDING' | 'PAID';

type PublicFinancialTransaction = {
  id: string;
  accountId: string;
  categoryId: string;
  type: FinancialTransactionType;
  status: FinancialTransactionStatus;
  description: string;
  notes: string | null;
  plannedAmount: string;
  actualAmount: string | null;
  dueDate: string;
  paidAt: string | null;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
};

type CreateFinancialTransactionRequest = {
  accountId: string;
  categoryId: string;
  type: FinancialTransactionType;
  status: FinancialTransactionStatus;
  description: string;
  notes?: string | null;
  plannedAmount: string;
  actualAmount?: string | null;
  dueDate: string;
  paidAt?: string | null;
};

type UpdateFinancialTransactionRequest = {
  description?: string;
  notes?: string | null;
  plannedAmount?: string;
  dueDate?: string;
  accountId?: string;
  categoryId?: string;
  type?: FinancialTransactionType;
};

type PayFinancialTransactionRequest = {
  actualAmount: string;
  paidAt: string;
};

type TransactionListQuery = {
  accountId?: string;
  categoryId?: string;
  type?: FinancialTransactionType;
  status?: FinancialTransactionStatus;
  dueDateFrom?: string;
  dueDateTo?: string;
  paidAtFrom?: string;
  paidAtTo?: string;
  limit?: string;
  cursor?: string;
};

type PaginatedFinancialTransactionsResponse = {
  data: PublicFinancialTransaction[];
  page: { limit: number; nextCursor: string | null };
};
```

Não criar outros contratos públicos de lançamento nesta unidade. `userId` não aparece em nenhum contrato. Datas de criação/atualização são ISO 8601 UTC; datas financeiras permanecem `YYYY-MM-DD`.

Erros seguem o envelope existente:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Revise os dados informados.", "details": [{ "field": "plannedAmount", "message": "Informe um valor decimal positivo." }] } }
```

Códigos previstos: `VALIDATION_ERROR` e `INVALID_CURSOR` (`400`), `UNAUTHORIZED` (`401`), `NOT_FOUND` (`404`), `CATEGORY_TYPE_MISMATCH`, `RELATED_RESOURCE_ARCHIVED`, `TRANSACTION_ALREADY_PAID`, `PAID_TRANSACTION_REQUIRES_REOPEN` (`409`) e `INTERNAL_ERROR` (`500`). Erros não revelam owner, existência alheia, SQL ou stack.

### 14.2 Criar — `POST /api/transactions`

- Entrada: `CreateFinancialTransactionRequest`; nenhuma query. `status` é explícito.
- `PENDING`: `actualAmount` e `paidAt` devem estar omitidos ou `null`; saída os normaliza para `null`.
- `PAID`: `actualAmount` e `paidAt` são obrigatórios e válidos.
- Sucesso: `201` com `PublicFinancialTransaction`.
- Erros: `400`, `401`, `404` para referência ausente/alheia, `409` para arquivada/incompatível, `500`.
- Idempotência: não idempotente; cada sucesso cria novo UUID. Prevenção de submissão duplicada fica na web; chave idempotente não pertence a esta SPEC.

### 14.3 Listar — `GET /api/transactions`

- Entrada: somente `TransactionListQuery`. Filtros combinam por `AND`; datas inicial/final são inclusivas; início posterior ao fim dá `400`. Filtro `paidAt` naturalmente exclui pendentes.
- Sempre filtrar por owner antes dos demais filtros. Conta/categoria em query deve ser UUID; por segurança, UUID alheio ou inexistente produz página vazia, não confirma existência.
- Ordenação fixa: `dueDate DESC`, `createdAt DESC`, `id ASC` como desempate. Não há parâmetro de ordenação nesta versão.
- Paginação por cursor é obrigatória. `limit` inteiro decimal de `1` a `100`, padrão `20`. `cursor` é token opaco, URL-safe e autenticado/assinado pelo servidor, contendo a última tríade de ordenação e a impressão dos filtros; token inválido, adulterado ou reutilizado com filtros/limite diferentes dá `400 INVALID_CURSOR`.
- Buscar no máximo `limit + 1`, devolver até `limit` itens e `nextCursor` somente se houver continuação. Não retornar total global nem lista ilimitada.
- Sucesso: `200` com `PaginatedFinancialTransactionsResponse`; vazio é `{data: [], page: {limit, nextCursor: null}}`.
- Idempotência: leitura idempotente para o mesmo estado persistido e mesma data civil de referência.

### 14.4 Consultar — `GET /api/transactions/:id`

- Entrada: UUID de lançamento; body/query proibidos.
- Sucesso: `200` com projeção pública própria, mesmo que conta/categoria tenham sido arquivadas depois.
- Erros: `400` para entrada adicional; `401`; `404` indistinguível para UUID inválido, ausente ou alheio; `500`.
- Idempotência: leitura idempotente para o mesmo estado/data civil.

### 14.5 Editar — `PATCH /api/transactions/:id`

- Entrada: `UpdateFinancialTransactionRequest` com ao menos um campo permitido; campos desconhecidos ou `actualAmount`, `paidAt`, `status`, `userId`, `id`, timestamps dão `400`.
- Em qualquer estado, `description`/`notes` são aceitos. Em `PENDING`, os demais campos definidos no tipo são aceitos com revalidação integral. Em `PAID`, presença de qualquer um deles dá `409 PAID_TRANSACTION_REQUIRES_REOPEN`, mesmo se o valor for igual.
- Sucesso: `200` com projeção atualizada. Campo permitido igual ao atual é aceito sem exigir mudança; a implementação evita atualização física desnecessária quando todo valor canônico é igual.
- Erros: `400`, `401`, `404`, `409` por estado, relação arquivada ou tipo incompatível, `500`.
- Idempotência: equivalente no estado para o mesmo body canônico.

### 14.6 Pagar — `POST /api/transactions/:id/pay`

- Entrada: exatamente `PayFinancialTransactionRequest`; query e campos adicionais proibidos.
- Sucesso: `200`, status `PAID`, valores persistidos e saldo derivável atualizado uma vez.
- Em `PAID`, mesmos valores decimais e mesma data retornam `200` preservando `updatedAt`; qualquer diferença retorna `409 TRANSACTION_ALREADY_PAID`.
- Erros: `400`, `401`, `404`, `409`, `500`. A transição é atômica e segura sob concorrência.

### 14.7 Reabrir — `POST /api/transactions/:id/reopen`

- Entrada: body e query proibidos.
- Sucesso: `200`, status `PENDING`, `actualAmount=null`, `paidAt=null`; remove uma vez o efeito derivado no saldo.
- Se já `PENDING`, retorna `200` com o mesmo recurso e preserva `updatedAt`.
- Erros: `400` para entrada adicional; `401`; `404`; `500`. A transição é atômica e segura sob concorrência.

## 15. Interface

- Rota protegida `/transactions`, integrada à navegação autenticada, sem alterar autenticação.
- Lista paginada na ordem da API, com carregamento inicial e “carregar mais”/controle equivalente que não duplica itens. Exibe descrição, natureza, conta/categoria, vencimento, status, previsto e realizado em campos visualmente distintos.
- Filtros de conta, categoria, natureza, estado e intervalos de `dueDate`/`paidAt`; aplicar ou limpar filtros reinicia o cursor.
- Estado vazio diferencia “nenhum lançamento” de “nenhum resultado para os filtros” e oferece criar ou limpar filtros.
- Formulário cria receita ou despesa e limita categorias ativas à natureza escolhida e contas ativas. Pendente não mostra/exige realizado; pago exige realizado e data.
- Ações “Marcar como pago” e “Reabrir para pendente” refletem as transições. Edição bloqueia campos financeiros em pago e orienta reabrir primeiro.
- Indicador “Vencido” aparece somente para condição derivada; não substitui o rótulo `PENDING`.
- Loading desabilita submissão repetida. Erro de validação fica junto ao campo; indisponibilidade global não simula sucesso, preserva conteúdo seguro e oferece nova tentativa.
- Layout é responsivo em celular e desktop, com rótulos, foco, teclado, contraste e anúncio acessível de status/erros. Valores não dependem apenas de cor ou sinal.
- Não há controles, atalhos ou conceitos de transferência ou recorrência.

## 16. Validações

| Campo ou ação | Validação | Mensagem/resultado esperado |
|---|---|---|
| `type` | `INCOME` ou `EXPENSE`; compatível com categoria. | `400` enum; `409` incompatibilidade. |
| `status` | `PENDING` ou `PAID` na criação; proibido no PATCH. | `400`; use pay/reopen. |
| `description` | String, trim, 1–200 pontos de código, sem controles/quebras. | `400`, informe descrição válida. |
| `notes` | `null`/omissão ou texto simples até 2.000 pontos; trim. | `400`; vazio vira `null`. |
| Valores | String decimal positiva, escala e precisão da seção 9.2. | `400`, sem arredondar/persistir. |
| `dueDate`/`paidAt` | Data gregoriana estrita `YYYY-MM-DD`. | `400`, informe data válida. |
| Coerência de estado | Pendente sem realizado/data; pago com ambos. | `400`, sem persistência parcial. |
| `accountId`/`categoryId` | UUID próprio e ativo para nova referência. | `404` alheio/ausente; `409` arquivado. |
| PATCH | Ao menos um campo permitido e permissões pelo status. | `400` vazio/desconhecido; `409` se requer reopen. |
| Intervalos | Início menor ou igual ao fim. | `400` no campo do intervalo. |
| Paginação | Limite 1–100 e cursor válido/coerente. | `400`; nunca lista ilimitada. |
| Campos desconhecidos | Rejeitados; sem mass assignment. | `400`, nenhuma alteração. |

## 17. Permissões

| Ação | Ator autorizado | Condição | Comportamento quando negado |
|---|---|---|---|
| Criar | Usuário autenticado | Conta/categoria próprias, ativas e compatíveis. | `401`, `404` ou `409`; nada criado. |
| Listar | Usuário autenticado | Query sempre escopada ao owner. | `401`; nenhum dado. |
| Consultar | Usuário autenticado | Lançamento próprio. | `404` ausente/alheio. |
| Editar | Usuário autenticado | Próprio e campos permitidos pelo estado. | `404` ou `409`. |
| Pagar/reabrir | Usuário autenticado | Próprio e transição coerente/idempotente. | `404` ou `409`; sem efeito cruzado. |

## 18. Segurança e privacidade

- Dados envolvidos: descrições, notas, datas, valores e relações revelam hábitos financeiros e são sensíveis.
- Ameaças: IDOR, enumeração de recursos, mass assignment, injeção, XSS armazenado, adulteração de cursor, precisão indevida, corrida em transições e vazamento em logs.
- Todas as operações derivam `userId` do token e aplicam owner no backend, inclusive agregações, filtros e relações. Autorização na interface não substitui o backend.
- DTOs explícitos rejeitam propriedades desconhecidas; projeção pública omite `userId`; texto é renderizado escapado.
- Recurso alheio e inexistente têm `404` indistinguível. IDs de filtro alheios não confirmam existência.
- Cursor é opaco e protegido contra adulteração; não deve carregar dado financeiro legível.
- Não registrar token, cookie, owner, IDs de recurso, descrição, notas, valores, datas, payloads ou cursores. Erros não expõem stack/SQL.
- Não alterar autenticação, CORS, cookie ou CSRF.

## 19. Erros e estados vazios

| Situação | Estado apresentado | Recuperação esperada |
|---|---|---|
| Sem lançamentos | Estado vazio sem dados inventados. | Criar receita ou despesa. |
| Filtro sem resultado | Estado vazio contextual. | Limpar/alterar filtros. |
| Entrada inválida | Mensagem específica, sem persistência parcial. | Corrigir e reenviar. |
| Relação arquivada/incompatível | Conflito sem trocar relação silenciosamente. | Escolher ativa/compatível. |
| Pago requer alteração financeira | Orientação para reabrir. | Reabrir conscientemente e editar. |
| Cursor inválido | Lista não é parcialmente misturada. | Reiniciar paginação. |
| API indisponível | Falha anunciada, sem falso sucesso. | Tentar novamente. |
| Sessão ausente/expirada | Nenhum dado privado. | Redirecionar ao login. |

## 20. Observabilidade

Logs estruturados mínimos podem registrar nome da operação, código HTTP, duração, correlation ID não sensível e resultado agregado (`success`/classe do erro). Métricas agregadas de latência, erros e conflitos de transição são permitidas. Não registrar payloads, tokens, owners, IDs, cursores, textos, valores ou datas financeiras. Alertas novos não são obrigatórios nesta unidade; usar mecanismos existentes para recorrência de `5xx`.

## 21. Migração e compatibilidade

- Dados existentes: não há lançamentos a converter; não gerar seed nem transformar saldo inicial em lançamento.
- Compatibilidade: autenticação, contas e categorias continuam com seus contratos. Arquivamento posterior de relação não quebra histórico.
- Migration necessária na implementação futura: sim, nova e aditiva conforme seção 13; anteriores permanecem byte a byte intactas.
- Implantação gradual: não aplicável; schema, API, contratos e web devem ser compatíveis na futura entrega.
- Sem transferência/recorrência antecipada. Evoluções terão migrations e SPECs próprias.

## 22. Critérios de aceite

### `CA-01 — Criar lançamento pendente`
**Dado** usuário autenticado com conta e categoria próprias ativas **Quando** cria `PENDING` válido **Então** recebe `201`, com `actualAmount` e `paidAt` nulos e sem efeito no saldo.

### `CA-02 — Criar lançamento realizado`
**Dado** relações próprias ativas **Quando** cria `PAID` com realizado e data válidos **Então** recebe `201` e o realizado afeta o saldo uma vez.

### `CA-03 — Receita e despesa positivas`
**Dado** receitas e despesas **Quando** são criadas **Então** ambas usam magnitudes positivas e a natureza define soma ou subtração.

### `CA-04 — Previsto obrigatório`
**Dado** criação sem `plannedAmount` **Quando** envia **Então** recebe `400` e nada é criado.

### `CA-05 — Valor zero ou negativo`
**Dado** valor `0.00`, negativo ou com sinal **Quando** envia em previsto/realizado **Então** recebe `400` sem coerção.

### `CA-06 — Precisão ou tipo inválido`
**Dado** número JSON, expoente, mais de duas casas ou mais de 17 inteiras **Quando** envia **Então** recebe `400`, sem arredondamento.

### `CA-07 — Preservação decimal`
**Dado** valor `12345678901234567.89` válido **Quando** persiste e consulta **Então** banco e JSON preservam exatamente `12345678901234567.89`.

### `CA-08 — Pendente com realizado incoerente`
**Dado** `status=PENDING` com realizado ou data preenchida **Quando** cria **Então** recebe `400` e nada persiste.

### `CA-09 — Pago incompleto`
**Dado** `status=PAID` sem realizado ou sem `paidAt` **Quando** cria **Então** recebe `400`.

### `CA-10 — Data civil inválida`
**Dado** data inexistente, timestamp ou formato diferente de `YYYY-MM-DD` **Quando** envia **Então** recebe `400` sem deslocamento.

### `CA-11 — Ano bissexto`
**Dado** `2028-02-29` **Quando** usa como vencimento ou pagamento **Então** é preservado como a mesma data civil.

### `CA-12 — Descrição e notas`
**Dado** descrição com espaços e nota vazia **Quando** cria **Então** descrição recebe trim e nota se torna `null`; limites/excesso dão `400`.

### `CA-13 — Conta alheia`
**Dado** `accountId` de outro usuário **Quando** cria ou edita **Então** recebe `404` indistinguível e nada muda.

### `CA-14 — Categoria alheia`
**Dado** `categoryId` de outro usuário **Quando** cria ou edita **Então** recebe `404` indistinguível e nada muda.

### `CA-15 — Categoria incompatível`
**Dado** categoria `INCOME` **Quando** tenta associar lançamento `EXPENSE` **Então** recebe `409 CATEGORY_TYPE_MISMATCH`.

### `CA-16 — Conta arquivada`
**Dado** conta própria arquivada **Quando** tenta criar ou apontar edição para ela **Então** recebe `409 RELATED_RESOURCE_ARCHIVED`.

### `CA-17 — Categoria arquivada`
**Dado** categoria própria arquivada **Quando** tenta criar ou apontar edição para ela **Então** recebe `409 RELATED_RESOURCE_ARCHIVED`.

### `CA-18 — Histórico após arquivamento`
**Dado** lançamento existente cuja conta/categoria foi arquivada depois **Quando** consulta/lista **Então** o histórico continua disponível e válido.

### `CA-19 — Listagem isolada e ordenada`
**Dado** lançamentos de dois usuários e empates de data **Quando** um lista **Então** recebe apenas os próprios em `dueDate desc`, `createdAt desc`, `id asc`.

### `CA-20 — Filtros combinados`
**Dado** lançamentos variados **Quando** combina conta, categoria, tipo e estado **Então** recebe somente a interseção própria.

### `CA-21 — Intervalos de vencimento`
**Dado** datas nos limites e fora deles **Quando** filtra `dueDateFrom`/`dueDateTo` **Então** limites são inclusivos e intervalo invertido dá `400`.

### `CA-22 — Intervalos de pagamento`
**Dado** pagos e pendentes **Quando** filtra `paidAtFrom`/`paidAtTo` **Então** retorna pagos no intervalo inclusivo e exclui nulos.

### `CA-23 — Primeira página`
**Dado** mais de 20 resultados **Quando** lista sem limite/cursor **Então** recebe 20 e `nextCursor`, nunca lista ilimitada.

### `CA-24 — Continuação paginada`
**Dado** cursor válido **Quando** busca a página seguinte **Então** não duplica nem omite itens no estado estável e termina com `nextCursor=null`.

### `CA-25 — Paginação inválida`
**Dado** limite fora de 1–100, cursor adulterado ou usado com filtros diferentes **Quando** lista **Então** recebe `400` sem página parcial.

### `CA-26 — Estado vazio`
**Dado** nenhum lançamento ou nenhum resultado do filtro **Quando** abre a tela **Então** vê estado vazio contextual e ação adequada.

### `CA-27 — Editar texto em pendente e pago`
**Dado** lançamento próprio em qualquer estado **Quando** edita descrição/notas validamente **Então** recebe `200` com texto atualizado.

### `CA-28 — Editar financeiro pendente`
**Dado** pendente próprio **Quando** altera previsto, vencimento, conta, categoria ou tipo validamente **Então** recebe `200` após revalidar todas as relações/coerência.

### `CA-29 — Editar financeiro pago`
**Dado** pago próprio **Quando** PATCH contém campo financeiro, mesmo igual **Então** recebe `409 PAID_TRANSACTION_REQUIRES_REOPEN` e nada muda.

### `CA-30 — Proibir realizado no PATCH`
**Dado** qualquer lançamento **Quando** PATCH contém `actualAmount`, `paidAt` ou `status` **Então** recebe `400` e orienta usar transição específica.

### `CA-31 — Pagar pendente`
**Dado** pendente próprio **Quando** paga com valor/data válidos **Então** vira `PAID` atomicamente e o saldo incorpora o realizado uma vez.

### `CA-32 — Pay idempotente idêntico`
**Dado** pago com valor/data conhecidos **Quando** repete pay com os mesmos valores canônicos **Então** recebe `200`, preserva `updatedAt` e não duplica saldo.

### `CA-33 — Pay repetido divergente`
**Dado** lançamento pago **Quando** repete pay com valor ou data diferente **Então** recebe `409 TRANSACTION_ALREADY_PAID` sem sobrescrever dados.

### `CA-34 — Reabrir pago`
**Dado** pago próprio **Quando** reabre **Então** vira `PENDING`, limpa realizado/data e remove uma vez seu efeito no saldo.

### `CA-35 — Reopen idempotente`
**Dado** pendente próprio **Quando** reabre novamente **Então** recebe `200`, preserva `updatedAt` e saldo.

### `CA-36 — Vencido derivado`
**Dado** relógio controlado em `2026-08-07` e pendente com vencimento `2026-08-06` **Quando** projeta **Então** `isOverdue=true`, sem persistir novo estado.

### `CA-37 — Hoje, pago e futuro não vencidos`
**Dado** vencimento hoje/futuro ou lançamento pago **Quando** projeta **Então** `isOverdue=false`.

### `CA-38 — Saldo realizado exato`
**Dado** abertura `100.00`, receita paga `25.10`, despesa paga `5.05` e pendente `900.00` **Quando** calcula saldo **Então** resulta exatamente `120.05`.

### `CA-39 — Saldo inicial não é lançamento`
**Dado** conta com abertura **Quando** lista lançamentos **Então** não existe receita/despesa automática para a abertura.

### `CA-40 — Projeção e mass assignment`
**Dado** request com `userId` ou campo interno **Quando** envia **Então** recebe `400`; respostas nunca expõem `userId`.

### `CA-41 — Recurso alheio`
**Dado** UUID de lançamento de outro usuário **Quando** consulta, edita, paga ou reabre **Então** recebe o mesmo `404` de inexistente.

### `CA-42 — Sem autenticação`
**Dado** token ausente/inválido **Quando** acessa API ou web **Então** API responde `401` e web redireciona sem renderizar dados.

### `CA-43 — API indisponível`
**Dado** falha de rede ou `500` **Quando** lista ou submete **Então** web anuncia erro, não simula sucesso e permite tentar novamente.

### `CA-44 — Ausência de exclusão`
**Dado** contratos desta versão **Quando** são inspecionados **Então** não existe `DELETE` nem `archivedAt` para lançamentos.

### `CA-45 — Ausência de transferência e recorrência`
**Dado** implementação futura desta SPEC **Quando** é inspecionada **Então** não contém `TRANSFER`, vínculo de recorrência ou UI desses domínios.

### `CA-46 — Concorrência nas transições`
**Dado** duas requisições concorrentes de pay ou reopen **Quando** são processadas **Então** a transição e o efeito no saldo ocorrem no máximo uma vez, com resultado idempotente/conflito previsto.

## 23. Testes obrigatórios

| Nível | Cenários mínimos | Critérios relacionados | Evidência esperada |
|---|---|---|---|
| Unitário | Parser/limites decimais sem float; estados; tipo/categoria; textos; datas e vencido com relógio; pay/reopen/idempotência; projeção; fórmula de saldo. | CA-03–CA-12, CA-15, CA-27–CA-38, CA-40, CA-46 | Testes determinísticos, valores exatos e relógio controlado. |
| Integração — PostgreSQL real | Migration nova e anteriores; PENDING/PAID; checks e Decimal; owner de lançamento/conta/categoria; incompatível/arquivadas/histórico; filtros/ordem/cursor; transições concorrentes; FK RESTRICT. | CA-01–CA-25, CA-28–CA-35, CA-38–CA-41, CA-46 | Banco real identificado; mocks não substituem constraints/FKs. |
| Contrato/API | DTOs, whitelist, enums, strings decimais/datas, envelopes/códigos, projeção, paginação, pay/reopen e `404` indistinguível. | CA-01–CA-35, CA-40–CA-42, CA-44–CA-45 | Testes HTTP automatizados. |
| Web com mocks controlados | Vazio; receita/despesa; pendente/realizado; filtros; paginação; pay/reopen; vencido; edição por estado; erro; redirecionamento; responsividade lógica. | CA-01–CA-02, CA-19–CA-37, CA-42–CA-45 | Testes nomeados como mockados, sem alegar banco real. |
| E2E | Login; criar pendente; pagar; listar; reabrir; criar realizado; filtrar; logout. | CA-01–CA-02, CA-19–CA-24, CA-31, CA-34, CA-42 | Playwright contra aplicação e banco de teste reais, dados fictícios. |
| Aceitação manual | Clareza previsto/realizado; filtros/paginação; responsividade; acessibilidade; erros; ausência de transferência/recorrência. | CA-23–CA-30, CA-36–CA-37, CA-43–CA-45 | Checklist e capturas sanitizadas quando implementado. |

Testes monetários verificam limites, zero, negativos, escala e soma exata. Datas cobrem mês/ano, bissexto, formato e fusos de execução distintos sem mudar data civil. Mocks não são evidência de migration, constraint, FK, transação, concorrência ou isolamento no PostgreSQL.

## 24. Arquivos permitidos

Nesta tarefa documental:

- `docs/specs/SPEC-005-LANCAMENTOS-FINANCEIROS.md`.

Na implementação futura, somente mediante unidade própria:

- `apps/api/prisma/schema.prisma` e uma migration nova em `apps/api/prisma/migrations/**`;
- módulo de lançamentos em `apps/api/src/**`;
- contratos mínimos de lançamentos em `packages/shared/**`;
- rota, página, componentes e testes de lançamentos em `apps/web/src/**`;
- testes unitários, PostgreSQL, contrato, web e E2E aplicáveis;
- `package.json`/lockfile apenas se indispensável e com justificativa explícita.

## 25. Arquivos proibidos

- Nesta tarefa, todo arquivo diferente da própria SPEC-005.
- Workflow de CI, documentos de produto, ADRs e SPECs anteriores.
- Migrations já existentes.
- Contratos/implementação de autenticação, cookies, CORS ou CSRF.
- Regras de contas/categorias, salvo relações mínimas futuras expressamente autorizadas nesta SPEC.
- Código/schema/rotas/telas de transferência, recorrência ou qualquer item fora do escopo.
- Android/iOS, deploy, seed, cache/materialização de saldo e `currentBalance`.

## 26. Dependências

| Dependência | Motivo | Estado da aprovação | Impacto |
|---|---|---|---|
| SPEC-002 | Token, owner e isolamento. | Aprovada e implementada | `userId` confiável vem da autenticação. |
| SPEC-003 | Conta, abertura e arquivamento. | Aprovada e implementada | Relação obrigatória e base da fórmula do saldo. |
| SPEC-004 | Categoria tipada e arquivamento. | Aprovada e implementada | Relação obrigatória e compatibilidade de natureza. |
| ADR-002/003 | Vue/Quasar e NestJS. | Aprovadas | Superfícies futuras web/API. |
| PostgreSQL/Prisma — ADR-004 | Decimal, migration, FKs e transações. | Aprovada | Persistência futura segura. |
| ADR-006 e estratégia de testes | Pirâmide e ferramentas. | Aprovadas | Evidências futuras. |

Nenhuma dependência nova é autorizada ou necessária para criar esta SPEC.

## 27. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Arredondamento/perda de centavos | Média | Alto | String decimal, `Decimal(19,2)`, rejeição sem arredondar e testes exatos. |
| Dupla contagem em retentativa/concorrência | Média | Alto | Transições condicionais atômicas, idempotência e testes concorrentes. |
| Saldo incluir pendente ou previsto | Média | Alto | Fórmula única com `PAID.actualAmount` e testes invariantes. |
| IDOR em lançamento ou relações | Média | Alto | Owner em toda query, `404` indistinguível e testes com dois usuários. |
| Data civil deslocada por fuso | Média | Alto | `@db.Date`, strings estritas e testes em fusos distintos. |
| Cursor produzir duplicação/omissão | Média | Médio | Ordenação total, token vinculado a filtros e testes de borda. |
| Texto financeiro vazar em logs/XSS | Baixa | Alto | Não logar conteúdo e renderizar texto escapado. |
| Arquivamento quebrar histórico | Baixa | Alto | FK RESTRICT e leitura histórica independente do estado atual da relação. |
| Transferência futura ser modelada como receita/despesa | Média | Alto | Exclusão explícita; SPEC e modelo próprios depois. |
| Índices excessivos ou insuficientes | Média | Médio | Índices justificados e validação do plano no PostgreSQL real. |

Riscos residuais: paginação por cursor não fornece total global e alterações concorrentes entre páginas podem mudar a visão; isso é aceito para evitar lista ilimitada, mantendo consistência por ordenação e sem promessa de snapshot. A semântica de transferência/recorrência permanece deliberadamente indefinida.

## 28. Rollback

- Documento: `git revert <hash-do-commit>` e confirmar que somente a SPEC-005 foi removida.
- Implementação futura: reverter código por commit e repetir verificações; não apagar dados reais/tabela como rollback automático.
- Migration compensatória destrutiva requer decisão humana. Em ambiente com dados, preservar registros e elaborar plano aditivo aprovado.
- Validar rollback pela ausência da superfície nova, integridade das migrations anteriores e invariância de autenticação, contas e categorias.

## 29. Dúvidas

Não há dúvidas abertas. Natureza, estados, transições, precisão, datas, texto, relações, saldo, paginação, segurança e exclusões foram definidos pela tarefa e por esta SPEC aprovada.

## 30. Decisões aprovadas

| Data | Decisão | Responsável pela aprovação | Consequência |
|---|---|---|---|
| `2026-08-07` | Natureza fechada `INCOME`/`EXPENSE`; sem transferência. | Tarefa da SPEC-005 | Magnitudes são positivas; transferência terá SPEC própria. |
| `2026-08-07` | Estados fechados `PENDING`/`PAID`; vencido derivado. | Tarefa da SPEC-005 | Não persistir estados antecipados. |
| `2026-08-07` | Pay/reopen são endpoints específicos e idempotentes. | Tarefa da SPEC-005 | PATCH não altera realizado/status. |
| `2026-08-07` | Dinheiro usa string JSON e `Decimal(19,2)`, sem arredondamento. | Tarefa/ADR-004 | Precisão exata ponta a ponta. |
| `2026-08-07` | Datas financeiras são civis `YYYY-MM-DD`. | Tarefa | Nenhuma conversão de fuso. |
| `2026-08-07` | Relações devem ser próprias, ativas ao referenciar e compatíveis. | Tarefa/SPEC-002/003/004 | Histórico sobrevive a arquivamento posterior. |
| `2026-08-07` | Saldo é derivado de abertura e lançamentos pagos realizados. | Tarefa | Sem `currentBalance`, cache ou materialização. |
| `2026-08-07` | Listagem usa cursor, padrão 20, máximo 100 e ordenação total fixa. | Tarefa da SPEC-005 | Nunca há lista ilimitada ou total obrigatório. |
| `2026-08-07` | Não existe exclusão de lançamento nesta versão. | Tarefa da SPEC-005 | Histórico não é apagado nem arquivado antecipadamente. |

## 31. Definition of Done específica

Além da [Definition of Done do projeto](../quality/DEFINITION-OF-DONE.md), a implementação futura exige:

- [ ] Esta SPEC permanece aprovada e qualquer mudança segue controle formal.
- [ ] Migration nova preserva as anteriores e comprova checks, FKs `RESTRICT`, índices e `Decimal(19,2)` em PostgreSQL real.
- [ ] Owner foi comprovado em lançamento, conta, categoria, filtros e transições com dois usuários.
- [ ] Contratos HTTP e compartilhados mínimos, paginação e projeção sem `userId` foram atendidos.
- [ ] Pay/reopen, idempotência e concorrência foram comprovados sem dupla contagem.
- [ ] Fórmula do saldo usa somente `PAID.actualAmount`, sem `currentBalance`.
- [ ] Web protegida, responsiva e acessível distingue previsto/realizado e todos os estados exigidos.
- [ ] Testes unitários, integração PostgreSQL, contrato, web e E2E aplicáveis passaram.
- [ ] Todos os 46 critérios de aceite foram atendidos com evidências sanitizadas.
- [ ] Nenhuma transferência, recorrência, exclusão ou outro item fora do escopo foi implementado.
- [ ] Workflow de CI permaneceu desativado e inalterado.

Para esta criação exclusivamente documental, lint/typecheck/testes/build de aplicação são não aplicáveis por não haver código ou configuração alterados; devem ser executadas verificação de formato, estrutura, links, escopo e diff.

## 32. Histórico de alterações da SPEC

| Data | Alteração | Motivo | Autor | Aprovador, quando aplicável |
|---|---|---|---|---|
| `2026-08-07` | Criação da SPEC-005 com status Aprovada. | Definir e autorizar a futura unidade de lançamentos financeiros básicos. | `Codex Cloud` | Tarefa `PROMPT-SPEC-005-LANCAMENTOS-FINANCEIROS.md` |
