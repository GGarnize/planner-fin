# SPEC de funcionalidade — `SPEC-006 — Transferências entre contas`

## 1. Identificação

| Campo | Valor |
|---|---|
| ID | `SPEC-006` |
| Título | Transferências entre contas |
| Responsável | Equipe PlannerFin |
| Data de criação | 2026-08-07 |
| Última atualização | 2026-08-07 |
| Tarefa relacionada | `PROMPT-SPEC-006-TRANSFERENCIAS-ENTRE-CONTAS.md` |
| Documentos relacionados | SPEC-002, SPEC-003, SPEC-004, SPEC-005; ADR-001 a ADR-006; documentos de produto e qualidade |

## 2. Status

`Aprovada`

**Aprovada por:** responsável do produto, por autorização explícita na tarefa de 2026-08-07.

## 3. Contexto

Autenticação e isolamento por owner, contas, categorias e lançamentos básicos são definidos pelas SPECs 002 a 005. O modelo de produto exige uma fonte de verdade por registro e prevenção de dupla contagem. Uma transferência é uma movimentação interna entre duas contas do mesmo usuário: não constitui receita, despesa ou dois lançamentos independentes.

## 4. Problema

Sem um conceito próprio, mover dinheiro entre contas pode ser registrado como receita e despesa artificiais, distorcendo relatórios e permitindo que os dois lados divirjam. É necessário definir um registro único, atômico, rastreável e isolado por usuário.

## 5. Objetivo

Definir o contrato funcional, de dados, API, interface, saldo, concorrência e testes para transferências internas, garantindo sinais opostos nas contas, neutralidade patrimonial e ausência de impacto em receita ou despesa.

## 6. Fora do escopo

- Recorrências, transferências entre usuários, contas compartilhadas, multimoeda e câmbio.
- Tarifa, estorno formal, cancelamento, estado persistido de falha e conclusão parcial.
- Parcelamento, cartões/faturas, dívidas, orçamento, anexos, importação e IA.
- Aplicativos Android/iOS, deploy e reativação ou alteração do CI.
- Exclusão e arquivamento de transferências.
- Código, Prisma, migration, dependência, endpoint ou tela nesta unidade documental.

## 7. Termos

| Termo | Definição adotada nesta SPEC |
|---|---|
| Transferência | Registro único que move uma magnitude monetária entre duas contas próprias distintas. |
| Origem | Conta cujo saldo realizado diminui pelo valor realizado. |
| Destino | Conta cujo saldo realizado aumenta pelo mesmo valor realizado. |
| Pendente | Transferência planejada, ainda sem efeito no saldo. |
| Concluída | Transferência realizada e com efeito derivável nas duas contas. |
| Vencida | Condição derivada de uma `PENDING` cuja `dueDate` é anterior à data civil atual. |
| Owner | Usuário autenticado ao qual pertencem transferência e contas. |
| Patrimônio consolidado | Soma dos saldos realizados das contas consideradas. |

## 8. Comportamento atual

SPEC-002 define autenticação e isolamento; SPEC-003 define contas e `openingBalance`; SPEC-004 define categorias; SPEC-005 define `FinancialTransaction` de receita/despesa e seu efeito no saldo. Transferências não existem como entidade, API ou interface implementada.

## 9. Comportamento desejado

### 9.1 Modelo conceitual e garantias contra dupla contagem

- `FinancialTransfer` é a única fonte de verdade da movimentação, com uma origem e um destino.
- `FinancialTransfer != FinancialTransaction`: não possui `categoryId` nem `type INCOME/EXPENSE` e não gera lançamentos artificiais para representar seus lados.
- Relatórios de receita e despesa ignoram transferências; o cálculo do saldo de conta agrega separadamente lançamentos e transferências.
- O mesmo `actualAmount` concluído é subtraído da origem e somado ao destino. Não existem valores independentes para cada lado.
- `currentBalance` não é persistido. Logo, concluir ou reabrir altera somente o estado único da transferência; os saldos são derivados desse estado.

### 9.2 Estados, datas e valores

- `status` é enum fechado `PENDING | COMPLETED`. `CANCELLED`, `REVERSED`, `FAILED`, `PARTIALLY_COMPLETED` e recorrência são rejeitados ou inexistentes nesta versão.
- `PENDING` exige `actualAmount=null` e `completedAt=null`; `COMPLETED` exige `actualAmount>0` e `completedAt` presente.
- `plannedAmount` é obrigatório e positivo. Valores seguem a regra estrita da SPEC-005: string sem sinal, expoente ou milhar, de `0.01` a `99999999999999999.99`, regex `^(?:0|[1-9][0-9]{0,16})\.[0-9]{1,2}$`.
- Respostas monetárias têm exatamente duas casas. Banco usa `Decimal(19,2)`; número JSON, `float`/`double`, sinal negativo, coerção aproximada e arredondamento silencioso são proibidos.
- `dueDate` e `completedAt` são datas gregorianas existentes em `YYYY-MM-DD`, persistidas como `@db.Date` e devolvidas sem deslocamento de timezone.
- “Vencida” é derivada com relógio controlável: somente `PENDING` com `dueDate` anterior à data civil atual; hoje não está vencida.

### 9.3 Texto

- `description`: string obrigatória, trim, 1 a 200 pontos de código, sem caracteres de controle ou quebra de linha, sempre texto simples.
- `notes`: opcional; omissão ou `null` resulta em `null`; recebe trim, aceita até 2.000 pontos de código e quebras de linha; vazia após trim vira `null`.
- Controles além das quebras de linha permitidas são rejeitados. Clientes renderizam texto, nunca HTML executável.

### 9.4 Contas e ciclo de vida

- Origem e destino são obrigatórias, distintas, próprias e ativas ao criar ou atribuir nova relação.
- `userId` é sempre derivado do token. IDs de contas vêm do cliente, mas são resolvidos conjuntamente com o owner.
- Conta alheia ou inexistente retorna `404` indistinguível. Conta própria arquivada retorna conflito e não participa de nova transferência.
- Arquivamento posterior de uma conta preserva a transferência e seu efeito histórico. FKs restringem exclusão física.
- Não há `DELETE` nem arquivamento de transferência nesta versão.

### 9.5 Transições e edição

- A criação aceita `PENDING` ou `COMPLETED`, desde que todos os campos sejam coerentes.
- `POST /api/transfers/:id/complete` faz `PENDING -> COMPLETED` e exige exatamente `actualAmount` e `completedAt`.
- Repetição em `COMPLETED` com valores canônicos idênticos retorna `200` sem alterar `updatedAt`; valores divergentes retornam `409 TRANSFER_ALREADY_COMPLETED`.
- `POST /api/transfers/:id/reopen` faz `COMPLETED -> PENDING`, limpando `actualAmount` e `completedAt`. Repetição em `PENDING` retorna `200` sem alterar `updatedAt`.
- Em `PENDING`, PATCH aceita `description`, `notes`, `plannedAmount`, `dueDate`, `sourceAccountId` e `destinationAccountId`. Em `COMPLETED`, aceita somente `description` e `notes`.
- PATCH proíbe `actualAmount`, `completedAt`, `status`, `id`, `userId`, `createdAt`, `updatedAt` e campos desconhecidos. Alteração financeira em concluída exige `reopen`.
- Transições e PATCH usam transação PostgreSQL e atualização condicional, com isolamento serializável ou garantia equivalente comprovada.

### 9.6 Efeito no saldo realizado

Para uma conta `A`:

```text
saldoRealizado(A)
  = openingBalance(A)
  + soma(actualAmount de FinancialTransaction PAID INCOME de A)
  - soma(actualAmount de FinancialTransaction PAID EXPENSE de A)
  - soma(actualAmount de FinancialTransfer COMPLETED cuja origem é A)
  + soma(actualAmount de FinancialTransfer COMPLETED cujo destino é A)
```

- `PENDING` não afeta saldo. `COMPLETED` afeta ambas as contas uma única vez e pelo mesmo `actualAmount`.
- Concluir inclui os sinais opostos; reabrir remove logicamente ambos ao tirar o registro do conjunto `COMPLETED`.
- Para origem e destino consideradas juntas, a variação é `-actualAmount + actualAmount = 0`; o patrimônio consolidado não muda.
- Totais de receita e despesa não mudam. `plannedAmount` nunca entra no saldo realizado.

### 9.7 Concorrência

- Dois `complete` simultâneos podem produzir somente uma transição; o perdedor reavalia o estado e recebe sucesso idempotente ou conflito divergente.
- Dois `reopen` simultâneos resultam em `PENDING`, sem efeito residual e sem atualizações físicas duplicadas.
- `complete` versus `reopen` deve ser serializado sobre o mesmo registro; o resultado corresponde a uma ordem válida completa, nunca a estado híbrido.
- PATCH concorrente usa atualização condicional/controle de concorrência para não contornar as permissões do estado; conflito detectado não produz perda silenciosa.
- Arquivamento concorrente de conta e criação/PATCH financeiro deve serializar validação e escrita: ou a referência é criada enquanto ativa e o arquivamento posterior preserva histórico, ou a nova referência é rejeitada.
- Como saldo não é materializado, a atomicidade protege a coerência do único `FinancialTransfer`, não duas escritas de saldo.

## 10. Personas ou atores

| Ator | Necessidade | Ações autorizadas |
|---|---|---|
| Usuário autenticado | Mover e acompanhar valores entre contas próprias. | Criar, listar, consultar, editar, concluir e reabrir transferências próprias. |
| Visitante/sessão inválida | Nenhuma sobre dados financeiros. | Autenticar-se; não recebe transferências. |

## 11. Fluxos

### 11.1 Fluxo principal

1. O usuário autenticado abre `/transfers` e recebe a primeira página.
2. Seleciona uma origem ativa e um destino ativo diferente.
3. Informa descrição, valor previsto, vencimento e, se concluída, valor realizado e conclusão.
4. A API deriva o owner, valida o DTO e as duas contas e persiste um único registro.
5. A interface exibe estados, valores e a condição derivada de vencida.
6. O usuário conclui uma pendente ou reabre uma concluída; o saldo derivado reflete atomicamente os dois lados.

### 11.2 Fluxos alternativos e exceções

- Conta inexistente/alheia → `404`, sem revelar owner ou existência.
- Conta própria arquivada → `409 RELATED_ACCOUNT_ARCHIVED`.
- Origem igual ao destino → `400 VALIDATION_ERROR`.
- Estado, valor, data ou corpo incoerente → `400`, sem persistência parcial.
- Retentativa divergente de conclusão → `409 TRANSFER_ALREADY_COMPLETED`.
- Sessão ausente/expirada → `401`; web redireciona ao login sem exibir dados privados.
- API indisponível → web não indica sucesso, preserva entrada segura e permite tentar novamente.

## 12. Regras de negócio

| ID | Regra | Origem/decisão | Exemplo |
|---|---|---|---|
| `RN-01` | Transferência é entidade única, distinta de lançamento. | Tarefa/princípios do produto | Nenhum lançamento lateral. |
| `RN-02` | Origem e destino são próprias, ativas e diferentes. | Tarefa/SPEC-002/003 | `A -> A` falha. |
| `RN-03` | Estados aceitos são somente `PENDING` e `COMPLETED`. | Tarefa | `CANCELLED` falha. |
| `RN-04` | Valores são magnitudes positivas decimais exatas. | Tarefa/SPEC-005/ADR-004 | `"10.00"`. |
| `RN-05` | Estado determina nulabilidade de realizado e conclusão. | Tarefa | Pendente possui ambos nulos. |
| `RN-06` | Datas financeiras são civis estritas. | Tarefa/SPEC-005 | `2028-02-29` é válida. |
| `RN-07` | Somente concluídas afetam ambos os saldos pelo realizado. | Tarefa | `-10.00` e `+10.00`. |
| `RN-08` | Transferência é neutra para patrimônio, receita e despesa. | Tarefa | Consolidado varia zero. |
| `RN-09` | Concluir e reabrir obedecem à idempotência definida. | Tarefa | Retentativa não duplica. |
| `RN-10` | Vencida é condição derivada, não estado persistido. | Tarefa | Pendente de ontem. |
| `RN-11` | Arquivamento posterior preserva histórico. | Tarefa/SPEC-003 | Consulta continua disponível. |
| `RN-12` | Owner deriva do token e integra toda consulta. | Tarefa/SPEC-002 | `userId` público é proibido. |
| `RN-13` | Não se persiste `currentBalance`. | Tarefa/SPEC-003/005 | Saldo calculado. |
| `RN-14` | Não há exclusão nem arquivamento da transferência. | Tarefa | Sem rota DELETE. |

## 13. Modelo de dados

### 13.1 Entidade conceitual e Prisma futuro

| Entidade | Campo | Tipo conceitual/futuro | Obrigatório | Regra |
|---|---|---|---|---|
| `FinancialTransfer` | `id` | UUID | Sim | PK gerada pelo servidor. |
| `FinancialTransfer` | `userId` | UUID | Sim | FK `User`, somente interna. |
| `FinancialTransfer` | `sourceAccountId` | UUID | Sim | FK de origem `FinancialAccount`. |
| `FinancialTransfer` | `destinationAccountId` | UUID | Sim | FK de destino distinta. |
| `FinancialTransfer` | `status` | `PENDING \| COMPLETED` | Sim | Enum fechado. |
| `FinancialTransfer` | `description` | `String`/`varchar(200)` | Sim | Texto validado. |
| `FinancialTransfer` | `notes` | `String?`/`varchar(2000)` | Não | Texto simples ou `null`. |
| `FinancialTransfer` | `plannedAmount` | `Decimal @db.Decimal(19,2)` | Sim | Maior que zero. |
| `FinancialTransfer` | `actualAmount` | `Decimal? @db.Decimal(19,2)` | Não | Positivo somente em concluída. |
| `FinancialTransfer` | `dueDate` | `DateTime @db.Date` | Sim | Data civil. |
| `FinancialTransfer` | `completedAt` | `DateTime? @db.Date` | Não | Presente somente em concluída. |
| `FinancialTransfer` | `createdAt` | `DateTime @default(now()) @db.Timestamptz(3)` | Sim | Instante do servidor. |
| `FinancialTransfer` | `updatedAt` | `DateTime @updatedAt @db.Timestamptz(3)` | Sim | Preservado em no-op idempotente. |

Relações futuras: `FinancialTransfer.user`, `.sourceAccount` e `.destinationAccount`, com duas relações Prisma nomeadas e inversas distintas em `FinancialAccount`. Todas as FKs usam `ON DELETE RESTRICT`.

### 13.2 Migration futura, constraints e índices

- Criar migration nova e aditiva, sem editar migrations anteriores.
- Checks: `sourceAccountId <> destinationAccountId`; `plannedAmount > 0`; `actualAmount IS NULL OR actualAmount > 0`; e `(status='PENDING' AND actualAmount IS NULL AND completedAt IS NULL) OR (status='COMPLETED' AND actualAmount IS NOT NULL AND completedAt IS NOT NULL)`.
- Coerência do owner das três entidades e atividade das contas é garantida transacionalmente pelo serviço e testada com PostgreSQL.
- Índice de paginação `(userId, dueDate DESC, createdAt DESC, id)`.
- Índices `(userId, sourceAccountId, dueDate)`, `(userId, destinationAccountId, dueDate)`, `(userId, status, dueDate)` e `(userId, completedAt)` atendem owner, origem, destino, estado e datas; índices redundantes dependem de `EXPLAIN` na implementação.
- Não criar `categoryId`, `type`, linhas laterais de `FinancialTransaction` ou `currentBalance`.

## 14. Contratos de API

Todas as rotas exigem `Authorization: Bearer`. Bodies e queries usam DTOs explícitos, whitelist e rejeição de campos desconhecidos; nenhum body é repassado ao ORM. JSON é obrigatório quando há body.

### 14.1 Contratos compartilhados

```ts
type FinancialTransferStatus = 'PENDING' | 'COMPLETED';

type PublicFinancialTransfer = {
  id: string;
  sourceAccountId: string;
  destinationAccountId: string;
  status: FinancialTransferStatus;
  description: string;
  notes: string | null;
  plannedAmount: string;
  actualAmount: string | null;
  dueDate: string;
  completedAt: string | null;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
};

type CreateFinancialTransferRequest = {
  sourceAccountId: string;
  destinationAccountId: string;
  status: FinancialTransferStatus;
  description: string;
  notes?: string | null;
  plannedAmount: string;
  actualAmount?: string | null;
  dueDate: string;
  completedAt?: string | null;
};

type UpdateFinancialTransferRequest = {
  description?: string;
  notes?: string | null;
  plannedAmount?: string;
  dueDate?: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
};

type CompleteFinancialTransferRequest = {
  actualAmount: string;
  completedAt: string;
};

type TransferListQuery = {
  sourceAccountId?: string;
  destinationAccountId?: string;
  accountId?: string;
  status?: FinancialTransferStatus;
  dueDateFrom?: string;
  dueDateTo?: string;
  completedAtFrom?: string;
  completedAtTo?: string;
  limit?: string;
  cursor?: string;
};

type PaginatedFinancialTransfersResponse = {
  data: PublicFinancialTransfer[];
  page: { limit: number; nextCursor: string | null };
};
```

`userId` não aparece publicamente. `createdAt`/`updatedAt` são ISO 8601 UTC; datas financeiras são `YYYY-MM-DD`. Erros usam o envelope da API. Códigos: `VALIDATION_ERROR`/`INVALID_CURSOR` (`400`), `UNAUTHORIZED` (`401`), `NOT_FOUND` (`404`), `RELATED_ACCOUNT_ARCHIVED`, `TRANSFER_ALREADY_COMPLETED`, `COMPLETED_TRANSFER_REQUIRES_REOPEN`, `CONCURRENT_MODIFICATION` (`409`) e `INTERNAL_ERROR` (`500`).

### 14.2 Criar — `POST /api/transfers`

- Entrada: exatamente `CreateFinancialTransferRequest`, sem query; `status` explícito.
- `PENDING` aceita `actualAmount`/`completedAt` somente omitidos ou nulos. `COMPLETED` exige ambos válidos.
- Sucesso: `201` com projeção pública. Não idempotente: cada sucesso cria um UUID.
- Erros: `400`, `401`, `404` para conta inexistente/alheia, `409` para arquivada e `500`.

### 14.3 Listar — `GET /api/transfers`

- Entrada: somente `TransferListQuery`. Filtros combinam por `AND`; limites de datas são inclusivos; início posterior ao fim dá `400`. Intervalo de `completedAt` exclui pendentes.
- `accountId` significa `(sourceAccountId = accountId OR destinationAccountId = accountId)`. Quando combinado com filtros de origem/destino, aplica-se `AND` entre grupos.
- IDs de conta inexistentes/alheios em query produzem página vazia, sem confirmar existência. Toda consulta começa por `userId` do token.
- Ordem fixa: `dueDate DESC`, `createdAt DESC`, `id ASC`. Paginação por cursor obrigatória, `limit` de 1 a 100 e padrão 20.
- Cursor é opaco, URL-safe e autenticado/assinado, contém a tríade de posição e impressão de todos os filtros e limite. Inválido, adulterado ou reutilizado com parâmetros diferentes dá `400 INVALID_CURSOR`.
- Buscar até `limit + 1`, devolver até `limit`, sem total global; vazio: `{data: [], page: {limit, nextCursor: null}}`.

### 14.4 Consultar — `GET /api/transfers/:id`

- Entrada: UUID; body/query proibidos. Sucesso `200`, inclusive após arquivamento posterior de conta.
- UUID inválido, inexistente ou alheio retorna o mesmo `404`; sem autenticação `401`.
- Leitura é idempotente para o mesmo estado e data civil.

### 14.5 Editar — `PATCH /api/transfers/:id`

- Entrada: ao menos um campo de `UpdateFinancialTransferRequest`; campos desconhecidos e campos internos/estado/realização dão `400`.
- `PENDING` permite todos os campos do DTO, revalidando owner, atividade e diferença entre contas. `COMPLETED` permite somente `description`/`notes`; demais dão `409 COMPLETED_TRANSFER_REQUIRES_REOPEN`, mesmo se iguais.
- Sucesso `200`. Body canonicamente igual é no-op sem alteração física. Concorrência detectada retorna `409 CONCURRENT_MODIFICATION`, sem perda silenciosa.

### 14.6 Concluir — `POST /api/transfers/:id/complete`

- Entrada: exatamente `CompleteFinancialTransferRequest`; query e campos adicionais proibidos.
- Sucesso `200`, com `COMPLETED`; o estado passa a participar uma vez dos dois lados do saldo derivado.
- Se concluída, mesmos valores canônicos retornam `200` preservando `updatedAt`; qualquer diferença retorna `409 TRANSFER_ALREADY_COMPLETED`.
- Operação transacional, condicional e segura sob concorrência; erros `400`, `401`, `404`, `409`, `500`.

### 14.7 Reabrir — `POST /api/transfers/:id/reopen`

- Body e query proibidos. Sucesso `200`, com `PENDING`, `actualAmount=null`, `completedAt=null`.
- Se já pendente, retorna `200` e preserva `updatedAt`.
- A transição atômica remove uma vez os dois sinais do saldo derivado; erros `400`, `401`, `404`, `409` concorrente e `500`.

Não existe rota `DELETE /api/transfers/:id`.

## 15. Interface

- Rota protegida `/transfers`, responsiva, acessível e integrada à navegação autenticada.
- Listagem paginada na ordem da API; filtros por origem, destino, conta participante, status e intervalos de vencimento/conclusão reiniciam o cursor.
- Estado vazio diferencia ausência total e ausência para filtros, oferecendo criar ou limpar filtros.
- Formulário exibe somente contas ativas, origem e destino, descrição, notas, previsto, realizado conforme status, `dueDate` e `completedAt`; nenhuma categoria aparece.
- Após escolher origem, o destino exclui essa conta; validação também ocorre na API.
- Ações `Concluir` e `Reabrir` seguem as transições. Edição bloqueia campos financeiros em concluída e orienta reabrir.
- Indicador `Vencida` aparece somente na condição derivada e não substitui `PENDING`.
- Loading impede submissão repetida; falha da API não simula sucesso, preserva entrada segura e oferece nova tentativa.
- Celular e desktop mantêm rótulos, foco, teclado, contraste e anúncios acessíveis; sentido da movimentação não depende somente de cor/sinal.

## 16. Validações

| Campo ou ação | Validação | Mensagem/resultado esperado |
|---|---|---|
| Contas | UUIDs próprias, ativas, obrigatórias e distintas. | `400`, `404` ou `409`; nada persistido. |
| `status` | Somente enum na criação; proibido no PATCH. | `400`; usar complete/reopen. |
| `description` | Trim, 1–200 pontos, sem controles/quebras. | `400`. |
| `notes` | Nulo/omitido ou até 2.000 pontos; vazio vira nulo. | `400` se inválida. |
| Valores | String decimal positiva estrita da seção 9.2. | `400`, sem arredondar. |
| Datas | Data gregoriana estrita `YYYY-MM-DD`. | `400`. |
| Coerência | Pendente sem realizado/conclusão; concluída com ambos. | `400`, sem escrita parcial. |
| PATCH | Não vazio, whitelist e permissão pelo estado. | `400`/`409`. |
| Intervalos | Início menor ou igual ao fim. | `400`. |
| Paginação | Limite 1–100; cursor autêntico e vinculado. | `400 INVALID_CURSOR`. |
| Campos desconhecidos | Sempre rejeitados, sem mass assignment. | `400`, nenhuma alteração. |

## 17. Permissões

| Ação | Ator autorizado | Condição | Comportamento quando negado |
|---|---|---|---|
| Criar | Usuário autenticado | Ambas as contas próprias, ativas e distintas. | `401`, `404` ou `409`. |
| Listar | Usuário autenticado | Consulta sempre limitada ao owner. | `401`; nenhum dado. |
| Consultar/editar/transicionar | Usuário autenticado | Transferência própria e regras do estado. | `401`, `404` indistinguível ou `409`. |
| Excluir | Ninguém | Ação inexistente nesta versão. | Rota não exposta (`404`/`405` conforme roteador). |

## 18. Segurança e privacidade

- Dados envolvidos: metadados financeiros pessoais, descrições, notas, contas, valores e datas.
- Ameaças: IDOR, mass assignment, enumeração de recursos, injeção, XSS, vazamento em logs, corrida e dupla contagem.
- Proteções: autenticação em todas as rotas; owner derivado do token; toda busca e mutação inclui owner; ambas as contas resolvidas pelo owner; DTOs explícitos; validação no backend; texto renderizado com escape; transações/updates condicionais.
- Recurso ou conta alheia é indistinguível de inexistente. Nenhuma consulta de negócio pode omitir owner.
- Não registrar token, senha, notas, descrição, valores, saldos ou payload financeiro. Autenticação, CSRF e CORS permanecem inalterados.

## 19. Erros e estados vazios

| Situação | Estado apresentado | Recuperação esperada |
|---|---|---|
| Sem transferências | Lista vazia explicativa. | Criar transferência. |
| Filtros sem resultado | Estado específico. | Limpar/alterar filtros. |
| Validação | Mensagem junto ao campo, sem sucesso falso. | Corrigir e reenviar. |
| Conflito de estado/concorrência | Estado mais recente e mensagem segura. | Recarregar; reabrir quando necessário. |
| API indisponível | Erro não destrutivo. | Preservar entrada segura e tentar novamente. |
| Sessão inválida | Nenhum dado privado. | Redirecionar ao login. |

## 20. Observabilidade

- Registrar evento técnico sanitizado de criação, conclusão, reabertura e conflito com identificador de correlação e resultado; IDs devem ser minimizados/pseudonimizados conforme padrão futuro.
- Métricas agregadas podem contar latência, erro por código, conflito e retentativa, sem valores ou conteúdo financeiro.
- Nunca registrar bodies, tokens, descrições, notas, valores, saldos ou SQL/stack em resposta. Alertas operacionais são definidos somente se métricas demonstrarem necessidade.

## 21. Migração e compatibilidade

- Dados existentes: permanecem inalterados; nenhum lançamento é convertido.
- Compatibilidade: APIs e relatórios de lançamentos preservam seus contratos; saldo passa futuramente a agregar o novo domínio.
- Migration necessária na implementação futura: sim, nova e aditiva, conforme seção 13.2; migrations anteriores intactas.
- Implantação gradual: schema aditivo antes da API/web. Nesta tarefa documental, não aplicável executar migration ou deploy.

## 22. Critérios de aceite

### `CA-01 — Criar pendente`
**Dado** duas contas próprias ativas **Quando** crio uma transferência `PENDING` coerente **Então** um único registro é criado com realizado e conclusão nulos.

### `CA-02 — Criar concluída`
**Dado** duas contas próprias ativas **Quando** crio uma transferência `COMPLETED` com realizado e conclusão **Então** o registro nasce concluído e afeta ambos os saldos.

### `CA-03 — Mesma conta`
**Dado** uma conta própria **Quando** envio seu ID como origem e destino **Então** recebo `400` e nada é criado.

### `CA-04 — Origem alheia`
**Dado** uma origem de outro usuário **Quando** tento criar **Então** recebo `404` indistinguível.

### `CA-05 — Destino alheio`
**Dado** um destino de outro usuário **Quando** tento criar **Então** recebo o mesmo `404` indistinguível.

### `CA-06 — Conta arquivada`
**Dado** uma das contas própria e arquivada **Quando** tento criar ou atribuí-la por PATCH **Então** recebo `409` e não crio nova relação.

### `CA-07 — Histórico após arquivamento`
**Dado** transferência existente **Quando** uma conta é arquivada depois **Então** consulta e efeito histórico são preservados.

### `CA-08 — Previsto obrigatório e positivo`
**Dado** uma criação **Quando** omito, zero ou negativo `plannedAmount` **Então** recebo `400`.

### `CA-09 — Decimal estrito`
**Dado** um valor numérico JSON, com expoente, sinal ou mais de duas casas **Quando** envio **Então** recebo `400` sem arredondamento.

### `CA-10 — Preservação decimal`
**Dado** o valor válido `"10.1"` **Quando** persisto e consulto **Então** recebo `"10.10"` exatamente.

### `CA-11 — Pendente incoerente`
**Dado** status `PENDING` **Quando** envio realizado ou conclusão não nulos **Então** recebo `400`.

### `CA-12 — Concluída incompleta`
**Dado** status `COMPLETED` **Quando** omito realizado ou conclusão **Então** recebo `400`.

### `CA-13 — Data civil inválida`
**Dado** uma data inexistente ou fora de `YYYY-MM-DD` **Quando** envio **Então** recebo `400` sem ajuste de timezone.

### `CA-14 — Ano bissexto`
**Dado** `2028-02-29` **Quando** envio como data **Então** ela é aceita e devolvida sem deslocamento.

### `CA-15 — Texto`
**Dado** descrição vazia/com quebra ou notas acima do limite **Quando** envio **Então** recebo `400`; notas vazias válidas normalizam para nulo.

### `CA-16 — Listagem isolada e ordenada`
**Dado** transferências de usuários diferentes **Quando** listo **Então** vejo somente as minhas na ordem determinística.

### `CA-17 — Filtros de origem e destino`
**Dado** transferências variadas **Quando** filtro por origem e/ou destino **Então** recebo somente correspondências próprias, combinadas por `AND`.

### `CA-18 — Filtro accountId`
**Dado** uma conta que participa nos dois papéis **Quando** filtro por `accountId` **Então** recebo transferências em que ela é origem ou destino, sem duplicatas.

### `CA-19 — Filtros de estado e datas`
**Dado** estados e datas variados **Quando** aplico estado e intervalos inclusivos **Então** recebo somente correspondências.

### `CA-20 — Primeira página`
**Dado** mais de 20 resultados **Quando** listo sem limite **Então** recebo até 20 e cursor quando há continuação.

### `CA-21 — Continuação paginada`
**Dado** um cursor válido **Quando** solicito a próxima página **Então** não recebo omissões nem duplicatas na ordenação estável.

### `CA-22 — Cursor inválido ou filtros alterados`
**Dado** cursor adulterado ou vinculado a outros parâmetros **Quando** reutilizo **Então** recebo `400 INVALID_CURSOR`.

### `CA-23 — Estado vazio`
**Dado** nenhuma correspondência **Quando** listo **Então** recebo lista vazia paginada e estado de interface adequado.

### `CA-24 — Consulta própria`
**Dado** transferência própria **Quando** consulto seu UUID **Então** recebo a projeção sem `userId`.

### `CA-25 — Consulta alheia`
**Dado** UUID alheio ou inexistente **Quando** consulto **Então** recebo o mesmo `404`.

### `CA-26 — PATCH pendente`
**Dado** transferência pendente **Quando** edito texto, previsto, vencimento ou contas com dados válidos **Então** a alteração é aplicada.

### `CA-27 — PATCH concluída textual`
**Dado** transferência concluída **Quando** edito somente descrição/notas **Então** a alteração é aplicada sem mudar o efeito financeiro.

### `CA-28 — PATCH financeiro concluído`
**Dado** transferência concluída **Quando** envio campo financeiro permitido somente em pendente **Então** recebo `409` e devo reabrir.

### `CA-29 — Mass assignment`
**Dado** qualquer transferência **Quando** PATCH contém estado, realizado, conclusão, campo interno ou desconhecido **Então** recebo `400` sem alteração.

### `CA-30 — Concluir pendente`
**Dado** transferência pendente **Quando** concluo com realizado e data válidos **Então** ela fica concluída atomicamente.

### `CA-31 — Complete idempotente`
**Dado** transferência já concluída **Quando** repito valores canônicos idênticos **Então** recebo `200` sem mudar `updatedAt` ou duplicar efeito.

### `CA-32 — Complete divergente`
**Dado** transferência concluída **Quando** repito com valor ou data diferente **Então** recebo `409` e o original permanece.

### `CA-33 — Reabrir concluída`
**Dado** transferência concluída **Quando** reabro **Então** ela fica pendente e realizado/conclusão viram nulos atomicamente.

### `CA-34 — Reopen idempotente`
**Dado** transferência pendente **Quando** reabro novamente **Então** recebo `200` sem mudar `updatedAt`.

### `CA-35 — Vencida`
**Dado** pendente com vencimento anterior a hoje **Quando** consulto **Então** `isOverdue=true` sem novo estado persistido.

### `CA-36 — Não vencida`
**Dado** vencimento hoje/futuro ou transferência concluída **Quando** consulto **Então** `isOverdue=false`.

### `CA-37 — Impacto na origem`
**Dado** transferência concluída de `25.00` **Quando** calculo a origem **Então** seu saldo diminui exatamente `25.00` uma vez.

### `CA-38 — Impacto no destino`
**Dado** a mesma transferência **Quando** calculo o destino **Então** seu saldo aumenta exatamente `25.00` uma vez.

### `CA-39 — Patrimônio consolidado`
**Dado** as duas contas no consolidado **Quando** concluo ou reabro **Então** a soma de seus saldos não muda.

### `CA-40 — Neutralidade de receita e despesa`
**Dado** totais conhecidos **Quando** concluo ou reabro transferência **Então** receitas e despesas permanecem idênticas.

### `CA-41 — Ausência de categoria`
**Dado** formulário e contrato de transferência **Quando** crio ou edito **Então** não existe categoria e `categoryId` é rejeitado.

### `CA-42 — Ausência de lançamento artificial`
**Dado** transferência criada/concluída **Quando** inspeciono persistência e listagem de lançamentos **Então** nenhum `FinancialTransaction` lateral foi criado.

### `CA-43 — Ausência de DELETE`
**Dado** uma transferência **Quando** tento excluí-la pela API/interface **Então** nenhuma operação de exclusão está disponível.

### `CA-44 — Sem autenticação`
**Dado** sessão ausente ou inválida **Quando** acesso qualquer rota **Então** recebo `401` e a web redireciona sem dados privados.

### `CA-45 — API indisponível`
**Dado** formulário preenchido **Quando** a API falha **Então** não há falso sucesso, a entrada segura é preservada e posso tentar novamente.

### `CA-46 — Complete concorrente`
**Dado** duas conclusões simultâneas **Quando** são processadas **Então** há uma transição e efeito único, com idempotência ou conflito conforme os corpos.

### `CA-47 — Reopen e corrida cruzada`
**Dado** reaberturas simultâneas ou complete versus reopen **Quando** concorrem **Então** o estado final equivale a uma ordem serial válida, nunca híbrida.

### `CA-48 — Arquivamento concorrente`
**Dado** arquivamento de conta concorrente à criação/PATCH **Quando** ambos executam **Então** ou a relação nasce antes e vira histórico, ou é rejeitada como arquivada.

## 23. Testes obrigatórios

| Nível | Cenários mínimos | Critérios relacionados | Evidência esperada |
|---|---|---|---|
| Unitário | Contas distintas; valores/datas/texto; estados e vencida; impactos opostos; neutralidade; complete/reopen, idempotência/conflito; cursor/paginação. | CA-03, CA-08–15, CA-20–22, CA-30–40 | Testes determinísticos, relógio controlado e decimais exatos. |
| Integração PostgreSQL | Migration/constraints/FKs; owner/arquivadas; criação/listagem/filtros/accountId; paginação; PATCH/transições; concorrência; histórico; migrations intactas. | CA-01–34, CA-42, CA-46–48 | Banco real controlado, transações e inspeção de schema/linhas. |
| Contrato | DTOs, projeções, códigos, strings decimais, datas, filtros, cursor, ausência de categoria/userId/DELETE. | CA-01–32, CA-41, CA-43–44 | Requests/responses e OpenAPI/testes de contrato compatíveis. |
| Web | Vazio; criação; origem/destino; filtros/paginação; complete/reopen; vencida; API indisponível; redirecionamento; responsividade. | CA-01–03, CA-16–23, CA-26–36, CA-41, CA-44–45 | Testes de componentes com API e relógio controlados. |
| E2E | Login; criar; concluir; verificar os dois saldos e totais neutros; reabrir; logout. | CA-30, CA-33, CA-37–40, CA-44 | Playwright com dados fictícios e evidência sanitizada. |
| Aceitação manual | Clareza dos lados, bloqueio de mesma conta, transições, filtros, vazio, indisponibilidade e mobile. | CA-01–03, CA-16–23, CA-30–36, CA-41, CA-45 | Checklist e capturas sanitizadas; exigida na implementação de interface. |

Testes futuros devem cobrir explicitamente virada de mês/ano, ano bissexto, limite monetário, zero/negativo, nenhum arredondamento, soma consolidada antes/depois e concorrência repetível. Nesta unidade exclusivamente documental, testes de runtime são não aplicáveis.

## 24. Arquivos permitidos

Nesta tarefa de criação e aprovação da SPEC:

- `docs/specs/SPEC-006-TRANSFERENCIAS-ENTRE-CONTAS.md`.

Uma implementação futura exige unidade própria e SPEC aprovada; poderá então autorizar explicitamente módulos, schema/migration aditiva, contratos compartilhados, web e testes correspondentes. Esta seção não autoriza esses arquivos agora.

## 25. Arquivos proibidos

- Todo arquivo diferente de `docs/specs/SPEC-006-TRANSFERENCIAS-ENTRE-CONTAS.md` nesta tarefa.
- Código, Prisma/schema, migrations, dependências, autenticação, contas, categorias, lançamentos, CI, produto, ADRs e SPECs anteriores.
- Em implementação futura, migrations anteriores continuam proibidas de edição e o workflow de CI não pode ser reativado por esta SPEC.

## 26. Dependências

| Dependência | Motivo | Estado da aprovação | Impacto |
|---|---|---|---|
| SPEC-002 | Autenticação, owner e isolamento. | Aprovada/existente | Toda rota e consulta herda isolamento. |
| SPEC-003 | Contas, arquivamento e saldo inicial. | Aprovada/existente | Define participantes e base do saldo. |
| SPEC-004 | Separação das categorias. | Aprovada/existente | Confirma que transferência não categoriza. |
| SPEC-005 | Decimais, datas, lançamentos, saldo e cursor. | Aprovada/existente | Contratos consistentes e agregação conjunta. |
| ADR-001 a ADR-006 | Arquitetura, cliente, backend, persistência, repositório e testes. | Aprovadas | Orientam implementação futura. |
| Nova dependência de software | Não necessária para a documentação. | Não aplicável | Nenhuma adicionada. |

## 27. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Dupla contagem como lançamentos | Média | Totais falsos | Entidade única, ausência de linhas laterais e testes de invariantes. |
| Sinal invertido ou apenas um lado | Média | Saldo incorreto | Fórmula explícita e testes antes/depois nas duas contas. |
| Precisão/arredondamento | Média | Divergência monetária | Decimal exato e validação estrita da SPEC-005. |
| Corrida de transições | Média | Estado/efeito duplicado | Transação, update condicional/serializável e testes PostgreSQL. |
| IDOR/enumeração | Média | Vazamento financeiro | Owner em toda consulta, DTOs e `404` indistinguível. |
| Arquivamento concorrente | Baixa | Nova relação inválida | Serialização entre validação e escrita, histórico preservado. |
| Cursor inconsistente | Baixa | Duplicação/omissão | Ordenação determinística e cursor assinado vinculado a filtros. |
| Datas e timezone | Média | Vencimento incorreto | `@db.Date`, `YYYY-MM-DD` e relógio controlado. |

Riscos residuais: custo de agregação do saldo sem materialização e contenção em concorrência elevada devem ser medidos na implementação; não justificam cache, saldo persistido ou mudança arquitetural silenciosa.

## 28. Rollback

Para esta unidade documental, reverter o commit remove somente a SPEC. Uma implementação futura deverá: desabilitar primeiro web/API, preservar dados financeiros, reverter código por `git revert` e somente remover schema se houver aprovação explícita e comprovação de ausência/preservação de dados. Migration destrutiva automática não é autorizada.

## 29. Dúvidas

| ID | Dúvida | Impacto | Responsável | Estado |
|---|---|---|---|---|
| `D-01` | Os marcadores `//` do enunciado representam o parâmetro `:id`? | Contrato das transições. | Produto | Resolvida: os endpoints canônicos são `/api/transfers/:id/complete` e `/api/transfers/:id/reopen`, coerentes com as operações por recurso e SPEC-005. |

Não há dúvida aberta que altere comportamento, escopo, dados, segurança ou dependências.

## 30. Decisões aprovadas

| Data | Decisão | Responsável pela aprovação | Consequência |
|---|---|---|---|
| 2026-08-07 | Aprovar a SPEC inicialmente com entidade única `FinancialTransfer`. | Responsável do produto, via tarefa | Autoriza futura implementação separada, não esta tarefa. |
| 2026-08-07 | Usar somente `PENDING` e `COMPLETED`, com complete/reopen atômicos. | Responsável do produto, via tarefa | Sem cancelamento, falha persistida ou recorrência. |
| 2026-08-07 | Derivar saldo com sinais opostos e neutralidade de receita/despesa. | Responsável do produto, via tarefa | Previne dupla contagem e saldo materializado. |
| 2026-08-07 | Adotar os contratos decimais, datas e cursor da SPEC-005. | Responsável do produto, via tarefa | Consistência entre domínios financeiros. |

## 31. Definition of Done específica

### Para esta unidade documental

- [x] Somente o arquivo autorizado foi criado.
- [x] Modelo conceitual, estados, transições, saldo, dupla contagem, segurança, concorrência e riscos estão definidos.
- [x] Contratos futuros de dados, API, web, migration e testes estão explícitos sem implementação.
- [x] Há pelo menos 37 critérios Dado/Quando/Então (48 definidos).
- [x] A SPEC está marcada como `Aprovada` pela autorização rastreável da tarefa.
- [x] Verificações documentais aplicáveis foram executadas; lint, typecheck, testes de runtime e build são não aplicáveis a conteúdo Markdown isolado.

### Para implementação futura

- [ ] Migration aditiva e constraints testadas em PostgreSQL; migrations anteriores intactas.
- [ ] Lint, typecheck, testes unitários, integração, contrato, web e E2E aplicáveis aprovados.
- [ ] Atomicidade, concorrência, isolamento por owner e invariantes financeiros comprovados.
- [ ] Todos os critérios de aceite automatizáveis atendidos e aceitação manual da interface registrada.
- [ ] Nenhum `FinancialTransaction` artificial, categoria, DELETE ou `currentBalance` introduzido.

## 32. Histórico de alterações da SPEC

| Data | Alteração | Motivo | Autor | Aprovador, quando aplicável |
|---|---|---|---|---|
| 2026-08-07 | Criação da SPEC-006 com status inicial aprovado. | Definir transferências internas antes de qualquer implementação. | Equipe PlannerFin | Responsável do produto, via tarefa |
