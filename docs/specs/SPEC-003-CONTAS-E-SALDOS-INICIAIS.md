# SPEC de funcionalidade — `SPEC-003 — Contas financeiras e saldos iniciais`

> Esta SPEC aprova somente uma implementação futura. Esta unidade é exclusivamente documental e não cria código, Prisma, migration, dependência, endpoint ou tela.

## 1. Identificação

| Campo | Valor |
|---|---|
| ID | `SPEC-003` |
| Título | `Contas financeiras e saldos iniciais` |
| Responsável | `Codex Cloud` |
| Data de criação | `2026-08-07` |
| Última atualização | `2026-08-07` |
| Tarefa relacionada | `PROMPT-SPEC-003-CONTAS-E-SALDOS-INICIAIS.md` |
| Documentos relacionados | `docs/specs/README.md`; `docs/specs/SPEC-002-AUTENTICACAO-E-ISOLAMENTO-POR-USUARIO.md`; `docs/process/GIT-WORKFLOW.md`; `docs/quality/DEFINITION-OF-DONE.md`; `docs/quality/TEST-STRATEGY.md`; documentos de produto; `ADR-003`, `ADR-004` e `ADR-006` |

## 2. Status

`Aprovada`

**Aprovada por:** tarefa `PROMPT-SPEC-003-CONTAS-E-SALDOS-INICIAIS.md`, em `2026-08-07`.

## 3. Contexto

O PlannerFin já possui autenticação e isolamento por usuário definidos e implementados pela SPEC-002. Esta é a primeira unidade funcional financeira. A configuração será manual: a planilha legada não será importada nem será fonte de dados. Cada conta pertence exatamente ao usuário autenticado e sua propriedade decorre somente do access token.

PostgreSQL e Prisma são as tecnologias aprovadas, com precisão monetária, integridade referencial e migrations imutáveis. O domínio ainda não possui lançamentos; por isso, nesta versão, saldo e data iniciais pertencem à conta.

## 4. Problema

O usuário autenticado ainda não consegue registrar onde mantém recursos nem a posição de partida de cada conta. Sem um contrato explícito, a implementação poderia usar ponto flutuante, confundir saldo inicial com receita, expor contas de terceiros, criar histórico artificial ou antecipar domínios não aprovados.

## 5. Objetivo

Definir o cadastro, a leitura, a edição, o arquivamento e a reativação de contas próprias, incluindo saldo inicial manual e sua data civil, com contratos públicos exatos, isolamento por proprietário e experiência web responsiva verificáveis.

## 6. Fora do escopo

- Categorias, lançamentos, saldo atual completo, transferências, cartões, faturas, dívidas, orçamento e recorrências.
- Multimoeda, câmbio, cadastro de instituições, integração bancária e Open Finance.
- Exclusão definitiva, histórico completo de alterações e compartilhamento.
- Importação, planilha legada, IA, Android/iOS e deploy.
- Reativação ou alteração do workflow de CI.

## 7. Termos

| Termo | Definição adotada nesta SPEC |
|---|---|
| Conta financeira | Registro próprio em que o usuário mantém uma posição monetária; não inclui cartão, dívida ou investimento nesta versão. |
| Saldo inicial | Posição informada manualmente para uma conta em uma data de referência; não é receita, despesa ou lançamento. |
| Saldo atual | Posição futura calculada a partir do saldo inicial e de eventos elegíveis; não é implementado nesta unidade. |
| Data civil | Data gregoriana no formato `YYYY-MM-DD`, sem horário, fuso ou conversão UTC. |
| Conta ativa | Conta cujo `archivedAt` é nulo. |
| Conta arquivada | Conta preservada cujo `archivedAt` contém o instante do primeiro arquivamento vigente. |
| Conta pública | Projeção `PublicFinancialAccount`, que nunca contém `userId`. |

## 8. Comportamento atual

A autenticação e o contexto autenticado existem, mas não há modelo, API ou interface de contas financeiras. Não há lançamentos, categorias ou dados legados a migrar. O workflow de CI permanece desativado por decisão de custo.

## 9. Comportamento desejado

### 9.1 Conta e tipos

- O enum fechado `FinancialAccountType` aceita somente `CHECKING`, `SAVINGS`, `CASH`, `PAYMENT` e `OTHER`.
- Seus rótulos são, respectivamente, conta corrente, poupança, carteira/dinheiro, conta digital ou de pagamento e outros.
- Cartão de crédito, dívida e investimento não são contas desta SPEC.
- `name` é aparado, tem de 1 a 120 caracteres, pode se repetir e nunca identifica o recurso.
- `institution` é texto livre opcional, sem consulta externa ou entidade de banco. Quando enviado, é aparado, tem de 1 a 120 caracteres; `null` ou omissão significa ausência e string vazia é inválida.
- `currency` é obrigatoriamente a literal `BRL`; qualquer outra entrada é rejeitada.

### 9.2 Saldo inicial

- `openingBalance` é informado manualmente e aceita valor positivo, zero ou negativo entre `-99999999999999999.99` e `99999999999999999.99`, inclusive.
- O JSON transporta string decimal, nunca número. A entrada segue `^-?(0|[1-9][0-9]{0,16})(\\.[0-9]{1,2})?$`; `-0` é aceito e normalizado para `0.00`. Sinais `+`, separador de milhar, vírgula, expoente, `NaN`, `Infinity`, zeros inteiros à esquerda, mais de duas casas ou formas incompletas são inválidos.
- A persistência usa `Decimal(19,2)`, nunca `float`/`double`. A resposta usa sinal apenas para negativos e exatamente duas casas decimais.
- `openingBalanceDate` é obrigatória, deve ser uma data gregoriana existente em `YYYY-MM-DD` e permanece data civil sem horário. Datas passadas, presentes e futuras são aceitas, pois a posição pode ser preparada antecipadamente.
- O saldo inicial não cria lançamento artificial, receita ou despesa e não altera totais de receitas ou despesas.
- Até existirem lançamentos, a interface pode apresentar esse valor apenas como **Saldo inicial** ou **Posição inicial**, junto da data; não pode rotulá-lo como saldo atual.
- Armazenar valor e data na própria conta é a solução deliberadamente simples enquanto não há lançamentos. Histórico completo de mudanças dependerá de outra SPEC.

### 9.3 Ciclo de vida

- Não existe exclusão física. Arquivar preenche `archivedAt` e preserva todos os demais dados.
- A listagem padrão omite arquivadas; `includeArchived=true` inclui ativas e arquivadas.
- Arquivamento repetido e reativação repetida são idempotentes e não alteram timestamps desnecessariamente.
- Uma conta arquivada precisa ser reativada antes de edição.

### 9.4 Propriedade

- `userId` é derivado exclusivamente do `sub` validado do access token, nunca de body, query ou rota.
- Toda busca, alteração, arquivamento e reativação filtra simultaneamente por `id` e `userId`.
- ID inexistente, malformado ou pertencente a outro usuário resulta em `404 ACCOUNT_NOT_FOUND`, sem revelar existência, estado ou proprietário.

## 10. Personas ou atores

| Ator | Necessidade | Ações autorizadas |
|---|---|---|
| Usuário autenticado | Configurar e manter as próprias contas. | Criar, listar, consultar, editar, arquivar e reativar somente contas próprias. |
| Visitante | Preservar a privacidade. | Nenhuma ação; deve autenticar-se. |

## 11. Fluxos

### 11.1 Fluxo principal

1. O usuário autenticado abre `/accounts`.
2. A web lista contas ativas próprias ou apresenta o estado vazio.
3. O usuário informa nome, tipo, instituição opcional, `BRL`, saldo inicial e data.
4. A API valida o DTO, deriva o proprietário do token e persiste a conta.
5. A web apresenta a conta e identifica claramente sua posição inicial.
6. O usuário pode consultar, editar, arquivar, incluir arquivadas no filtro e reativar.

### 11.2 Fluxos alternativos e exceções

- Sem sessão → redirecionar ao login pelo fluxo existente, sem renderizar dados privados.
- Entrada inválida ou campo adicional → `400 VALIDATION_ERROR` e feedback de campo.
- Conta arquivada em edição → `409 ACCOUNT_ARCHIVED`, orientando reativação.
- Conta alheia ou inexistente → `404 ACCOUNT_NOT_FOUND` indistinguível.
- API indisponível → manter a tela segura, informar falha e oferecer nova tentativa; não simular sucesso.

## 12. Regras de negócio

| ID | Regra | Origem/decisão | Exemplo |
|---|---|---|---|
| `RN-01` | Uma conta pertence a exatamente um usuário obtido do token. | SPEC-002 e tarefa | Body com `userId` falha. |
| `RN-02` | Nomes duplicados são permitidos; somente UUID identifica. | Tarefa | Duas contas “Carteira”. |
| `RN-03` | Apenas os cinco tipos fechados são válidos. | Tarefa | `INVESTMENT` falha. |
| `RN-04` | A moeda é somente `BRL`. | Tarefa | `USD` falha. |
| `RN-05` | Dinheiro usa decimal de 19 dígitos e escala 2. | ADR-004 e tarefa | `10.10` é preservado. |
| `RN-06` | Saldo inicial não integra receita, despesa ou lançamento. | Glossário e tarefa | `-50.00` é só posição inicial. |
| `RN-07` | Arquivamento é lógico, preservador e idempotente. | Tarefa | Segundo archive mantém `archivedAt`. |
| `RN-08` | Conta arquivada não pode ser editada antes de restaurada. | Tarefa | PATCH retorna `409`. |
| `RN-09` | Recursos alheios são indistinguíveis dos inexistentes. | SPEC-002 | Ambos retornam `404`. |
| `RN-10` | A listagem é pequena, não paginada e determinística. | Uso pessoal | `name ASC`, `id ASC`. |

## 13. Modelo de dados

### 13.1 Entidade conceitual e Prisma futuro

| Entidade | Campo | Tipo conceitual/Prisma | Obrigatório | Regra |
|---|---|---|---|---|
| `FinancialAccount` | `id` | UUID / `String @id @default(uuid()) @db.Uuid` | Sim | Identificador público imutável. |
| `FinancialAccount` | `userId` | UUID / `String @db.Uuid` | Sim | Interno; nunca exposto nem aceito do cliente. |
| `FinancialAccount` | `name` | Texto / `String @db.VarChar(120)` | Sim | Trim, 1–120; não único. |
| `FinancialAccount` | `type` | Enum `FinancialAccountType` | Sim | Enum fechado desta SPEC. |
| `FinancialAccount` | `institution` | Texto / `String? @db.VarChar(120)` | Não | Texto livre aparado ou nulo. |
| `FinancialAccount` | `currency` | Código / `String @db.Char(3)` | Sim | Sempre `BRL`, com constraint no banco. |
| `FinancialAccount` | `openingBalance` | Dinheiro / `Decimal @db.Decimal(19,2)` | Sim | Limites decorrentes da precisão; sem float. |
| `FinancialAccount` | `openingBalanceDate` | Data civil / `DateTime @db.Date` | Sim | Sem componente de horário no banco/contrato. |
| `FinancialAccount` | `archivedAt` | Instante UTC / `DateTime? @db.Timestamptz(3)` | Não | Nulo quando ativa. |
| `FinancialAccount` | `createdAt` | Instante UTC / `DateTime @default(now()) @db.Timestamptz(3)` | Sim | Gerado pelo servidor. |
| `FinancialAccount` | `updatedAt` | Instante UTC / `DateTime @updatedAt @db.Timestamptz(3)` | Sim | Gerado pelo servidor. |

O modelo terá `user User @relation(fields: [userId], references: [id], onDelete: Restrict)` e `@@index([userId])`. `User` terá a relação inversa. A FK impede apagar usuário que ainda possua contas. Constraints de banco devem garantir `currency = 'BRL'` e limites coerentes; validação da API continua obrigatória.

### 13.2 Migration futura

- Criar uma migration nova, sem editar migrations anteriores, contendo enum, tabela, índice, FK `ON DELETE RESTRICT` e constraints.
- Não criar seed nem tabelas de categorias, lançamentos, cartões, dívidas ou orçamento.
- Validar em PostgreSQL real aplicação desde banco vazio e sobre o conjunto de migrations existente.

## 14. Contratos de API

Todos os endpoints usam JSON UTF-8, Bearer access token da SPEC-002 e o envelope de erro já aprovado:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Revise os dados informados.", "details": [{ "field": "name", "message": "Informe o nome da conta." }] } }
```

`details` ocorre somente em `400`, referencia apenas campos do DTO e não ecoa valores. Erros comuns: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `404 ACCOUNT_NOT_FOUND`, `409 ACCOUNT_ARCHIVED` quando aplicável e `500 INTERNAL_ERROR` genérico.

### 14.1 Contratos compartilhados

```ts
type FinancialAccountType = 'CHECKING' | 'SAVINGS' | 'CASH' | 'PAYMENT' | 'OTHER';

type PublicFinancialAccount = {
  id: string;
  name: string;
  type: FinancialAccountType;
  institution: string | null;
  currency: 'BRL';
  openingBalance: string;
  openingBalanceDate: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CreateFinancialAccountRequest = {
  name: string;
  type: FinancialAccountType;
  institution?: string | null;
  currency: 'BRL';
  openingBalance: string;
  openingBalanceDate: string;
};

type UpdateFinancialAccountRequest = Partial<CreateFinancialAccountRequest>;
type ListFinancialAccountsResponse = PublicFinancialAccount[];
```

No update, o objeto deve conter ao menos um dos seis campos declarados. Nenhum contrato compartilhado contém tipo Prisma ou `userId`. O envelope de erro e seus detalhes podem reutilizar o contrato compartilhado aprovado pela SPEC-002 quando usados por API e web.

### 14.2 Criar conta

- Método e rota: `POST /api/accounts`.
- Autenticação: Bearer obrigatório; proprietário derivado do token.
- Corpo: `CreateFinancialAccountRequest`; todos os campos, exceto `institution`, são obrigatórios; campos adicionais são proibidos.
- Sucesso: `201` com `PublicFinancialAccount`.
- Validações: seções 9 e 16.
- Erros: erros comuns, exceto `404` e `409`.
- Idempotência: não idempotente; repetições válidas criam contas distintas, pois duplicidade de nome é permitida.

### 14.3 Listar contas

- Método e rota: `GET /api/accounts`.
- Autenticação: Bearer obrigatório.
- Query: nenhuma, ou exatamente `includeArchived=true`; `false`, valores diferentes e chaves adicionais retornam `400` para manter contrato inequívoco.
- Sucesso: `200` com `ListFinancialAccountsResponse`, somente do proprietário, ordenada por `name ASC` conforme collation determinística configurada e por `id ASC` no desempate. Sem query, contém somente ativas; com `true`, contém ativas e arquivadas.
- Erros: `400`, `401` e `500` comuns.
- Idempotência: leitura idempotente.
- Não há paginação nesta versão porque o uso é pessoal e o volume esperado é pequeno. Não há totais agregados.

### 14.4 Consultar conta

- Método e rota: `GET /api/accounts/:id`.
- Autenticação: Bearer obrigatório.
- Entrada: `id` UUID na rota; sem body ou query.
- Sucesso: `200` com `PublicFinancialAccount`, inclusive se estiver arquivada.
- Erros: `400` somente para query/body inesperado; UUID inválido, conta ausente ou alheia usa `404`; além de `401` e `500`.
- Idempotência: leitura idempotente.

### 14.5 Editar conta

- Método e rota: `PATCH /api/accounts/:id`.
- Autenticação: Bearer obrigatório.
- Corpo: `UpdateFinancialAccountRequest`, ao menos um campo; campos adicionais proibidos. `id`, `userId`, `archivedAt`, `createdAt` e `updatedAt` nunca são editáveis.
- Sucesso: `200` com a conta pública atualizada. Enviar valor igual é permitido e mantém resultado equivalente.
- Validações: cada campo presente obedece às regras da criação; atualizar saldo inicial ou data não cria histórico ou lançamento.
- Erros: comuns; `404` para ID inválido/ausente/alheio; `409 ACCOUNT_ARCHIVED` se arquivada.
- Idempotência: idempotente quanto ao estado para o mesmo corpo, embora `updatedAt` possa refletir a primeira alteração efetiva.

### 14.6 Arquivar conta

- Método e rota: `POST /api/accounts/:id/archive`.
- Autenticação: Bearer obrigatório.
- Corpo e query: proibidos.
- Sucesso: `200` com a conta pública. Se ativa, define `archivedAt`; se já arquivada, mantém o mesmo valor e não altera `updatedAt`.
- Erros: `400` para entrada adicional; `404` para ID inválido/ausente/alheio; `401` e `500`.
- Idempotência: idempotente.

### 14.7 Reativar conta

- Método e rota: `POST /api/accounts/:id/restore`.
- Autenticação: Bearer obrigatório.
- Corpo e query: proibidos.
- Sucesso: `200` com a conta pública. Se arquivada, limpa `archivedAt`; se já ativa, mantém estado e não altera `updatedAt`.
- Erros: `400` para entrada adicional; `404` para ID inválido/ausente/alheio; `401` e `500`.
- Idempotência: idempotente.

## 15. Interface

- Rota protegida única desta unidade: `/accounts`; sem sessão, usa o redirecionamento ao login já existente.
- A tela oferece título, criação e listagem. O estado vazio informa que ainda não há contas e apresenta ação de criar.
- Cada item mostra nome, tipo, instituição quando houver, `Saldo inicial` com moeda e a data de referência, além do estado arquivado quando aplicável. Nunca chama a posição de saldo atual.
- Criação e edição oferecem controles para os seis campos públicos editáveis, mensagens junto aos campos e moeda `BRL` fixa. Conta arquivada oferece reativação, não edição.
- Arquivamento exige confirmação explícita; filtro permite incluir arquivadas; reativação é disponível nelas.
- Carregamento impede submissão duplicada; sucesso atualiza estado a partir da resposta da API. Erro de API permanece visível em região anunciável e oferece nova tentativa quando aplicável.
- Layout, controles, foco, teclado e mensagens devem funcionar em larguras móveis e desktop, seguindo o sistema visual existente.
- Não criar tela, link funcional ou placeholder de lançamentos, categorias, cartões ou outros itens fora do escopo.

## 16. Validações

| Campo ou ação | Validação | Mensagem/resultado esperado |
|---|---|---|
| `name` | String, trim, 1–120 caracteres. | `Informe o nome da conta.` / `Use no máximo 120 caracteres.` |
| `type` | Literal do enum fechado. | `Selecione um tipo de conta válido.` |
| `institution` | Omitido/nulo ou string com trim de 1–120. | `Use de 1 a 120 caracteres para a instituição.` |
| `currency` | Literal obrigatória `BRL`. | `A moeda deve ser BRL.` |
| `openingBalance` | String no formato, escala e limites da seção 9.2. | `Informe um saldo entre -99999999999999999.99 e 99999999999999999.99, com até 2 casas decimais.` |
| `openingBalanceDate` | Data civil gregoriana existente em `YYYY-MM-DD`. | `Informe uma data de referência válida.` |
| `PATCH` | Ao menos um campo editável; conta ativa. | `Informe ao menos um campo.` / `Reative a conta antes de editar.` |
| DTO/query | Whitelist e `forbidNonWhitelisted`; tipos e chaves desconhecidas rejeitados. | `400 VALIDATION_ERROR`; `userId` nunca é consumido. |

API e web validam para feedback, mas somente o backend é autoritativo.

## 17. Permissões

| Ação | Ator autorizado | Condição | Comportamento quando negado |
|---|---|---|---|
| Criar/listar | Usuário autenticado | Token válido. | `401`; nenhum dado. |
| Consultar | Proprietário autenticado | Correspondência de `id` e `userId`. | `404` para ausente ou alheia. |
| Editar | Proprietário autenticado | Conta própria e ativa. | `404` alheia; `409` arquivada. |
| Arquivar/reativar | Proprietário autenticado | Conta própria. | `404` alheia. |

## 18. Segurança e privacidade

- Dados envolvidos: nomes de contas e instituições, saldos e datas financeiras privadas; `userId` interno.
- Ameaças: IDOR, enumeração, mass assignment, injeção, vazamento por projeção/erro/log e precisão monetária incorreta.
- Autenticação é obrigatória. O owner vem exclusivamente do token e todas as consultas combinam `id` e `userId`.
- DTOs explícitos, `whitelist` e `forbidNonWhitelisted` rejeitam `userId` e campos desconhecidos; mapeamento explícito produz a projeção pública sem tipos Prisma.
- Não registrar tokens, cookies, `userId`, nomes, instituições, saldos ou datas em logs. Logs técnicos podem conter código da operação/erro e identificador de correlação não sensível.
- Manter autenticação, cookies, CSRF e CORS existentes, sem mudar seus contratos. As rotas Bearer seguem a proteção da SPEC-002; esta SPEC não amplia o uso de cookies.
- Erros não contêm consultas, stack traces, detalhes de banco nem dados de terceiros.

## 19. Erros e estados vazios

| Situação | Estado apresentado | Recuperação esperada |
|---|---|---|
| Nenhuma conta ativa | Estado vazio com ação de criar; filtro pode revelar arquivadas. | Criar ou incluir arquivadas. |
| Entrada inválida | Mensagens nos campos, dados não persistidos. | Corrigir e reenviar. |
| Conta ausente/alheia | Mensagem genérica de não encontrada. | Voltar à lista. |
| Conta arquivada em edição | Orientação para reativar. | Reativar e então editar. |
| API indisponível/erro interno | Mensagem global sem falso sucesso ou dados sensíveis. | Tentar novamente. |
| Sessão ausente/expirada | Nenhum dado privado e fluxo de autenticação existente. | Fazer login. |

## 20. Observabilidade

Logs estruturados mínimos podem registrar operação (`create`, `list`, `get`, `update`, `archive`, `restore`), resultado/código HTTP, duração e correlation ID. Métricas agregadas de taxa de erro e latência são permitidas. Não registrar payloads, tokens, IDs de usuário/conta, nomes, instituição, saldo ou data. Alertas novos não são obrigatórios nesta primeira versão; falhas recorrentes devem ser avaliadas pelos mecanismos já existentes.

## 21. Migração e compatibilidade

- Dados existentes: não há contas nem importação; a planilha legada é ignorada.
- Compatibilidade retroativa: autenticação e contratos existentes permanecem inalterados.
- Migration necessária: futuramente, uma migration aditiva nova conforme seção 13.2; nunca editar as anteriores.
- Implantação gradual: não aplicável ao documento; a implementação será entregue como uma unidade após validações.

## 22. Critérios de aceite

### `CA-01 — Criação válida`
**Dado** um usuário autenticado e um DTO válido **Quando** cria uma conta **Então** recebe `201` e a conta pública própria, sem `userId`.

### `CA-02 — Nome vazio`
**Dado** um nome vazio ou só com espaços **Quando** cria ou edita **Então** recebe `400` e nada é persistido.

### `CA-03 — Tipo inválido`
**Dado** um tipo fora do enum **Quando** envia o DTO **Então** recebe `400`.

### `CA-04 — Moeda não BRL`
**Dado** `currency` diferente de `BRL` **Quando** envia o DTO **Então** recebe `400`.

### `CA-05 — Saldo positivo`
**Dado** `openingBalance` igual a `123.45` **Quando** cria **Então** a resposta e o banco preservam `123.45`.

### `CA-06 — Saldo zero`
**Dado** saldo `0` **Quando** cria **Então** a resposta apresenta `0.00` sem receita ou despesa.

### `CA-07 — Saldo negativo`
**Dado** saldo `-123.45` **Quando** cria **Então** sinal e centavos são preservados.

### `CA-08 — Precisão monetária`
**Dado** valor com mais de 17 inteiros, mais de 2 decimais, expoente, `NaN` ou `Infinity` **Quando** envia **Então** recebe `400`, sem arredondamento silencioso.

### `CA-09 — Data obrigatória`
**Dado** data ausente, impossível ou com horário **Quando** envia **Então** recebe `400`.

### `CA-10 — Listagem própria`
**Dado** contas dos usuários A e B **Quando** A lista **Então** recebe somente contas de A, ordenadas por nome e ID.

### `CA-11 — Estado vazio`
**Dado** usuário sem contas ativas **Quando** abre `/accounts` **Então** vê estado vazio e ação de criar, sem totais.

### `CA-12 — Filtro de arquivadas`
**Dado** contas ativa e arquivada próprias **Quando** lista sem filtro e com `includeArchived=true` **Então** a primeira resposta omite e a segunda inclui a arquivada.

### `CA-13 — Consulta própria`
**Dado** uma conta própria, ativa ou arquivada **Quando** consulta seu UUID **Então** recebe `200` com a projeção pública.

### `CA-14 — Conta de outro usuário`
**Dado** conta de B **Quando** A consulta, edita, arquiva ou reativa seu UUID **Então** recebe `404` idêntico ao inexistente e nenhum dado de B.

### `CA-15 — Edição`
**Dado** conta própria ativa **Quando** envia PATCH válido **Então** recebe `200`, somente campos informados mudam e nenhum lançamento é criado.

### `CA-16 — Tentativa de enviar userId`
**Dado** qualquer DTO com `userId` **Quando** envia **Então** recebe `400`, e o owner do token jamais é substituído.

### `CA-17 — Arquivamento`
**Dado** conta própria ativa **Quando** arquiva **Então** recebe `200`, `archivedAt` é definido, dados são preservados e a listagem padrão a omite.

### `CA-18 — Arquivamento repetido`
**Dado** conta já arquivada **Quando** arquiva novamente **Então** recebe `200` com os mesmos `archivedAt` e `updatedAt`.

### `CA-19 — Reativação`
**Dado** conta própria arquivada **Quando** reativa **Então** recebe `200`, `archivedAt` fica nulo e a conta volta à lista padrão.

### `CA-20 — Reativação repetida`
**Dado** conta já ativa **Quando** reativa novamente **Então** recebe `200` sem mudar `updatedAt`.

### `CA-21 — Acesso sem autenticação`
**Dado** ausência de sessão válida **Quando** acessa API ou `/accounts` **Então** a API retorna `401` e a web redireciona ao login sem expor dados.

### `CA-22 — API indisponível`
**Dado** falha de rede ou `500` **Quando** a web carrega ou submete **Então** informa indisponibilidade, não simula sucesso e permite tentar novamente.

### `CA-23 — Ausência de lançamentos e categorias`
**Dado** a implementação desta SPEC **Quando** schema, API e web são inspecionados **Então** não existem tabelas, endpoints, telas ou stubs de lançamentos e categorias.

### `CA-24 — Saldo inicial não é receita ou despesa`
**Dado** qualquer saldo inicial **Quando** a conta é criada ou editada **Então** nenhum lançamento ou total de receita/despesa é criado ou alterado e o rótulo não indica saldo atual.

## 23. Testes obrigatórios

| Nível | Cenários mínimos | Critérios relacionados | Evidência esperada |
|---|---|---|---|
| Unitário com mocks | Nome válido/inválido; tipo; BRL; saldo positivo/zero/negativo, formato, precisão, escala e limites; data; projeção sem `userId`; archive/restore. | CA-02–CA-09, CA-16–CA-20, CA-24 | Relatório determinístico de testes rápidos; mocks não contam como persistência. |
| Integração com PostgreSQL real | Aplicar todas as migrations; criar; preservar Decimal e negativo; listar/consultar por owner; cruzado `404`; editar; arquivar/idempotência/reativar; FK Restrict; migrations anteriores preservadas. | CA-01, CA-05–CA-10, CA-13–CA-20, CA-23–CA-24 | Banco PostgreSQL real isolado, dados fictícios e comandos registrados. |
| Contrato/API | Todos os métodos, rotas, DTOs, status, envelopes, whitelist, projeção e ordenação; dois usuários. | CA-01–CA-10, CA-12–CA-21 | Testes HTTP automatizados; não substituir o banco real por mocks nos cenários de persistência. |
| Web com mocks controlados | Estado vazio, criação, edição, arquivamento, filtro, reativação, validações, API indisponível e redirecionamento sem sessão. | CA-01–CA-04, CA-11–CA-12, CA-15, CA-17–CA-22, CA-24 | Testes de componentes/integração identificados como mockados. |
| E2E | Login, criar, visualizar, editar, arquivar, incluir arquivadas, reativar e logout. | CA-01, CA-10–CA-13, CA-15, CA-17–CA-21 | Playwright contra aplicação e banco de teste reais, com dados sintéticos. |
| Aceitação manual | Responsividade, rótulos, foco, confirmação, erros e ausência de domínios excluídos. | CA-11, CA-22–CA-24 | Checklist e capturas sanitizadas quando a implementação existir. |

## 24. Arquivos permitidos

Na implementação futura, somente quando necessários:

- `apps/api/prisma/schema.prisma`;
- uma nova migration em `apps/api/prisma/migrations/**`;
- módulo de contas e testes relacionados em `apps/api/src/**`;
- contratos e testes relacionados em `packages/shared/**`;
- páginas, rotas, componentes e testes de contas em `apps/web/src/**`;
- testes E2E aplicáveis;
- `package.json` e lockfile somente se indispensável e com justificativa explícita;
- arquivos `README` somente quando necessário para operação ou teste da funcionalidade.

## 25. Arquivos proibidos

- Documentos de produto, ADRs, SPECs anteriores e `.github/workflows/ci.yml`.
- Contrato ou implementação de autenticação, cookies, CSRF ou CORS, salvo consumo sem alteração dos contratos existentes.
- Código, schema, rotas ou telas de categorias, lançamentos, transferências, cartões, faturas, dívidas, orçamento, recorrências, importações ou IA.
- Android/iOS, deploy e integrações bancárias.

## 26. Dependências

| Dependência | Motivo | Estado da aprovação | Impacto |
|---|---|---|---|
| SPEC-002 | Identidade, access token e isolamento. | Aprovada e implementada | Fornece `userId` confiável. |
| PostgreSQL e Prisma existentes | Persistência decimal e relacional. | Aprovados por ADR-004 | Nenhuma dependência nova prevista. |
| Contratos e ferramentas existentes | API, web e testes. | Aprovados pelo scaffold/ADRs | Reutilizar; package/lockfile só se indispensável. |

## 27. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Perda/arredondamento de centavos | Média | Alto | String JSON, Decimal(19,2), limites e PostgreSQL real. |
| IDOR ou enumeração | Média | Alto | Owner do token, filtro composto e testes com dois usuários. |
| Saldo inicial confundido com resultado | Média | Alto | Sem lançamento/totais; rótulos e testes explícitos. |
| Data civil deslocada por fuso | Média | Médio | `@db.Date`, string `YYYY-MM-DD`, testes em fusos distintos. |
| Crescimento sem paginação | Baixa no uso pessoal | Médio | Decisão consciente; revisar por métricas/volume em SPEC futura. |
| Alteração de saldo sem histórico | Média | Médio | Limitação visível; histórico completo fora do escopo e decisão futura. |
| FK Restrict dificultar exclusão futura | Baixa | Médio | Exclusão não existe; criar fluxo/migration específica antes de mudar. |

## 28. Rollback

- Documento: `git revert <hash-do-commit>`.
- Implementação futura: reverter código por `git revert`, validar novamente lint, typecheck, testes e build.
- A migration pode ser revertida destrutivamente somente em ambiente sem dados reais, removendo os objetos novos e validando as migrations anteriores.
- Com qualquer dado real, é proibido apagar tabela/dados como rollback automático; exigir decisão humana e migration compensatória aditiva que preserve ou transforme dados de modo aprovado.

## 29. Dúvidas

Não há dúvidas abertas. Limites, precisão, datas, contratos e ciclo de vida foram definidos pela tarefa e por esta SPEC aprovada.

## 30. Decisões aprovadas

| Data | Decisão | Responsável pela aprovação | Consequência |
|---|---|---|---|
| `2026-08-07` | Conta usa tipos fechados e somente BRL. | Tarefa da SPEC-003 | Cartões, dívidas, investimentos e multimoeda ficam excluídos. |
| `2026-08-07` | Saldo usa string JSON e `Decimal(19,2)`, com limites explícitos. | Tarefa da SPEC-003 | Sem ponto flutuante ou arredondamento implícito. |
| `2026-08-07` | Saldo/data iniciais ficam na conta. | Tarefa da SPEC-003 | Solução simples sem lançamentos; histórico é futuro. |
| `2026-08-07` | Arquivamento lógico e idempotente; edição requer conta ativa. | Tarefa da SPEC-003 | Dados são preservados e exclusão não existe. |
| `2026-08-07` | Listagem sem paginação, ordenada por nome e ID. | Tarefa da SPEC-003 | Adequado ao volume pessoal inicial; revisão futura possível. |
| `2026-08-07` | Owner vem somente do access token e acesso cruzado usa `404`. | SPEC-002 e tarefa | `userId` não integra contratos públicos. |

## 31. Definition of Done específica

Além da [Definition of Done do projeto](../quality/DEFINITION-OF-DONE.md), a implementação futura exige:

- [ ] Esta SPEC permanece aprovada e mudanças funcionais seguem controle formal.
- [ ] Migration nova foi criada sem editar anteriores e validada em PostgreSQL real.
- [ ] Precisão `Decimal(19,2)`, string JSON e limites monetários foram implementados e testados.
- [ ] Criação, listagem, consulta, edição, arquivamento e reativação obedecem aos contratos HTTP exatos.
- [ ] Isolamento por usuário foi provado com dois usuários e `404` cruzado.
- [ ] Telas mínimas responsivas, estados e rótulo inequívoco de saldo inicial foram entregues.
- [ ] Testes unitários, integração real, contrato, web e E2E aplicáveis passaram e distinguem mocks de PostgreSQL real.
- [ ] Todos os 24 critérios de aceite foram atendidos e evidências obrigatórias anexadas.
- [ ] Nenhuma funcionalidade fora do escopo foi criada.
- [ ] Workflow de CI permaneceu inalterado e desativado.

## 32. Histórico de alterações da SPEC

| Data | Alteração | Motivo | Autor | Aprovador, quando aplicável |
|---|---|---|---|---|
| `2026-08-07` | Criação da SPEC-003 com status Aprovada. | Autorizar e delimitar a primeira unidade financeira futura. | `Codex Cloud` | Tarefa `PROMPT-SPEC-003-CONTAS-E-SALDOS-INICIAIS.md` |
