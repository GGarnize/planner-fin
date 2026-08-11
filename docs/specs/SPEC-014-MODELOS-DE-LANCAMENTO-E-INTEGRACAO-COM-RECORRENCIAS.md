# SPEC de funcionalidade — `SPEC-014 — Modelos de lançamento e integração com recorrências`

> Esta unidade é exclusivamente documental. Ela não autoriza nem contém implementação, código de runtime, schema Prisma ou migration.

## 1. Identificação

| Campo | Valor |
|---|---|
| ID | `SPEC-014` |
| Título | `Modelos de lançamento e integração com recorrências` |
| Responsável | `Codex Cloud` |
| Data de criação | `2026-08-11` |
| Última atualização | `2026-08-11` |
| Tarefa relacionada | `PROMPT-SPEC-014-MODELOS-LANCAMENTO-CODEX-CLOUD.md` |
| Documentos relacionados | `SPEC-002`, `SPEC-003`, `SPEC-004`, `SPEC-005`, `SPEC-006`, `SPEC-007`, `SPEC-010`, `SPEC-011`, `SPEC-013`; `ADR-001` a `ADR-006`; documentos de processo e qualidade |

## 2. Status

`Em revisão`

Esta SPEC **não está aprovada**. A aprovação humana e a implementação devem ocorrer em tarefas posteriores e separadas.

## 3. Confirmação do identificador e investigação AS-IS

Na `main` usada como base, o índice termina na SPEC-013, a busca no repositório não encontra arquivo, reserva ou referência anterior à `SPEC-014`, e a SPEC-013 está `Aprovada`. Portanto, `SPEC-014` está disponível e passa a identificar somente esta unidade.

O runtime atual confirma:

- API global sob `/api`, autenticação Bearer e owner derivado da sessão; projeções públicas não expõem `userId`;
- `FinancialTransaction` exige conta e categoria, aceita somente `INCOME | EXPENSE`, usa `plannedAmount Decimal(19,2)`, datas civis `date` e estados `PENDING | PAID`;
- criação de `PENDING` não admite realizado/data de pagamento; criação de `PAID` exige ambos, e alterações posteriores seguem `pay`/`reopen` da SPEC-005;
- contas e categorias possuem `archivedAt`; categoria possui natureza e unicidade normalizada; referências novas precisam ser próprias, ativas e compatíveis;
- `RecurrenceRule` já guarda uma cópia completa do template financeiro de `TRANSACTION` ou `TRANSFER`; materializa ocorrências independentes, pendentes e vinculadas à regra para idempotência;
- recorrência de lançamento exige hoje `accountId`, `categoryId`, `transactionType`, valor, descrição e notas, além do calendário. Não existe incompatibilidade com copiar defaults de um modelo para o rascunho antes de enviar o contrato atual;
- os contratos compartilhados estão centralizados em `packages/shared/src/index.ts`; as telas atuais de lançamentos e recorrências têm formulários próprios, ainda sem modelo; e a SPEC-013 reservou “Usar modelo…” no fluxo de lançamento.

Este diagnóstico é evidência AS-IS, não autorização para alterar o runtime nesta tarefa.

## 4. Contexto e problema

Lançamentos semelhantes, como aluguel, energia ou mercado mensal, repetem natureza, categoria, descrição e valor previsto, mas cada ocorrência pode variar em conta, vencimento, notas e valor realizado. Repetir toda digitação aumenta atrito; transformar o padrão em fato financeiro ou vinculá-lo para sempre criaria risco de sobrescrever histórico.

## 5. Objetivo

Definir um recurso persistido de defaults, pertencente a um usuário, que possa preencher rascunhos de lançamentos e de recorrências sem salvar, realizar ou criar vínculo vivo, preservando integralmente as regras financeiras das SPECs existentes e a UX mobile-first da SPEC-013.

## 6. Separação conceitual obrigatória

| Conceito | Pergunta respondida | Efeito financeiro |
|---|---|---|
| Modelo | “Como normalmente é esse lançamento?” | Nenhum; é somente um conjunto de defaults. |
| Recorrência | “Quando esse lançamento deve ser gerado?” | Nenhum até materializar uma ocorrência; mantém configuração própria. |
| Lançamento | “O que aconteceu nesta ocorrência específica?” | Segue a SPEC-005; somente realizado afeta saldo e agregações aplicáveis. |

Um modelo não é recorrência, lançamento, transferência, automação ou evento financeiro.

## 7. Escopo funcional

- Criar, consultar, listar, editar, arquivar e restaurar modelos próprios.
- Aplicar modelo ativo a um rascunho de novo lançamento.
- Aplicar modelo ativo ao bloco financeiro de um rascunho de recorrência `TRANSACTION`.
- Informar defaults indisponíveis quando categoria ou conta tiver sido arquivada após a criação do modelo.
- Integrar seletores leves e responsivos aos fluxos definidos pela SPEC-013.
- Persistir o modelo em implementação futura por migration nova e aditiva.

Não haverá hard delete no MVP.

## 8. Modelo conceitual e campos

Entidade futura: `TransactionTemplate` (termo público em português: **modelo de lançamento**).

| Campo | Tipo futuro | Obrigatório | Regra |
|---|---|---|---|
| `id` | UUID | Sim | PK gerada no servidor. |
| `userId` | UUID | Sim | Owner interno, imutável, nunca aceito ou exposto. |
| `name` | `varchar(80)` | Sim | Nome amigável aparado, 1–80 pontos de código, sem controles/quebras. |
| `normalizedName` | `varchar(80)` | Sim | Interno: `name.trim().toLowerCase()` Unicode, sem remover acentos ou alterar espaços internos. |
| `type` | `INCOME | EXPENSE` | Sim | Natureza do lançamento; não aceita transferência. |
| `categoryId` | UUID | Sim | Categoria própria e compatível; ativa ao criar/editar/restaurar. |
| `description` | `varchar(200)` | Sim | Exatamente trim, tamanho e caracteres da SPEC-005. |
| `plannedAmount` | `decimal(19,2)` | Sim | Positivo, exato, recebido/devolvido como string canônica da SPEC-005; nunca float. |
| `defaultAccountId` | UUID nullable | Não | Nenhuma ou uma conta própria e ativa ao definir. Não obriga a ocorrência. |
| `notes` | `varchar(2000)` nullable | Não | Exatamente normalização e limites da SPEC-005; vazio vira `null`. |
| `dueDay` | inteiro nullable | Não | Dia civil sugerido `1..31`; não é timestamp nem data completa. |
| `archivedAt` | `timestamptz(3)` nullable | Sim | `null` significa ativo; preenchido significa arquivado. |
| `createdAt` | `timestamptz(3)` | Sim | Gerado no servidor. |
| `updatedAt` | `timestamptz(3)` | Sim | Gerado/atualizado no servidor; no-op idempotente preserva valor. |

O modelo não contém `actualAmount`, `paidAt`, `status`, `recurrenceRuleId`, `sourceTemplateId`, payer, terceiro ou reembolso. Aplicação a lançamento sempre propõe `status=PENDING`, `actualAmount=null` e `paidAt=null`.

### 8.1 Nome e duplicidade

A unicidade será `@@unique([userId, normalizedName])`, incluindo ativos e arquivados e independentemente da natureza. Isso segue a normalização já adotada em categorias, mas é mais restrito por finalidade: o nome é a identidade exibida no seletor e dois itens “Aluguel” seriam indistinguíveis. Usuários diferentes podem repetir nomes. Conflito ativo ou arquivado retorna `409 TEMPLATE_NAME_CONFLICT`; no segundo caso a UI orienta incluir arquivados e restaurar, sem criar cópia.

### 8.2 Dia sugerido

Adota-se `dueDay` opcional `1..31`, pois captura o padrão civil sem timezone. Ao aplicar em novo lançamento:

1. usa o mês/ano da `dueDate` já escolhida se ela ainda não tiver sido modificada manualmente;
2. na ausência dessa referência, usa o mês/ano da data civil atual fornecida por relógio controlável;
3. gera `min(dueDay, último dia do mês)`; assim 31 vira 28/29 em fevereiro e 30 em abril;
4. o resultado é apenas sugestão editável e nunca muda o modelo.

Ao aplicar a recorrência, `dueDay` sugere `frequency=MONTHLY` e `dayOfMonth=dueDay` somente se o usuário ainda não tiver configurado manualmente o calendário. Se já o configurou, o calendário é preservado; a UI informa que apenas os defaults financeiros foram aplicados. A geração posterior continua usando a regra mensal canônica da SPEC-007. Para frequência semanal/anual, `dueDay` não é copiado ao calendário.

## 9. Ownership, segurança e privacidade

- Toda rota exige autenticação e deriva `userId` do contexto da SPEC-002; body, query e resposta não aceitam/expõem owner.
- Toda consulta e mutação filtra simultaneamente `id` e `userId`. UUID inexistente, inválido ou alheio retorna o mesmo `404 TEMPLATE_NOT_FOUND`, sem revelar existência.
- Categoria e conta referenciadas também devem pertencer ao owner; recurso alheio/ausente retorna `404 RELATED_RESOURCE_NOT_FOUND` indistinguível.
- DTOs usam whitelist e rejeitam campos desconhecidos, inclusive campos realizados e internos.
- Nome, descrição, notas, conta, categoria e valor são dados financeiros privados. Logs podem conter somente operação, status HTTP, duração, correlation ID não sensível e classe agregada do erro; nunca payload, token, owner, UUID, texto, valor ou data financeira.
- A UI renderiza textos escapados. Testes, capturas e evidências usam somente dados sintéticos e sanitizados.

## 10. Regras de ciclo de vida

### 10.1 Criar e editar

- Criar exige todos os campos obrigatórios e valida referência própria, ativa e compatível.
- `PATCH` aceita ao menos um campo público editável e valida o estado completo resultante. `type` pode mudar somente junto de `categoryId` compatível na mesma requisição ou quando a categoria atual já for compatível.
- Apenas modelo ativo aceita `PATCH`; modelo arquivado retorna `409 TEMPLATE_ARCHIVED`.
- Definir `defaultAccountId=null` remove a conta padrão.
- Alterações iguais após normalização são sucesso `200` sem escrita e preservam `updatedAt`.

### 10.2 Arquivar e restaurar

- Arquivamento lógico é idempotente: preenche `archivedAt` uma vez e preserva `updatedAt` em repetição.
- Restauração é idempotente e preserva referências próprias mesmo que tenham sido arquivadas depois. O modelo volta ativo com os indicadores de indisponibilidade da seção 12 e pode então receber `PATCH` para referências ativas; isso evita o impasse de exigir edição enquanto o modelo ainda está arquivado. A unicidade abrangente impede conflito de nome inesperado. Inconsistência de ownership ou natureza não pode surgir por arquivamento; se detectada como corrupção, a restauração falha com erro interno seguro e sem exposição de dados.
- Arquivado não aparece em lista/seletor padrão, mas aparece com `includeArchived=true`, pode ser consultado e restaurado.
- Não existe `DELETE`. Arquivar/restaurar modelo não toca conta, categoria, lançamento ou recorrência.

## 11. Aplicação em novo lançamento

Aplicar modelo é operação **exclusivamente local sobre o rascunho** a partir da projeção já lida; não existe endpoint `apply`.

1. Usuário pode iniciar lançamento manualmente ou escolher “Usar modelo…”.
2. Seleção copia `type`, categoria disponível, descrição, notas, valor previsto, conta padrão disponível e vencimento sugerido.
3. Define o rascunho como `PENDING`, sem realizado/pagamento. O usuário ainda pode escolher `PAID` e preencher os campos exigidos antes de salvar conforme SPEC-005.
4. Nenhum POST é feito até o CTA explícito de salvar; fechar/cancelar segue a política de rascunho da SPEC-013.
5. Todos os campos copiados permanecem editáveis. Conta pode ser removida/trocada no rascunho, mas a API de lançamento continua exigindo uma conta ativa no salvamento.
6. “Remover modelo” remove somente a indicação efêmera de origem e mantém os valores atuais do rascunho.
7. Salvar usa o contrato normal `POST /api/transactions`, sem `templateId`; o lançamento é independente.

### 11.1 Troca segura de modelo

A UI mantém, apenas durante a sessão do formulário, quais campos diferem do último estado preenchido automaticamente. Ao trocar de modelo:

- se nenhum campo relevante foi modificado manualmente, substitui os defaults sem confirmação;
- se `type`, categoria, conta, descrição, notas, previsto, vencimento ou campos de realizado/status foram modificados, apresenta confirmação acessível listando genericamente que alterações serão substituídas, sem expor valores em telemetria;
- cancelar preserva integralmente o rascunho; confirmar reaplica o novo modelo, volta a `PENDING` e limpa `actualAmount`/`paidAt`, evitando transformar defaults em fato;
- remover a indicação do modelo nunca limpa o rascunho.

## 12. Referências arquivadas na aplicação

O modelo preserva suas FKs quando conta/categoria é arquivada posteriormente; não há cascade nem reativação automática.

- **Categoria arquivada:** modelo continua visível com aviso “Categoria padrão indisponível”. Ao aplicar, `categoryId` fica vazio; o restante é copiado. Salvar fica bloqueado até escolher categoria própria, ativa e compatível. A API de modelos nunca afirma que o default está utilizável apenas pela existência da FK.
- **Conta padrão arquivada:** modelo continua utilizável com aviso “Conta padrão indisponível”. Ao aplicar, `accountId` fica vazio, nunca recebe a conta arquivada; o restante é copiado. Uma conta própria ativa deve ser escolhida antes de salvar lançamento/recorrência.
- **Ambas arquivadas:** os dois avisos aparecem, ambos os IDs ficam vazios no rascunho e não há criação silenciosa inválida.
- Arquivamento posterior não invalida leitura histórica nem altera lançamentos/recorrências já salvos. FKs `RESTRICT` preservam integridade.

## 13. Integração com recorrências

- “Usar modelo…” aparece somente quando `kind=TRANSACTION`; nunca em `TRANSFER`.
- A escolha copia os defaults compatíveis para o rascunho da recorrência. `defaultAccountId` vira `accountId` somente se ativo; `type`, categoria, previsto, descrição e notas seguem as mesmas regras do lançamento.
- A conta é opcional no modelo, mas obrigatória no contrato atual de recorrência. Categoria/conta indisponível deixa o rascunho incompleto e impede salvar até correção.
- Frequência, horizonte, `startDate`, `endDate` e calendário continuam pertencendo à recorrência. A exceção é somente a sugestão condicional de `dueDay` descrita em 8.2.
- Salvar usa o `POST/PATCH /api/recurrences` existente, sem `templateId` ou `sourceTemplateId`. Não há caso de uso concreto que justifique auditoria de origem, portanto nenhum vínculo é persistido.
- Alterar, arquivar ou restaurar modelo não altera, pausa, bloqueia ou interrompe recorrência já salva. A recorrência mantém sua cópia e obedece à SPEC-007.
- Ocorrências materializadas continuam `PENDING`, independentes do modelo e editáveis pelas regras da SPEC-005. Mudança de conta, previsto/realizado, notas ou status em uma ocorrência não altera modelo, regra nem outras ocorrências.

Não há conflito com a SPEC-007 atual: ela já persiste o template financeiro na própria `RecurrenceRule` e define que edição afeta somente datas futuras ainda não geradas. Esta SPEC adiciona apenas uma origem opcional de preenchimento do rascunho antes da validação existente.

## 14. Previsto versus realizado e efeitos financeiros

- `plannedAmount` do modelo é default. Valor realizado não pertence ao modelo.
- Uma ocorrência pode manter previsto `1800.00`, ser paga por `1923.00` e registrar notas sobre a diferença; isso não altera o modelo, a recorrência ou outras ocorrências.
- Criar, editar, arquivar, restaurar ou aplicar modelo não altera saldo, orçamento, dashboard, projeções, DRE ou cash position.
- Somente lançamento salvo/materializado entra nas projeções aplicáveis; somente realização válida produz os efeitos definidos nas SPECs existentes. Não há nova regra financeira.

## 15. UX mobile-first e web responsiva

- O ponto “Usar modelo…” reservado pela SPEC-013 torna-se ação secundária opcional entre natureza e campos essenciais; criação manual permanece primeira classe.
- O seletor usa bottom sheet/dialog responsivo, lista somente ativos por padrão e mostra compactamente nome, natureza, categoria, valor previsto e disponibilidade da conta. Não vira formulário administrativo pesado.
- Ordem determinística: `normalizedName ASC`, `id ASC`. Não existem favoritos, ranking, analytics ou `lastUsedAt`.
- Com 8 ou mais modelos ativos, exibe busca por nome/descrição, case-insensitive e com trim; abaixo disso a busca pode permanecer disponível, mas não é obrigatória. Estado vazio oferece criar modelo sem bloquear o lançamento manual.
- Gestão de modelos fica em “Mais”/planejamento ou superfície secundária equivalente, com lista, criação/edição leve, arquivados e restauração; não compete com o CTA principal de lançamento.
- Mobile de 320 px, tablet e desktop até 1440 px usam os mesmos contratos/componentes responsivos. Teclado, rotação, Android Back e safe areas preservam rascunho conforme SPEC-013.
- Loading não abre lista parcial como sucesso; erro é anunciado e permite tentar novamente. Submissão duplicada fica bloqueada.
- Seletor, confirmação, avisos e campos têm nome/papel/estado acessíveis, foco inicial e retorno de foco definidos, navegação por teclado, contraste AA, área de toque mínima e texto a 200% sem corte. Avisos não dependem só de cor.

## 16. Contratos de API propostos

Nome final: `transaction-templates`, coerente com `transactions` e com o termo técnico já usado para o bloco financeiro de recorrências. Todas as rotas ficam sob o prefixo global `/api`, exigem Bearer, whitelist e projeção pública.

```ts
type TransactionTemplateType = 'INCOME' | 'EXPENSE';

interface CreateTransactionTemplateRequest {
  name: string;
  type: TransactionTemplateType;
  categoryId: string;
  description: string;
  plannedAmount: string;
  defaultAccountId?: string | null;
  notes?: string | null;
  dueDay?: number | null;
}

type UpdateTransactionTemplateRequest =
  Partial<CreateTransactionTemplateRequest>;

interface PublicTransactionTemplate {
  id: string;
  name: string;
  type: TransactionTemplateType;
  categoryId: string;
  categoryAvailable: boolean;
  description: string;
  plannedAmount: string;
  defaultAccountId: string | null;
  defaultAccountAvailable: boolean;
  notes: string | null;
  dueDay: number | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TransactionTemplateListQuery {
  type?: TransactionTemplateType;
  includeArchived?: boolean; // padrão false
  q?: string; // nome/descrição, trim, 1–80 caracteres
}

type ListTransactionTemplatesResponse = PublicTransactionTemplate[];
```

Os booleanos de disponibilidade são calculados no momento da leitura sem apagar os IDs persistidos; não expõem dados da relação alheia. `defaultAccountAvailable` é `false` quando não há conta ou quando ela está arquivada; a ausência é distinguida por `defaultAccountId=null`. Respostas decimais têm duas casas.

| Método e rota | Request | Sucesso | Erros específicos |
|---|---|---|---|
| `GET /api/transaction-templates` | filtros opcionais acima | `200` lista própria ordenada | `400 VALIDATION_ERROR`, `401` |
| `POST /api/transaction-templates` | create completo | `201 PublicTransactionTemplate` | `400`, `404 RELATED_RESOURCE_NOT_FOUND`, `409 TEMPLATE_NAME_CONFLICT`, `409 CATEGORY_TYPE_MISMATCH`, `409 RELATED_RESOURCE_ARCHIVED` |
| `GET /api/transaction-templates/:id` | sem body/query | `200 PublicTransactionTemplate` | `401`, `404 TEMPLATE_NOT_FOUND` |
| `PATCH /api/transaction-templates/:id` | update não vazio | `200 PublicTransactionTemplate` | erros de criação, `404`, `409 TEMPLATE_ARCHIVED` |
| `POST /api/transaction-templates/:id/archive` | sem body/query | `200 PublicTransactionTemplate` | `401`, `404`; idempotente |
| `POST /api/transaction-templates/:id/restore` | sem body/query | `200 PublicTransactionTemplate`, inclusive com disponibilidade `false` | `401`, `404`; idempotente |

Não há `DELETE`, endpoint `apply`, paginação ou total nesta versão. A coleção pessoal é pequena, a lista compacta é necessária ao seletor e filtros/busca limitam a renderização; uma SPEC futura deverá adicionar cursor antes de aceitar escala que torne a resposta ilimitada um risco. Campo desconhecido, query repetida/tipo incorreto, UUID malformado ou body onde proibido retorna `400 VALIDATION_ERROR`. Falha inesperada usa envelope compartilhado e `500 INTERNAL_ERROR`, sem falso sucesso.

## 17. Persistência e migration futura

A implementação exigirá **uma migration nova, aditiva**, sem editar migrations existentes:

- enum existente `FinancialTransactionType` pode ser reutilizado para `type`, sem criar semântica nova;
- tabela Prisma `TransactionTemplate` com todas as colunas da seção 8;
- relação `user User` e coleção inversa, FK `userId -> User.id ON DELETE RESTRICT`;
- FK `categoryId -> FinancialCategory.id ON DELETE RESTRICT` e relação inversa;
- FK nullable `defaultAccountId -> FinancialAccount.id ON DELETE RESTRICT` e relação inversa nomeada;
- `plannedAmount Decimal @db.Decimal(19,2)`, nunca `Float`; check SQL positivo e dentro do contrato;
- `dueDay Int?` com check `NULL OR BETWEEN 1 AND 31`; não usar `DateTime`;
- `archivedAt`, `createdAt`, `updatedAt` conforme padrão atual;
- unique abrangente `(userId, normalizedName)`;
- índice de seletor `(userId, archivedAt, normalizedName, id)` e índices de `categoryId` e `defaultAccountId`; validar planos em PostgreSQL real;
- FKs preservam modelo quando relações são arquivadas. Nenhuma migration apaga ou converte dados existentes.

Integridade de owner cruzando tabelas e compatibilidade categoria/natureza devem ser garantidas transacionalmente no serviço e testadas; não se inventa FK composta sem decisão arquitetural. Hard delete futuro de usuário/conta/categoria continua bloqueado por `RESTRICT` até política própria.

## 18. Regras de negócio resumidas

| ID | Regra |
|---|---|
| `RN-01` | Modelo é conjunto de defaults sem efeito financeiro. |
| `RN-02` | Owner deriva da sessão e isola todas as operações. |
| `RN-03` | Modelo aceita somente `INCOME | EXPENSE`. |
| `RN-04` | Categoria é obrigatória, própria, ativa ao escrever e compatível. |
| `RN-05` | Conta padrão é opcional, própria e ativa ao definir, nunca obrigatória para ocorrências futuras. |
| `RN-06` | Dinheiro segue string decimal exata da SPEC-005 e nunca float. |
| `RN-07` | Aplicar apenas copia para rascunho editável e inicia pendente. |
| `RN-08` | Nenhuma aplicação salva ou realiza automaticamente. |
| `RN-09` | Lançamento salvo não mantém vínculo com modelo. |
| `RN-10` | Recorrência recebe cópia e não mantém vínculo com modelo. |
| `RN-11` | Alterar/arquivar modelo não altera lançamentos, recorrências ou ocorrências. |
| `RN-12` | Referência arquivada permanece íntegra, mas não é aplicada silenciosamente. |
| `RN-13` | `dueDay` é civil, opcional e ajustado ao último dia do mês. |
| `RN-14` | Arquivamento/restauração são lógicos e idempotentes; não há hard delete. |

## 19. Critérios de aceite

### `CA-01 — Criar modelo válido`
**Dado** usuário com categoria compatível ativa **Quando** cria modelo válido **Então** recebe `201`, decimal canônico e nenhuma entidade financeira é criada.

### `CA-02 — Ownership do recurso`
**Dado** UUID alheio **Quando** consulta, edita, arquiva ou restaura **Então** recebe o mesmo `404` de inexistente e nada é revelado.

### `CA-03 — Listagem isolada`
**Dado** modelos de dois usuários **Quando** um lista **Então** recebe somente os próprios na ordem definida.

### `CA-04 — Nome e normalização`
**Dado** nome vazio, acima de 80 ou com controle **Quando** envia **Então** recebe `400`; espaços externos são removidos.

### `CA-05 — Nome duplicado`
**Dado** modelo ativo ou arquivado `Aluguel` **Quando** o owner cria ` aluguel ` **Então** recebe `409 TEMPLATE_NAME_CONFLICT` sem duplicata.

### `CA-06 — Categoria compatível`
**Dado** categoria `INCOME` **Quando** cria/edita modelo `EXPENSE` com ela **Então** recebe `409 CATEGORY_TYPE_MISMATCH`.

### `CA-07 — Conta padrão opcional`
**Dado** criação com conta ativa ou `null` **Quando** salva **Então** ambas são válidas e `null` não escolhe conta implicitamente.

### `CA-08 — Aplicar no novo lançamento`
**Dado** modelo ativo válido **Quando** seleciona “Usar modelo…” **Então** defaults são copiados ao formulário existente e status fica `PENDING`.

### `CA-09 — Campos editáveis após aplicar`
**Dado** rascunho preenchido **Quando** troca conta, previsto, descrição, notas, categoria, natureza ou vencimento **Então** a UI permite alteração e valida normalmente.

### `CA-10 — Aplicação não salva`
**Dado** modelo selecionado **Quando** não aciona salvar **Então** não ocorre POST de lançamento, recorrência ou modelo.

### `CA-11 — Lançamento independente`
**Dado** lançamento salvo a partir do modelo **Quando** consulta persistência/contrato **Então** não existe `templateId` e ele segue somente SPEC-005.

### `CA-12 — Edição do modelo não é retroativa`
**Dado** lançamento anterior **Quando** modelo muda ou é arquivado **Então** nenhum campo/timestamp do lançamento muda.

### `CA-13 — Criar recorrência a partir de modelo`
**Dado** rascunho `TRANSACTION` **Quando** aplica modelo e completa calendário/conta **Então** salva pelo contrato da SPEC-007 com valores copiados.

### `CA-14 — Recorrência independente`
**Dado** recorrência salva **Quando** inspeciona **Então** não existe `templateId/sourceTemplateId`; sua configuração própria permanece completa.

### `CA-15 — Alteração não afeta recorrência`
**Dado** recorrência criada a partir do modelo **Quando** modelo muda/é arquivado **Então** regra, cursor, bloqueio e ocorrências não mudam.

### `CA-16 — Arquivar modelo`
**Dado** modelo ativo **Quando** arquiva uma ou duas vezes **Então** a primeira preenche `archivedAt`, a segunda é no-op e ele some da lista padrão.

### `CA-17 — Restaurar modelo`
**Dado** modelo arquivado com referências válidas **Quando** restaura uma ou duas vezes **Então** fica ativo sem duplicar nem alterar no segundo pedido.

### `CA-18 — Seletor omite arquivados`
**Dado** ativos e arquivados **Quando** abre “Usar modelo…” **Então** somente ativos aparecem; gestão com `includeArchived=true` mostra ambos.

### `CA-19 — Categoria arquivada`
**Dado** categoria do modelo arquivada depois **Quando** aplica **Então** modelo permanece visível, avisa indisponibilidade, deixa categoria vazia e impede salvar até escolha compatível ativa.

### `CA-20 — Conta padrão arquivada`
**Dado** conta padrão arquivada depois **Quando** aplica **Então** não a seleciona, avisa, mantém outros defaults e exige conta ativa antes de salvar.

### `CA-21 — Previsto versus realizado`
**Dado** previsto `1800.00` aplicado **Quando** usuário salva/paga ocorrência por `1923.00` **Então** diferença é válida pelas regras da SPEC-005 e não altera defaults nem outras ocorrências.

### `CA-22 — Dia 31 em mês curto`
**Dado** `dueDay=31` e mês de fevereiro de 2028/2027 ou abril **Quando** aplica **Então** sugere respectivamente 29/28 de fevereiro ou 30 de abril, sem timezone.

### `CA-23 — Nenhum float`
**Dado** contratos/schema futuro **Quando** validados **Então** valor é string/`Decimal(19,2)`, preserva limite da SPEC-005 e nenhum caminho usa float.

### `CA-24 — Nenhum efeito isolado em agregações`
**Dado** criar/editar/aplicar/arquivar modelo sem salvar lançamento **Quando** consulta saldo, budget e dashboard **Então** todas as respostas permanecem idênticas.

### `CA-25 — Nenhum modelo de transferência ou terceiro`
**Dado** API, schema e UI **Quando** inspecionados **Então** não aceitam `TRANSFER`, payer, parceiro, terceiro ou reembolso.

### `CA-26 — Seletor mobile e busca`
**Dado** viewport 320 px e ao menos 8 modelos **Quando** abre seletor **Então** busca por nome/descrição funciona, lista compacta não transborda e criação manual continua disponível.

### `CA-27 — Web responsiva`
**Dado** viewports mobile, tablet e desktop até 1440 px **Quando** aplica/remove/troca modelo **Então** usa o mesmo fluxo e preserva rascunho sem sobreposição.

### `CA-28 — Troca segura`
**Dado** campos relevantes alterados manualmente **Quando** troca modelo **Então** pede confirmação; cancelar preserva e confirmar reaplica como pendente. Sem alteração manual, não pede confirmação.

### `CA-29 — Erros e indisponibilidade`
**Dado** `400/401/404/409`, rede ou `500` **Quando** ocorre **Então** mensagem contextual é anunciada, não há falso sucesso, payload sensível não é logado e tentativa segura permanece possível.

### `CA-30 — Acessibilidade`
**Dado** teclado, leitor de tela, contraste AA e texto a 200% **Quando** usa gestão/seletor/confirmação/avisos **Então** foco, labels, estados e erros são perceptíveis sem depender de cor.

### `CA-31 — Migration somente na implementação`
**Dado** esta tarefa documental **Quando** revisa o diff **Então** não há Prisma/migration; a implementação futura cria migration nova sem editar anteriores.

### `CA-32 — Rollback documental e futuro`
**Dado** necessidade de rollback **Quando** executa o plano da seção 23 **Então** documento/código podem ser revertidos sem hard delete automático nem alteração retroativa de fatos financeiros.

## 20. Testes futuros obrigatórios

Todos usam dados sintéticos, relógio controlado e evidências sanitizadas.

| Nível | Cobertura mínima | Evidência esperada |
|---|---|---|
| Unitário | normalização/unicidade; DTOs; decimal; textos; disponibilidade; clamp de `dueDay`; cópia e troca segura; ausência de efeitos | Vitest/Nest determinístico, sem infraestrutura |
| API/controller/service | CRUD, filtros, archive/restore, whitelisting, erros, projeção, referências, no-op e ausência de `apply`/DELETE | testes automatizados nomeados |
| Integração PostgreSQL | migration nova; Decimal/checks/FKs/unique/índices; owner com dois usuários; concorrência de nome/arquivo; referências arquivadas e `RESTRICT` | PostgreSQL real identificado; mocks não substituem constraints |
| Ownership/segurança | leitura e todas as mutações cruzadas; relações alheias; projeção/logs | `404` indistinguível e logs sanitizados |
| Contratos shared | requests/responses/filtros/enums/erros e strings monetárias | build e testes do pacote compartilhado |
| Componentes frontend | lista/gestão/seletor/busca/avisos/confirmação/rascunho/editabilidade/loading/erros/a11y | testes de componentes com mocks declarados |
| Playwright mobile | 320 px: manual, aplicar, trocar, remover, arquivados indisponíveis e salvar | E2E contra API/banco de teste |
| Playwright desktop | mesmos fluxos em desktop responsivo, teclado e foco | E2E contra API/banco de teste |
| Android emulador | teclado, rotação, Back, safe area, busca e persistência do rascunho | matriz com versão/dispositivo sintético |
| Android aparelho físico | fluxo principal criar/aplicar/editar/salvar; TalkBack smoke e offline/erro | checklist humano, modelo/Android e evidência sanitizada |
| Regressão transactions | manual e via modelo; `PENDING/PAID`, pay/reopen, decimal, owner e relações | suíte existente mais cenários novos |
| Regressão recurrences | criação vazia/via modelo; geração, edição, pausa, bloqueio, archive, idempotência | suíte existente sem mudança de regra financeira |
| Regressão budget/dashboard | modelo isolado não altera qualquer total; lançamento materializado conta uma vez conforme SPECs | comparação exata antes/depois |

Lint, typecheck, unitários, integração, E2E e build completos são obrigatórios na implementação. Aceitação humana em aparelho físico é bloqueante para concluir o fluxo UX principal. Nesta tarefa documental, essas suítes de runtime são não aplicáveis; verificam-se formato, estrutura, links, escopo e diff.

## 21. Fora do escopo

- Pagamento por terceiro / despesa paga por outra pessoa (evolução futura separada).
- Reembolso, compartilhamento, organizações, parceiro, `payer`, `thirdParty` ou obrigação entre pessoas.
- Favoritos, recentes, ranking inteligente, analytics e `lastUsedAt`.
- IA, OCR e importação.
- Modelos de transferência; transferências continuam exclusivamente na SPEC-006.
- Automação por modelo sem recorrência e endpoint `apply`.
- Atualização em massa de lançamentos ou recorrências.
- Alterar lançamentos passados ou recorrências salvas ao editar modelo.
- Nova regra financeira, aconselhamento ou movimentação de dinheiro.
- Offline sync, notificações, paginação e hard delete.

## 22. Dependências, compatibilidade e riscos

### 22.1 Dependências

Não há dependência nova. A futura implementação reutiliza NestJS, Vue/Quasar/Capacitor, Prisma/PostgreSQL, contratos shared e ferramentas de teste aprovadas. Qualquer biblioteca adicional exige justificativa e aprovação explícitas em tarefa própria.

### 22.2 Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Usuário interpretar default como fato pago | Alto | sempre iniciar `PENDING`, CTA explícito e nunca copiar realizado/pagamento |
| Acoplamento vivo sobrescrever histórico | Alto | cópia sem `templateId/sourceTemplateId`; CAs de independência |
| Referência arquivada gerar dado inválido | Alto | disponibilidade calculada, ID não aplicado, aviso e validação backend |
| Vazamento entre usuários | Alto | owner em todas as queries/relações e `404` indistinguível |
| Centavos perdidos | Alto | string + Decimal(19,2), mesma validação da SPEC-005 |
| Troca de modelo apagar edição | Médio | dirty tracking e confirmação seletiva |
| Dia civil variar por timezone | Médio | inteiro 1–31, calendário civil e relógio controlável |
| Lista crescer sem paginação | Médio | busca/filtros; gatilho para SPEC futura antes de volume relevante |
| UX administrativa pesar o fluxo principal | Médio | seletor compacto opcional e gestão secundária |
| Divergência entre web e Android | Médio | componentes compartilhados, E2E duplo e aparelho físico |

Riscos residuais: a busca sem paginação assume coleção pessoal pequena; restaurar exige corrigir referências arquivadas; e aplicar `dueDay` depende de uma data civil de referência explicitamente controlada. Esses limites são visíveis e não alteram regras financeiras.

## 23. Rollback

- **Esta documentação:** `git revert <hash-do-commit>` remove a SPEC e sua entrada no índice sem tocar runtime ou dados.
- **Implementação futura antes de uso real:** reverter código por commit; desativar/remover exposição por migration compensatória somente com aprovação e sem editar migration aplicada.
- **Implementação futura com dados:** primeiro remover UI/rotas de escrita e preservar tabela/FKs como dados dormentes; não executar `DROP`, hard delete ou cascade automaticamente. Migration destrutiva/anonimização depende de decisão humana e plano separado.
- Lançamentos e recorrências nunca exigem rollback ao remover modelos, pois não possuem vínculo funcional. Validar invariância de saldos, budget/dashboard e histórico após rollback.

## 24. Arquivos permitidos e proibidos

Nesta tarefa documental, permitidos somente:

- `docs/specs/SPEC-014-MODELOS-DE-LANCAMENTO-E-INTEGRACAO-COM-RECORRENCIAS.md`;
- `docs/specs/README.md`.

Proibidos nesta tarefa: `apps/**`, `packages/**`, schema Prisma, migrations, dependências, ADRs, demais SPECs, CI e qualquer runtime.

O escopo de arquivos da implementação futura deverá ser autorizado após aprovação humana desta SPEC e incluir somente migration nova/schema, módulo API, contratos shared, UI/testes de modelos e integrações estritamente necessárias em lançamentos/recorrências.

## 25. Dúvidas e decisões pendentes

Não há ambiguidade funcional interna identificada. Entretanto, todas as decisões deste documento — especialmente unicidade global por owner, `dueDay`, ausência de paginação e ausência de vínculo de origem — permanecem **pendentes de aprovação humana**, coerentemente com o status `Em revisão`.

## 26. Definition of Done específica

Para aprovação futura:

- [ ] Diagnóstico AS-IS e compatibilidade com SPEC-007 revisados por pessoa autorizada.
- [ ] Conceitos modelo/recorrência/lançamento continuam distintos.
- [ ] Campos, ownership, arquivamento, API, migration, UX e rollback são aceitos.
- [ ] Todos os 32 critérios são mensuráveis e têm cobertura prevista.
- [ ] Pagamento por terceiro permanece evolução separada.

Para implementação futura:

- [ ] SPEC está `Aprovada` antes do primeiro código.
- [ ] Migration é nova/aditiva e migrations anteriores permanecem byte a byte intactas.
- [ ] Lint, typecheck, unitários, integração PostgreSQL, contratos, componentes, Playwright mobile/desktop e build passam.
- [ ] Android emulador e aparelho físico validam o fluxo principal.
- [ ] Regressões de transactions, recurrences, budget e dashboard passam com valores exatos.
- [ ] Nenhum dado real, credencial, vínculo vivo, transferência, terceiro ou item fora de escopo foi incluído.

## 27. Histórico de alterações

| Data | Alteração | Motivo | Autor | Aprovação |
|---|---|---|---|---|
| `2026-08-11` | Criação da SPEC-014 com status `Em revisão`. | Definir modelos de lançamento como defaults independentes e sua integração por cópia com recorrências. | `Codex Cloud` | Pendente de revisão humana |
