# SPEC de funcionalidade — `SPEC-004 — Categorias financeiras`

> Esta SPEC aprova somente uma implementação futura. Esta unidade é exclusivamente documental e não cria código, Prisma, migration, dependência, endpoint, tela ou infraestrutura.

## 1. Identificação

| Campo | Valor |
|---|---|
| ID | `SPEC-004` |
| Título | `Categorias financeiras` |
| Responsável | `Codex Cloud` |
| Data de criação | `2026-08-07` |
| Última atualização | `2026-08-07` |
| Tarefa relacionada | `PROMPT-SPEC-004-CATEGORIAS-FINANCEIRAS.md` |
| Documentos relacionados | `docs/specs/README.md`; `SPEC-002`; `SPEC-003`; `docs/process/GIT-WORKFLOW.md`; documentos de produto e qualidade; `ADR-001`, `ADR-003`, `ADR-004` e `ADR-006` |

## 2. Status

`Aprovada`

**Aprovada por:** tarefa `PROMPT-SPEC-004-CATEGORIAS-FINANCEIRAS.md`, em `2026-08-07`.

## 3. Contexto

O PlannerFin já possui autenticação e isolamento por usuário, definidos pela SPEC-002, e contas e saldos iniciais, definidos e implementados pela SPEC-003. A próxima unidade financeira precisa classificar receitas e despesas, ainda sem criar lançamentos. Cada categoria pertence exatamente ao usuário autenticado; o proprietário decorre somente do access token.

PostgreSQL, Prisma, o monólito modular NestJS e os níveis de teste já estão aprovados. Esta SPEC aplica essas decisões sem alterar autenticação, contas ou infraestrutura.

## 4. Problema

Ainda não há contrato para o usuário organizar receitas e despesas. Sem regras explícitas, uma implementação poderia confundir transferências com resultado, aceitar conteúdo inseguro em ícones, gerar duplicidades por capitalização, expor categorias alheias ou antecipar hierarquia e lançamentos.

## 5. Objetivo

Definir criação, listagem, consulta, edição, arquivamento e reativação de categorias próprias de receita e despesa, com persistência futura, contratos HTTP e compartilhados exatos, isolamento por proprietário e fluxo web responsivo verificáveis.

## 6. Fora do escopo

- Subcategorias, pai e filho, árvores, grupos, profundidade variável e reordenação manual.
- Categorias padrão automáticas, seed global e configuração inicial assistida.
- Lançamentos, transferências, regras de orçamento, cartões, faturas, dívidas e recorrências.
- Importação, IA, exclusão definitiva e compartilhamento.
- Android/iOS, deploy e reativação ou alteração do workflow de CI.

Hierarquia poderá ser avaliada em evolução específica. Nenhum campo de pai, caminho, profundidade, grupo ou ordem será antecipado.

## 7. Termos

| Termo | Definição adotada nesta SPEC |
|---|---|
| Categoria financeira | Classificador plano e próprio de uma futura receita ou despesa. |
| Natureza | Tipo imutável `INCOME` (receita) ou `EXPENSE` (despesa). |
| Nome normalizado | Nome após trim e conversão Unicode para minúsculas, usado apenas internamente para unicidade. |
| Categoria ativa | Categoria com `archivedAt` nulo. |
| Categoria arquivada | Categoria preservada com `archivedAt` preenchido. |
| Categoria pública | Projeção que nunca contém `userId` ou `normalizedName`. |

## 8. Comportamento atual

Há autenticação e contas, mas não existe modelo, API ou interface de categorias. Também não existem lançamentos nem transferências. O workflow de CI está desativado por decisão de custo.

## 9. Comportamento desejado

### 9.1 Natureza e estrutura

- `FinancialCategoryType` é enum fechado: `INCOME` significa receita e `EXPENSE`, despesa.
- `TRANSFER` não existe: transferências serão definidas em unidade própria e não contam como receita ou despesa.
- A natureza é obrigatória e imutável. Para mudá-la, o usuário cria outra categoria e arquiva a anterior.
- Categorias são planas nesta versão. Hierarquia é evolução futura, não campo antecipado.

### 9.2 Nome e unicidade

- `name` é obrigatório, string, recebe trim e deve conter de **1 a 80 caracteres Unicode** após o trim.
- Para `normalizedName`, o servidor aplica ao nome aparado a conversão Unicode padrão para minúsculas (`toLowerCase`), sem remover, condensar ou alterar espaços internos e sem remover acentos. Exemplos: `"  Mercado  "` vira nome `"Mercado"` e normalizado `"mercado"`; `"Super Mercado"` e `"Super  Mercado"` continuam distintos.
- A contagem usa pontos de código Unicode. Controle, quebra de linha e caracteres NUL são inválidos; espaços internos comuns são permitidos.
- A combinação `(userId, type, normalizedName)` é única entre **todas** as categorias, ativas ou arquivadas. Assim, capitalização e espaços externos não criam duplicata.
- O mesmo usuário pode usar o mesmo nome em `INCOME` e `EXPENSE`; usuários diferentes também podem usar o mesmo nome.
- Havendo categoria arquivada com a combinação, criar ou renomear para ela retorna conflito e orienta reativar a existente. A categoria não é recriada, para evitar duplicidade histórica.

### 9.3 Apresentação

- `color` é opcional e aceita somente string no formato `^#[0-9A-Fa-f]{6}$`; a resposta preserva o valor enviado. Não aceita nome, forma curta, alpha ou outro formato. É apenas apresentação e não altera cálculos.
- `icon` é opcional e aceita somente o enum fechado `HOME`, `WORK`, `SHOPPING_CART`, `RESTAURANT`, `DIRECTIONS_CAR`, `HEALTH_AND_SAFETY`, `SCHOOL` e `SAVINGS`.
- Na web Quasar, esses identificadores são mapeados internamente, respectivamente, para os ícones Material `home`, `work`, `shopping_cart`, `restaurant`, `directions_car`, `health_and_safety`, `school` e `savings`. O contrato não aceita nome Material livre, HTML, SVG bruto, URL ou texto arbitrário.
- O ícone é apenas apresentação. A lista pequena e estável reduz incompatibilidade; outra plataforma deverá mapear o enum sem alterar seu significado.
- `null` ou omissão representa ausência de cor/ícone; string vazia é inválida. No PATCH, `null` remove o valor.

### 9.4 Ciclo de vida e configuração inicial

- Não há exclusão física. Arquivar preenche `archivedAt`; restaurar o limpa.
- A listagem padrão omite arquivadas; `includeArchived=true` inclui ativas e arquivadas.
- Arquivar novamente mantém o primeiro `archivedAt` vigente e não altera `updatedAt`; restaurar categoria já ativa também não altera `updatedAt`.
- Categoria arquivada deve ser reativada antes de edição.
- Categorias que venham a possuir lançamentos continuarão preservadas e referenciáveis quando arquivadas; esta SPEC não cria lançamentos nem a relação.
- Não são criadas categorias no cadastro do usuário, não há seed global e a configuração é manual. Padrões dependem de unidade futura.

### 9.5 Propriedade e listagem

- `userId` vem exclusivamente do `sub` validado do access token, nunca de body, query ou rota.
- Toda consulta e mutação filtra simultaneamente por `id` e `userId`.
- Recurso ausente, UUID inválido ou recurso alheio retorna o mesmo `404 CATEGORY_NOT_FOUND`, sem revelar existência, estado ou owner.
- A listagem aceita filtro opcional `type`, retorna somente categorias próprias e ordena por `type ASC`, `name ASC` em collation determinística compatível com a normalização e `id ASC`.
- Não há paginação: no uso pessoal inicial, o volume esperado é baixo. Uma SPEC futura deverá introduzi-la se métricas mostrarem necessidade. Não há totais nem agregações.

## 10. Personas ou atores

| Ator | Necessidade | Ações autorizadas |
|---|---|---|
| Usuário autenticado | Organizar futuras receitas e despesas. | Criar, listar, consultar, editar, arquivar e reativar somente categorias próprias. |
| Visitante | Ter sua privacidade preservada. | Nenhuma; deve autenticar-se. |

## 11. Fluxos

### 11.1 Fluxo principal

1. O usuário autenticado abre `/categories`.
2. A web lista categorias ativas próprias, separáveis por receita e despesa, ou mostra estado vazio.
3. O usuário informa nome, natureza e, opcionalmente, cor e ícone de seletores seguros.
4. A API valida o DTO, deriva o owner do token, normaliza o nome e persiste.
5. O usuário pode consultar, editar apresentação/nome, confirmar arquivamento, incluir arquivadas e reativá-las.

### 11.2 Fluxos alternativos e exceções

- Sem sessão → redirecionar ao login existente sem renderizar dados privados.
- Entrada inválida ou campo desconhecido → `400 VALIDATION_ERROR`.
- Nome já usado na mesma natureza, inclusive arquivado → `409 CATEGORY_NAME_CONFLICT` e orientação segura para reativar quando aplicável.
- Categoria arquivada em edição → `409 CATEGORY_ARCHIVED`.
- Categoria ausente ou alheia → `404 CATEGORY_NOT_FOUND` indistinguível.
- API indisponível → exibir falha, conservar entrada segura e permitir nova tentativa, sem simular sucesso.

## 12. Regras de negócio

| ID | Regra | Origem/decisão | Exemplo |
|---|---|---|---|
| `RN-01` | Owner deriva somente do token. | SPEC-002 | `userId` no body falha. |
| `RN-02` | Natureza aceita apenas `INCOME` e `EXPENSE` e é imutável. | Tarefa | `TRANSFER` e PATCH de `type` falham. |
| `RN-03` | Categorias são planas. | Tarefa | Não existe `parentId`. |
| `RN-04` | Nome aparado tem 1–80 pontos de código. | Tarefa | Espaços apenas falham. |
| `RN-05` | Nome é único por owner, natureza e nome normalizado, incluindo arquivadas. | Tarefa | `Casa` conflita com ` casa `. |
| `RN-06` | Mesmo nome pode existir em naturezas distintas. | Tarefa | `Salário` em ambos os tipos. |
| `RN-07` | Cor e ícone pertencem a formatos fechados e não têm efeito financeiro. | Segurança/tarefa | URL como ícone falha. |
| `RN-08` | Arquivamento e restauração são lógicos e idempotentes. | Tarefa | Segundo archive preserva timestamps. |
| `RN-09` | Categoria arquivada não é editável. | Tarefa | PATCH retorna `409`. |
| `RN-10` | Recurso alheio é indistinguível do inexistente. | SPEC-002 | Ambos retornam `404`. |

## 13. Modelo de dados

### 13.1 Entidade conceitual e Prisma futuro

| Entidade | Campo | Tipo conceitual/Prisma | Obrigatório | Regra |
|---|---|---|---|---|
| `FinancialCategory` | `id` | UUID / `String @id @default(uuid()) @db.Uuid` | Sim | Identificador público imutável. |
| `FinancialCategory` | `userId` | UUID / `String @db.Uuid` | Sim | Interno; nunca aceito ou exposto. |
| `FinancialCategory` | `name` | Texto / `String @db.VarChar(80)` | Sim | Trim, 1–80 pontos de código. |
| `FinancialCategory` | `normalizedName` | Texto / `String @db.VarChar(80)` | Sim | Interno, calculado pelo servidor. |
| `FinancialCategory` | `type` | Enum Prisma `FinancialCategoryType` | Sim | `INCOME` ou `EXPENSE`; imutável. |
| `FinancialCategory` | `color` | Texto / `String? @db.VarChar(7)` | Não | Hexadecimal `#RRGGBB`. |
| `FinancialCategory` | `icon` | Enum Prisma `FinancialCategoryIcon?` | Não | Lista fechada da seção 9.3. |
| `FinancialCategory` | `archivedAt` | Instante UTC / `DateTime? @db.Timestamptz(3)` | Não | Nulo quando ativa. |
| `FinancialCategory` | `createdAt` | Instante UTC / `DateTime @default(now()) @db.Timestamptz(3)` | Sim | Gerado no servidor. |
| `FinancialCategory` | `updatedAt` | Instante UTC / `DateTime @updatedAt @db.Timestamptz(3)` | Sim | Gerado no servidor. |

O modelo terá `user User @relation(fields: [userId], references: [id], onDelete: Restrict)`, relação inversa em `User`, `@@index([userId])` e `@@unique([userId, type, normalizedName])`. A constraint abrange ativas e arquivadas. A FK `ON DELETE RESTRICT` impede apagar usuário com categorias e exige futura política explícita de retenção/exclusão. Validações de formato permanecem também na API.

### 13.2 Migration futura

- Criar migration nova, sem editar migrations anteriores, com os dois enums, tabela, índice, unique constraint, checks aplicáveis e FK `ON DELETE RESTRICT`.
- Não criar seed nem tabelas de lançamentos, transferências, cartões, dívidas ou orçamento.
- Validar aplicação desde banco vazio e sobre todas as migrations existentes em PostgreSQL real.

## 14. Contratos de API

Todos os endpoints usam JSON UTF-8, Bearer access token da SPEC-002 e o envelope:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Revise os dados informados.", "details": [{ "field": "name", "message": "Informe um nome entre 1 e 80 caracteres." }] } }
```

`details` aparece somente no `400`, menciona apenas campos do DTO e não ecoa valores. Códigos: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `404 CATEGORY_NOT_FOUND`, `409 CATEGORY_NAME_CONFLICT`, `409 CATEGORY_ARCHIVED` e `500 INTERNAL_ERROR`. Mensagens de conflito não expõem categorias alheias.

### 14.1 Contratos compartilhados

```ts
type FinancialCategoryType = 'INCOME' | 'EXPENSE';
type FinancialCategoryIcon =
  | 'HOME' | 'WORK' | 'SHOPPING_CART' | 'RESTAURANT'
  | 'DIRECTIONS_CAR' | 'HEALTH_AND_SAFETY' | 'SCHOOL' | 'SAVINGS';

type PublicFinancialCategory = {
  id: string;
  name: string;
  type: FinancialCategoryType;
  color: string | null;
  icon: FinancialCategoryIcon | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CreateFinancialCategoryRequest = {
  name: string;
  type: FinancialCategoryType;
  color?: string | null;
  icon?: FinancialCategoryIcon | null;
};

type UpdateFinancialCategoryRequest = {
  name?: string;
  color?: string | null;
  icon?: FinancialCategoryIcon | null;
};

type ListFinancialCategoriesResponse = PublicFinancialCategory[];
```

O update exige ao menos um campo. Não se compartilham tipos Prisma, `userId` ou `normalizedName`. O envelope de erro compartilhado existente pode ser reutilizado sem ampliar estes DTOs.

### 14.2 Criar categoria

- Método/rota: `POST /api/categories`.
- Autenticação: Bearer obrigatório; owner derivado do token.
- Request: `CreateFinancialCategoryRequest`; `name` e `type` obrigatórios; body deve ser objeto JSON; campos desconhecidos proibidos.
- Sucesso: `201` com `PublicFinancialCategory` ativa.
- Validações: seções 9 e 16; duplicidade própria usa `409 CATEGORY_NAME_CONFLICT`.
- Erros: `400`, `401`, `409` e `500`; não se aplica `404`.
- Idempotência: não idempotente por contrato; repetição encontra a unique constraint e retorna `409`, sem criar duplicata.

### 14.3 Listar categorias

- Método/rota: `GET /api/categories`.
- Autenticação: Bearer obrigatório.
- Request: sem body. Query opcional `includeArchived=true` e/ou `type=INCOME|EXPENSE`, cada chave no máximo uma vez. `includeArchived=false`, outros valores, tipos inválidos ou chaves desconhecidas retornam `400`.
- Sucesso: `200` com `ListFinancialCategoriesResponse` própria; padrão somente ativas, `true` inclui ambas; `type` restringe a natureza. Ordenação `type ASC`, `name ASC` determinística e `id ASC`.
- Erros: `400`, `401`, `500`.
- Idempotência: leitura idempotente. Sem paginação, totais ou agregações pelas razões da seção 9.5.

### 14.4 Consultar categoria

- Método/rota: `GET /api/categories/:id`.
- Autenticação: Bearer obrigatório.
- Request: `id` UUID na rota; body e query proibidos.
- Sucesso: `200` com `PublicFinancialCategory`, inclusive arquivada própria.
- Erros: `400` para entrada adicional; UUID inválido, ausente ou alheio usa `404`; também `401` e `500`.
- Idempotência: leitura idempotente.

### 14.5 Editar categoria

- Método/rota: `PATCH /api/categories/:id`.
- Autenticação: Bearer obrigatório.
- Request: `UpdateFinancialCategoryRequest` com ao menos um de `name`, `color`, `icon`. `type`, `id`, `userId`, `normalizedName`, `archivedAt`, `createdAt`, `updatedAt` e qualquer desconhecido são rejeitados com `400`.
- Sucesso: `200` com categoria pública atualizada. Valor igual é permitido.
- Validações: regras da criação para cada campo; nome recalcula `normalizedName`; categoria precisa estar ativa.
- Erros: `400`; `404` para ID inválido/ausente/alheio; `409 CATEGORY_ARCHIVED` ou `CATEGORY_NAME_CONFLICT`; `401`; `500`.
- Idempotência: equivalente no estado para o mesmo body, embora a primeira mudança efetiva possa atualizar `updatedAt`.

### 14.6 Arquivar categoria

- Método/rota: `POST /api/categories/:id/archive`.
- Autenticação: Bearer obrigatório.
- Request: body e query proibidos.
- Sucesso: `200` com categoria pública. Se ativa, define `archivedAt`; se já arquivada, preserva `archivedAt` e `updatedAt`.
- Erros: `400` para entrada adicional; `404` para ID inválido/ausente/alheio; `401`; `500`.
- Idempotência: idempotente.

### 14.7 Reativar categoria

- Método/rota: `POST /api/categories/:id/restore`.
- Autenticação: Bearer obrigatório.
- Request: body e query proibidos.
- Sucesso: `200` com categoria pública. Se arquivada, limpa `archivedAt`; se ativa, preserva estado e `updatedAt`.
- Erros: `400` para entrada adicional; `404` para ID inválido/ausente/alheio; `401`; `500`.
- Idempotência: idempotente. A constraint abrangente torna impossível existir outra categoria conflitante do mesmo owner/tipo/nome normalizado.

## 15. Interface

- Rota protegida `/categories`, acessível pela navegação da área autenticada; sem sessão, redireciona ao login existente.
- A tela possui abas ou filtro inequívoco para receitas e despesas, filtro para incluir arquivadas e estado vazio com ação de criar.
- Criação e edição validam junto aos campos. A natureza é escolhida somente na criação e exibida sem controle editável depois.
- Cor usa seletor seguro que produz apenas `#RRGGBB`; ícone usa somente as oito opções fechadas, com rótulo textual acessível.
- Arquivar exige confirmação; arquivada oferece reativação e não edição.
- Estados de carregamento bloqueiam submissão duplicada. Falha da API é anunciada, não gera falso sucesso e permite tentar novamente.
- Layout, foco, teclado, contraste, rótulos e alvos funcionam em larguras móveis e desktop conforme sistema visual existente.
- Não existe tela, atalho ou formulário de lançamentos ou transferências nesta unidade.

## 16. Validações

| Campo ou ação | Validação | Mensagem/resultado esperado |
|---|---|---|
| `name` | String obrigatória; trim; 1–80 pontos de código; sem controles/quebras. | `400`, informe nome válido. |
| `name` único | Unique por owner, tipo e normalizado, incluindo arquivadas. | `409`; use outro nome ou reative a arquivada. |
| `type` | Somente `INCOME` ou `EXPENSE`; ausente na criação falha. | `400`, selecione receita ou despesa. |
| `type` no PATCH | Campo não permitido. | `400`, natureza não pode ser alterada. |
| `color` | `null`/omissão ou regex `^#[0-9A-Fa-f]{6}$`. | `400`, use `#RRGGBB`. |
| `icon` | `null`/omissão ou um dos oito identificadores. | `400`, selecione ícone suportado. |
| Campos desconhecidos | `whitelist` e `forbidNonWhitelisted`; sem mass assignment. | `400` sem persistência parcial. |
| PATCH | Objeto com ao menos um campo permitido; categoria ativa. | `400` se vazio; `409` se arquivada. |
| `id` | UUID e recurso simultaneamente próprio. | `404` indistinguível. |
| Queries | Somente combinações explicitamente descritas. | `400` para valor/chave/repetição inválida. |

## 17. Permissões

| Ação | Ator autorizado | Condição | Comportamento quando negado |
|---|---|---|---|
| Criar/listar | Usuário autenticado | Token válido; owner derivado dele. | `401`; nenhum dado. |
| Consultar | Usuário autenticado | `id` e `userId` correspondem. | `404` para ausente/alheio. |
| Editar | Usuário autenticado | Própria e ativa. | `404` alheia; `409` própria arquivada. |
| Arquivar/reativar | Usuário autenticado | Categoria própria. | `404` ausente/alheia. |

## 18. Segurança e privacidade

- Dados envolvidos: nomes e preferências visuais podem revelar hábitos; UUID/owner são identificadores internos. Não são necessárias credenciais ou valores financeiros.
- Ameaças: IDOR, enumeração, mass assignment, injeção, conteúdo ativo em ícone, formato arbitrário em cor e vazamento em logs/erros.
- Todos os endpoints exigem autenticação. Owner deriva do token e cada acesso filtra `id` com `userId` no backend, nunca apenas na interface.
- DTOs explícitos usam `whitelist` e `forbidNonWhitelisted`; não mapear body diretamente ao Prisma.
- Ícone não aceita HTML, SVG, URL ou texto livre; cor usa regex estrita. Respostas aplicam projeção pública.
- Não alterar autenticação, cookies, CSRF ou CORS. Não registrar tokens, cookies, `userId`, IDs/nome/cor/ícone de categoria ou payloads.
- Erros e logs não revelam dado, existência, owner, query de banco ou stack trace de terceiro.

## 19. Erros e estados vazios

| Situação | Estado apresentado | Recuperação esperada |
|---|---|---|
| Nenhuma categoria ativa | Estado vazio por filtro/natureza, sem dados inventados. | Criar manualmente ou incluir arquivadas. |
| Validação inválida | Mensagem específica junto ao campo; valores seguros mantidos. | Corrigir e reenviar. |
| Nome duplicado ativo | Conflito sem segunda criação. | Escolher outro nome. |
| Nome duplicado arquivado | Orientação para incluir arquivadas e reativar. | Reativar a existente. |
| Categoria arquivada em edição | Edição bloqueada. | Reativar antes. |
| API indisponível | Mensagem global, sem falso sucesso ou exposição. | Tentar novamente. |
| Sessão ausente/expirada | Nenhum dado privado renderizado. | Redirecionar ao login. |

## 20. Observabilidade

Logs estruturados mínimos podem registrar operação (`create`, `list`, `get`, `update`, `archive`, `restore`), código HTTP, duração e correlation ID não sensível. Métricas agregadas de erro e latência são permitidas. Não registrar payload, token, cookie, owner, ID, nome, tipo, cor ou ícone. Alertas novos não são obrigatórios; falhas recorrentes usam mecanismos existentes.

## 21. Migração e compatibilidade

- Dados existentes: não há categorias a converter; não criar padrões ou seed.
- Compatibilidade: contas e autenticação permanecem inalteradas. Categorias arquivadas serão preservadas para referências de lançamentos futuros.
- Migration: nova e aditiva conforme 13.2; migrations anteriores são imutáveis.
- Implantação gradual: não aplicável nesta primeira versão; schema, API e web devem ser entregues juntos na futura implementação.
- A introdução futura de hierarquia requer SPEC e migration próprias, sem campo antecipado agora.

## 22. Critérios de aceite

### `CA-01 — Criar receita`
**Dado** usuário autenticado **Quando** cria `INCOME` com dados válidos **Então** recebe `201` e categoria ativa pública própria.

### `CA-02 — Criar despesa`
**Dado** usuário autenticado **Quando** cria `EXPENSE` com dados válidos **Então** recebe `201` com natureza de despesa.

### `CA-03 — Nome vazio`
**Dado** criação com nome vazio ou apenas espaços **Quando** envia **Então** recebe `400` e nada é criado.

### `CA-04 — Natureza inválida`
**Dado** criação com `TRANSFER` ou outro valor **Quando** envia **Então** recebe `400`.

### `CA-05 — Nome normalizado`
**Dado** nome `"  Mercado  "` **Quando** cria **Então** o nome público é `"Mercado"` e a chave interna é `"mercado"`.

### `CA-06 — Duplicidade na mesma natureza`
**Dado** `EXPENSE Mercado` própria **Quando** cria `EXPENSE " mercado "` **Então** recebe `409` sem duplicata.

### `CA-07 — Mesmo nome em naturezas diferentes`
**Dado** `INCOME Ajuste` própria **Quando** cria `EXPENSE Ajuste` **Então** a criação é aceita.

### `CA-08 — Duplicidade arquivada`
**Dado** categoria própria arquivada com mesma natureza/nome normalizado **Quando** tenta recriar **Então** recebe `409` e orientação para reativar.

### `CA-09 — Cor válida`
**Dado** `color="#12aB90"` **Quando** cria ou edita **Então** o valor é aceito sem efeito financeiro.

### `CA-10 — Cor inválida`
**Dado** nome de cor, hexadecimal curto, alpha ou URL **Quando** envia **Então** recebe `400`.

### `CA-11 — Ícone válido`
**Dado** um identificador da lista fechada **Quando** envia **Então** ele é aceito e projetado publicamente.

### `CA-12 — Ícone inválido`
**Dado** HTML, SVG, URL, nome livre ou enum desconhecido **Quando** envia **Então** recebe `400`.

### `CA-13 — Listagem própria`
**Dado** categorias de dois usuários **Quando** um lista **Então** recebe somente as próprias, ativas por padrão e na ordem definida.

### `CA-14 — Estado vazio`
**Dado** usuário sem categoria ativa no filtro **Quando** abre a tela **Então** vê estado vazio e ação de criar, sem padrão automático.

### `CA-15 — Filtro por natureza`
**Dado** receitas e despesas próprias **Quando** usa `type=INCOME` **Então** recebe somente receitas.

### `CA-16 — Filtro de arquivadas`
**Dado** categoria ativa e arquivada próprias **Quando** lista sem filtro e com `includeArchived=true` **Então** a primeira omite e a segunda inclui a arquivada.

### `CA-17 — Consulta própria`
**Dado** categoria própria inclusive arquivada **Quando** consulta seu UUID **Então** recebe `200` com projeção pública sem owner/normalização.

### `CA-18 — Recurso alheio`
**Dado** UUID de categoria de outro usuário **Quando** consulta ou muta **Então** recebe o mesmo `404` de recurso inexistente, sem vazamento.

### `CA-19 — Edição válida`
**Dado** categoria própria ativa **Quando** altera nome, cor e/ou ícone validamente **Então** recebe `200` com valores atualizados.

### `CA-20 — Alterar natureza`
**Dado** categoria existente **Quando** envia `type` no PATCH **Então** recebe `400` e a natureza permanece.

### `CA-21 — Enviar userId`
**Dado** qualquer criação ou edição **Quando** envia `userId` **Então** recebe `400` e o owner continua vindo somente do token.

### `CA-22 — Arquivamento`
**Dado** categoria própria ativa **Quando** arquiva **Então** recebe `200`, `archivedAt` preenchido e ela some da lista padrão.

### `CA-23 — Arquivamento repetido`
**Dado** categoria já arquivada **Quando** arquiva novamente **Então** recebe `200` com os mesmos `archivedAt` e `updatedAt`.

### `CA-24 — Reativação`
**Dado** categoria própria arquivada **Quando** reativa **Então** recebe `200`, `archivedAt=null` e ela volta à lista padrão.

### `CA-25 — Reativação repetida`
**Dado** categoria já ativa **Quando** reativa novamente **Então** recebe `200` sem alterar estado ou `updatedAt`.

### `CA-26 — Acesso sem autenticação`
**Dado** requisição sem token válido **Quando** acessa qualquer endpoint ou rota web **Então** a API responde `401` e a web redireciona ao login sem dados privados.

### `CA-27 — API indisponível`
**Dado** falha de rede ou `500` **Quando** a web carrega ou envia **Então** informa falha, não simula sucesso e permite nova tentativa.

### `CA-28 — Ausência de lançamentos e transferências`
**Dado** a implementação desta SPEC **Quando** é inspecionada **Então** não há natureza `TRANSFER`, lançamento, transferência, agregado financeiro nem tela desses domínios.

## 23. Testes obrigatórios

| Nível | Cenários mínimos | Critérios relacionados | Evidência esperada |
|---|---|---|---|
| Unitário | Normalização; vazio/limites; enum e imutabilidade; cor/ícone válidos e inválidos; projeção sem internos; archive/restore idempotentes; edição de arquivada. | CA-03–CA-05, CA-09–CA-12, CA-17, CA-20, CA-22–CA-25 | Testes determinísticos sem infraestrutura. |
| Integração — PostgreSQL real | Migration; INCOME/EXPENSE; mesmo nome entre tipos; duplicidade ativa/arquivada e constraint; owner/filtros/consulta; `404` cruzado com dois usuários; edição/type; archive/restore; FK RESTRICT; migrations anteriores. | CA-01–CA-08, CA-13, CA-15–CA-25 | Banco PostgreSQL real identificado; mocks não substituem persistência. |
| Contrato/API | DTOs, whitelist/forbid, UUID, queries, status, envelopes, projeção, ordenação e idempotência. | CA-01–CA-13, CA-15–CA-26 | Testes HTTP automatizados. |
| Web com mocks controlados | Vazio; criar receita/despesa; validações; edição; cor/ícone; arquivamento; filtros; restauração; API indisponível; redirecionamento. | CA-01–CA-04, CA-09–CA-16, CA-19–CA-27 | Testes explicitamente identificados como mockados. |
| E2E | Login; criar receita e despesa; listar/filtrar; editar; arquivar; incluir arquivadas; reativar; logout. | CA-01–CA-02, CA-13, CA-15–CA-16, CA-19, CA-22, CA-24, CA-26 | Playwright contra aplicação e banco de teste reais, com dados fictícios. |
| Aceitação manual | Responsividade, navegação, confirmação, acessibilidade, erros e ausência dos domínios excluídos. | CA-14, CA-22, CA-27–CA-28 | Checklist e capturas sanitizadas quando implementado. |

Mocks de serviço/web devem estar claramente nomeados e nunca podem ser apresentados como evidência de constraint, migration, FK ou isolamento no PostgreSQL real.

## 24. Arquivos permitidos

Na implementação futura, somente quando necessários:

- `apps/api/prisma/schema.prisma`;
- uma nova migration em `apps/api/prisma/migrations/**`;
- módulo de categorias em `apps/api/src/**`;
- contratos de categorias em `packages/shared/**`;
- páginas, rotas, componentes e testes em `apps/web/src/**`;
- testes unitários, de integração, contrato, web e E2E aplicáveis;
- `package.json` e lockfile somente se indispensável, com justificativa explícita;
- arquivos `README` somente quando necessários para operação ou testes.

## 25. Arquivos proibidos

- Documentos de produto, ADRs, SPECs anteriores e workflow de CI.
- Contrato/implementação de autenticação, cookies, CSRF ou CORS.
- Módulo de contas, exceto navegação neutra indispensável na área autenticada.
- Código, schema, rotas ou telas de lançamentos, transferências, cartões, faturas, dívidas, orçamento, recorrências, importações ou IA.
- Android/iOS, deploy, seed global e categorias automáticas.

## 26. Dependências

| Dependência | Motivo | Estado da aprovação | Impacto |
|---|---|---|---|
| SPEC-002 | Identidade, token e isolamento. | Aprovada e implementada | Fornece owner confiável. |
| SPEC-003 | Área autenticada e navegação financeira existentes. | Aprovada e implementada | Integração apenas neutra; contas não mudam. |
| PostgreSQL e Prisma | Persistência, unique e FK. | Aprovados pela ADR-004 | Nenhuma dependência nova prevista. |
| NestJS, Quasar e testes existentes | API, web e evidências. | Aprovados pelo scaffold/ADRs | Reutilizar ferramentas existentes. |

Nenhuma nova dependência é autorizada por esta SPEC; `package.json`/lockfile só podem mudar futuramente se indispensáveis e justificados.

## 27. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Duplicidade por normalização divergente | Média | Alto | Algoritmo único no servidor, coluna normalizada, unique abrangente e testes PostgreSQL. |
| Hierarquia futura exigir remodelagem | Média | Médio | Não antecipar campos; nova SPEC e migration aditiva. |
| Categoria arquivada com lançamentos futuros ser apagada | Média | Alto | Sem exclusão física; futuras FKs e fluxos devem preservar referência. |
| Enum de ícones não mapear em outra plataforma | Média | Médio | Enum semântico pequeno e mapeamento por cliente; revisão versionada futura. |
| Cor/ícone usados como conteúdo arbitrário | Baixa | Alto | Regex e enum fechados; rejeitar HTML/SVG/URL. |
| Vazamento por consulta sem owner | Média | Alto | Filtro composto obrigatório, projeção e testes com dois usuários. |
| Exclusão futura de usuário bloqueada pelas categorias | Baixa | Médio | FK RESTRICT deliberada; definir retenção em unidade própria. |
| Listagem sem paginação crescer | Baixa | Médio | Uso pessoal/baixo volume; observar e criar SPEC futura se necessário. |

## 28. Rollback

- Documento: `git revert <hash-do-commit>` e validar que somente esta SPEC foi removida.
- Implementação futura: reverter código por `git revert` e repetir lint, typecheck, testes e build.
- Migration destrutiva para remover objetos é admissível somente em ambiente sem dados reais, após comprovação e validação das migrations anteriores.
- Com qualquer dado real, não apagar tabela/categorias como rollback: exigir decisão humana e migration compensatória aditiva que preserve ou transforme dados de modo aprovado.

## 29. Dúvidas

Não há dúvidas abertas. Natureza, normalização, unicidade, ícones, ciclo de vida, contratos, isolamento e escopo foram definidos pela tarefa e por esta SPEC aprovada.

## 30. Decisões aprovadas

| Data | Decisão | Responsável pela aprovação | Consequência |
|---|---|---|---|
| `2026-08-07` | Natureza fechada `INCOME`/`EXPENSE` e imutável. | Tarefa da SPEC-004 | Transferência e troca de natureza ficam excluídas. |
| `2026-08-07` | Estrutura plana, sem campos antecipados de hierarquia. | Tarefa da SPEC-004 | Hierarquia exige unidade futura. |
| `2026-08-07` | Nome único por owner, tipo e normalização, incluindo arquivadas. | Tarefa da SPEC-004 | Duplicata arquivada deve ser reativada. |
| `2026-08-07` | Cor estrita e oito ícones fechados são apenas apresentação. | Tarefa da SPEC-004 | Conteúdo arbitrário é rejeitado. |
| `2026-08-07` | Sem categorias automáticas ou seed. | Tarefa da SPEC-004 | Configuração inicial é manual. |
| `2026-08-07` | Arquivamento lógico e operações idempotentes. | Tarefa da SPEC-004 | Histórico e futuras referências são preservados. |
| `2026-08-07` | Owner vem somente do token e acesso cruzado retorna `404`. | SPEC-002 e tarefa | `userId` não integra contratos públicos. |
| `2026-08-07` | Listagem não paginada e determinística. | Tarefa da SPEC-004 | Adequada ao baixo volume pessoal inicial. |

## 31. Definition of Done específica

Além da [Definition of Done do projeto](../quality/DEFINITION-OF-DONE.md), a implementação futura exige:

- [ ] Esta SPEC está e permanece aprovada; mudanças seguem controle formal.
- [ ] Modelo Prisma e migration nova foram implementados como definidos, sem editar migrations anteriores e com PostgreSQL real.
- [ ] Contratos HTTP exatos e contratos compartilhados mínimos foram atendidos.
- [ ] Unicidade e normalização, inclusive com arquivadas, foram provadas.
- [ ] Arquivamento e reativação idempotentes foram provados.
- [ ] Isolamento foi provado com dois usuários e `404` cruzado.
- [ ] Web protegida e responsiva, seus estados e seletores seguros foram entregues.
- [ ] Testes unitários, integração real, contrato, web e E2E aplicáveis passaram, distinguindo mocks de PostgreSQL real.
- [ ] Todos os 28 critérios de aceite foram atendidos e as evidências obrigatórias anexadas.
- [ ] Nenhuma funcionalidade fora do escopo foi criada.
- [ ] Workflow de CI permaneceu inalterado e desativado.

## 32. Histórico de alterações da SPEC

| Data | Alteração | Motivo | Autor | Aprovador, quando aplicável |
|---|---|---|---|---|
| `2026-08-07` | Criação da SPEC-004 com status Aprovada. | Definir e autorizar a futura unidade de categorias financeiras. | `Codex Cloud` | Tarefa `PROMPT-SPEC-004-CATEGORIAS-FINANCEIRAS.md` |
