# SPEC de funcionalidade — `SPEC-007 — Recorrências financeiras`

> Esta SPEC aprova somente uma implementação futura. Esta unidade é exclusivamente documental e não cria código, Prisma, migration, dependência, endpoint, tela ou infraestrutura.

## 1. Identificação

| Campo | Valor |
|---|---|
| ID | `SPEC-007` |
| Título | `Recorrências financeiras` |
| Responsável | `Codex Cloud` |
| Data de criação | `2026-08-07` |
| Última atualização | `2026-08-07` |
| Tarefa relacionada | `PROMPT-SPEC-007-RECORRENCIAS-FINANCEIRAS.md` |
| Documentos relacionados | `SPEC-002` a `SPEC-006`; `ADR-001` a `ADR-006`; documentos de produto, processo e qualidade |

## 2. Status

`Aprovada`

**Aprovada por:** tarefa `PROMPT-SPEC-007-RECORRENCIAS-FINANCEIRAS.md`, em `2026-08-07`.

## 3. Contexto

Autenticação, contas, categorias, lançamentos e transferências já possuem contratos aprovados. Recorrência é uma definição própria que projeta ocorrências futuras; ela não representa realização financeira. A solução deve aproveitar PostgreSQL, Prisma, NestJS e Vue/Quasar já aprovados, sem custo adicional, Redis, serviço externo ou GitHub Actions.

## 4. Problema

O usuário ainda precisa cadastrar repetição de receitas, despesas e transferências manualmente. Sem regras únicas de calendário, vínculo, propriedade e concorrência, geradores podem duplicar valores, deslocar datas, reescrever histórico ou produzir dados para outro usuário.

## 5. Objetivo

Definir uma regra/template recorrente, sua gestão e uma geração incremental, determinística, auditável, idempotente e isolada por owner que mantenha ocorrências pendentes até 60 dias à frente, sem alterar ocorrências já materializadas.

## 6. Fora do escopo

- Frequência diária, cron customizado, intervalos diferentes de uma semana, dias úteis, feriados e enésimo dia da semana.
- Cartões, faturas, parcelamento, dívidas, orçamento, notificações, importação, IA e multimoeda.
- Pagamento ou conclusão automática; aconselhamento financeiro ou movimentação de dinheiro.
- Android/iOS, deploy, escolha do scheduler de produção, serviço pago, Redis e GitHub Actions.
- Reativação de regra arquivada e exclusão física.
- Alterações em autenticação, CORS, CSRF, CI, produto, ADRs ou SPECs anteriores.
- Implementação de código, Prisma, migration, dependência, endpoint, tela ou infraestrutura nesta tarefa.

## 7. Termos

| Termo | Definição adotada nesta SPEC |
|---|---|
| Regra recorrente | Definição e template que pode gerar ocorrências; não é lançamento nem transferência. |
| Ocorrência | Lançamento ou transferência materializado para uma data civil prevista. |
| Data de ocorrência | Data civil calculada pela regra e copiada para `dueDate`. |
| Horizonte | Data civil atual mais 60 dias, inclusive. |
| Bloqueada | Sinalização de atenção causada por referência posteriormente arquivada; não é novo `status`. |
| Owner | Usuário autenticado derivado do token. |
| Data civil atual | Data `YYYY-MM-DD` fornecida por relógio controlável, sem conversão de timezone. |

## 8. Comportamento atual

As SPECs anteriores definem autenticação e isolamento, contas e categorias arquiváveis, lançamentos `PENDING | PAID` e transferências `PENDING | COMPLETED`. Não há regra recorrente, vínculo de recorrência ou executor confirmado. O CI permanece desativado por custo.

## 9. Comportamento desejado

### 9.1 Tipos e ciclo de vida

- `RecurrenceKind`: `TRANSACTION | TRANSFER`; `RecurrenceStatus`: `ACTIVE | PAUSED`; `RecurrenceFrequency`: `WEEKLY | MONTHLY | YEARLY`.
- Regra ativa e não arquivada pode gerar; pausada, bloqueada ou arquivada não gera.
- Arquivamento é lógico por `archivedAt`, preserva regra e ocorrências e não permite reativação nesta versão.
- `attentionStatus` é `READY | BLOCKED`. Ao detectar referência própria arquivada, o gerador, no lugar de gerar, grava atomicamente `BLOCKED`, `blockedReason=RELATED_RESOURCE_ARCHIVED`, `blockedResourceType`, `blockedResourceId` e `blockedAt`. Esses campos formam a sinalização mínima auditável, são expostos apenas ao owner e não mudam `status`.
- Edição que substitua todas as referências inválidas por recursos próprios, ativos e compatíveis limpa os quatro campos de bloqueio e restaura `READY`. O sistema nunca reativa conta/categoria. Um gerador também pode limpar bloqueio somente após confirmar que a mesma referência voltou a estar ativa por fluxo autorizado externo; não há reativação automática do recurso.

### 9.2 Calendário

- `startDate` é obrigatória; `endDate` é opcional e inclusiva. Ambas são datas gregorianas estritas `YYYY-MM-DD`, persistidas como `date`, e `endDate >= startDate`.
- `WEEKLY` exige `dayOfWeek` ISO `1` (segunda) a `7` (domingo). A sequência tem intervalo fixo de sete dias. A primeira data é o primeiro `dayOfWeek` igual ou posterior a `startDate`.
- `MONTHLY` exige `dayOfMonth` inteiro de 1 a 31. Em cada mês, a data é `min(dayOfMonth, último dia do mês)`: dia 29 vira 28 em fevereiro comum; dias 30 e 31 também viram 28 ou 29 em fevereiro; dia 31 vira 30 em abril, junho, setembro e novembro.
- `YEARLY` exige `monthOfYear` de 1 a 12 e `dayOfMonth` válido nesse mês em ao menos um ano gregoriano. `29/02` é permitido e vira `28/02` em ano não bissexto. Combinações impossíveis, como `31/04`, são rejeitadas; não são normalizadas.
- Somente datas calculadas iguais ou posteriores a `startDate` e iguais ou anteriores a `endDate`, quando existente, pertencem à sequência.
- Todos os cálculos usam componentes civis, sem `DateTime`, UTC, horário ou deslocamento de timezone.

### 9.3 Templates

- `TRANSACTION` exige `transactionType INCOME | EXPENSE`, `accountId`, `categoryId`, `plannedAmount`, `description` e `notes` opcional. A ocorrência copia esses campos, recebe `status=PENDING`, `dueDate=occurrenceDate`, `actualAmount=null` e `paidAt=null`.
- `TRANSFER` exige `sourceAccountId`, `destinationAccountId`, `plannedAmount`, `description` e `notes` opcional. A ocorrência copia esses campos, recebe `status=PENDING`, `dueDate=occurrenceDate`, `actualAmount=null` e `completedAt=null`.
- Valores e textos seguem exatamente formatos, precisão e limites de SPEC-005/006. Campos do outro kind, `status`, realizados e datas de realização são proibidos.
- Ao criar ou editar, referências devem pertencer ao owner, estar ativas, origem deve diferir do destino e categoria deve ser compatível com `transactionType`. `userId` nunca vem do cliente.

### 9.4 Geração incremental e idempotência

- Cada execução recebe uma data civil atual do relógio do servidor e considera o horizonte inclusivo de 60 dias. A janela oferece visibilidade de aproximadamente dois meses para planejamento pessoal sem materializar anos ou aumentar custo operacional; abrange ao menos oito ocorrências semanais e um a três ciclos mensais.
- Para cada regra elegível, o gerador começa em `nextOccurrenceDate`, gera sequencialmente enquanto a data for `<= hoje + 60 dias` e `<= endDate`, e atualiza `nextOccurrenceDate` para a primeira data ainda não processada; após o fim, grava `null`.
- Regra criada começa com a primeira data da sequência `>= startDate`. Datas anteriores ao dia de criação não são materializadas: para criação, `nextOccurrenceDate` é a primeira data válida `>= max(startDate, hoje)`.
- A transação de cada regra bloqueia a linha da regra (`SELECT ... FOR UPDATE` ou equivalente), relê estado/template e bloqueia/valida referências. Criação da ocorrência e avanço do cursor ocorrem atomicamente. Edição, pause, resume e archive usam o mesmo bloqueio e ordem de locks.
- Restrições únicas parciais/conceitualmente equivalentes em `(recurrenceRuleId, occurrenceDate)` em cada tabela de ocorrência são a garantia final. Conflito é tratado como ocorrência já existente e o cursor avança; nunca se cria duplicata.
- Falha após algumas regras ou entre ocorrências pode ser repetida: transações confirmadas permanecem, a regra incompleta retoma pelo cursor e o unique absorve retry. Falha numa regra não impede tentar as demais e gera sumário técnico sem dados financeiros.
- O executor seleciona apenas regras do owner alvo quando houver execução manual; execução periódica percorre owners por filtro interno explícito. Nenhuma consulta ou insert pode omitir `userId`.

### 9.5 Concorrência

- Dois geradores serializam por regra; o unique mantém no máximo uma ocorrência por regra/data mesmo sob falha de lock ou retry.
- Geração versus edição: vence quem obtiver o lock primeiro. A geração relê o template sob lock; ocorrência confirmada antes da edição permanece intacta, e a edição só afeta datas ainda não geradas.
- Geração versus pause/archive: a operação que obtiver o lock primeiro conclui atomicamente. Uma ocorrência já confirmada permanece; após pause/archive confirmado nenhuma nova ocorrência pode ser confirmada.
- Geração versus arquivamento de conta/categoria: ambos bloqueiam as linhas relacionadas em ordem determinística. Se o arquivamento confirmar primeiro, a regra é bloqueada sem gerar; se a ocorrência confirmar primeiro, ela é histórico válido e o arquivamento impede as próximas.
- O gerador não mantém transação global sobre todas as regras, evitando que uma falha parcial reverta trabalho independente.

### 9.6 Edição, pausa e retomada

- PATCH valida a regra completa resultante. `kind` é imutável; frequência, calendário e template podem mudar quando a regra não está arquivada.
- Ocorrências existentes nunca são atualizadas, removidas ou desvinculadas pela regra. Somente seus fluxos normais podem editá-las.
- Após edição, `nextOccurrenceDate` é a primeira data da nova sequência igual ou posterior à data civil atual e posterior a toda `occurrenceDate` já vinculada. Isso evita retroatividade e tentativa de reusar datas materializadas; se ultrapassar `endDate`, fica `null`.
- Pausar é idempotente, muda `ACTIVE` para `PAUSED` e não altera ocorrências. Enquanto pausada, nenhuma data é registrada como perdida individualmente.
- Retomar é idempotente e define `ACTIVE`; recalcula o cursor como a primeira data válida `>= max(startDate, hoje)`, posterior à maior data já vinculada e dentro de `endDate`. Não materializa datas passadas durante a pausa.
- Arquivar é idempotente, preenche `archivedAt` uma vez, impede geração e preserva histórico. Regra arquivada não aceita PATCH, pause ou resume.

### 9.7 Execução automática futura

O domínio disponibilizará um serviço gerador idempotente invocável periodicamente no processo já hospedado. A cadência e o scheduler de produção serão definidos em SPEC de infraestrutura/deploy. Não há dependência de Redis, fila externa, serviço pago ou GitHub Actions. A ausência temporária de scheduler não muda o algoritmo: a próxima execução recompõe somente o horizonte futuro permitido.

## 10. Personas ou atores

| Ator | Necessidade | Ações autorizadas |
|---|---|---|
| Usuário autenticado | Planejar repetições próprias. | Criar, consultar, listar, editar, pausar, retomar, arquivar e disparar geração própria se a rota técnica estiver habilitada. |
| Executor interno | Manter horizonte futuro. | Invocar o caso de uso com escopo explícito e sem acessar projeções públicas. |
| Visitante | Privacidade preservada. | Nenhuma ação financeira. |

## 11. Fluxos

### 11.1 Fluxo principal

1. Usuário abre `/recurrences`, escolhe lançamento ou transferência, calendário e template.
2. API deriva owner, valida DTO e referências e cria a regra com cursor determinístico.
3. Gerador bloqueia a regra e referências, materializa pendentes até o horizonte e avança o cursor.
4. Web apresenta próxima ocorrência, estado, atenção e ações válidas.
5. Usuário pode editar apenas o futuro, pausar, retomar ou arquivar a regra.

### 11.2 Fluxos alternativos e exceções

- Referência ausente/alheia → `404 RELATED_RESOURCE_NOT_FOUND`, indistinguível.
- Referência própria arquivada na escrita → `409 RELATED_RESOURCE_ARCHIVED`; após criação, o gerador bloqueia e sinaliza a regra.
- Conflito de categoria → `409 CATEGORY_TYPE_MISMATCH`; contas iguais → `400 VALIDATION_ERROR`.
- Regra arquivada → `409 RECURRENCE_ARCHIVED`; ausente/alheia → `404 RECURRENCE_NOT_FOUND`.
- API indisponível → sem falso sucesso, formulário seguro preservado e nova tentativa disponível.

## 12. Regras de negócio

| ID | Regra | Origem/decisão | Exemplo |
|---|---|---|---|
| `RN-01` | Regra é distinta das ocorrências. | Princípio | Criar regra não é pagar. |
| `RN-02` | Tipos, estados e frequências são enums fechados. | Tarefa | `DAILY` falha. |
| `RN-03` | Datas são civis e limites inclusivos. | Tarefa | `endDate` pode gerar. |
| `RN-04` | Ajustes mensal/anual seguem a seção 9.2. | Tarefa | 31/04 vira 30/04 mensal. |
| `RN-05` | Ocorrências geradas são sempre pendentes. | Tarefa | Sem `paidAt`. |
| `RN-06` | Referências são próprias, ativas e coerentes na escrita/geração. | Segurança | Conta alheia dá 404. |
| `RN-07` | Recurso arquivado bloqueia e sinaliza sem apagar histórico. | Tarefa | `attentionStatus=BLOCKED`. |
| `RN-08` | Horizonte é hoje + 60 dias, inclusivo. | Decisão | Não materializa anos. |
| `RN-09` | Há no máximo uma ocorrência por regra/data/tabela. | Princípio | Retry não duplica. |
| `RN-10` | Edição só afeta datas não geradas. | Tarefa | Histórico não muda. |
| `RN-11` | Pausa e archive não alteram ocorrências. | Tarefa | Pendente permanece. |
| `RN-12` | Resume não repõe datas perdidas. | Tarefa | Cursor começa hoje ou depois. |
| `RN-13` | Owner deriva do token e integra toda operação. | SPEC-002 | Body não aceita `userId`. |
| `RN-14` | Arquivamento é lógico e sem reativação. | Tarefa | Sem DELETE. |
| `RN-15` | Manual nunca vira recorrente implicitamente. | Tarefa | Vínculo manual é nulo. |
| `RN-16` | Falha parcial e concorrência são repetíveis com segurança. | Tarefa | Cursor/unique recuperam. |

## 13. Modelo de dados

### 13.1 `RecurrenceRule`

| Campo | Tipo conceitual/futuro | Obrigatório | Regra |
|---|---|---|---|
| `id` | UUID | Sim | PK gerada pelo servidor. |
| `userId` | UUID | Sim | FK `User`, interna e imutável. |
| `kind` | `RecurrenceKind` | Sim | Imutável. |
| `status` | `RecurrenceStatus` | Sim | Inicial `ACTIVE`. |
| `frequency` | `RecurrenceFrequency` | Sim | Enum fechado. |
| `startDate` | data civil | Sim | Limite inferior inclusivo. |
| `endDate` | data civil | Não | Limite superior inclusivo. |
| `dayOfWeek` | inteiro 1–7 | Condicional | Somente `WEEKLY`. |
| `dayOfMonth` | inteiro 1–31 | Condicional | `MONTHLY` ou `YEARLY`. |
| `monthOfYear` | inteiro 1–12 | Condicional | Somente `YEARLY`. |
| `transactionType` | `INCOME | EXPENSE` | Condicional | Somente `TRANSACTION`. |
| `accountId` | UUID | Condicional | Somente `TRANSACTION`. |
| `categoryId` | UUID | Condicional | Somente `TRANSACTION`. |
| `sourceAccountId` | UUID | Condicional | Somente `TRANSFER`. |
| `destinationAccountId` | UUID | Condicional | Somente `TRANSFER`, diferente da origem. |
| `plannedAmount` | decimal exato `19,2` | Sim | Positivo, regras de SPEC-005/006. |
| `description` | texto até 200 | Sim | Regras de SPEC-005/006. |
| `notes` | texto até 2.000 | Não | Texto simples ou `null`. |
| `nextOccurrenceDate` | data civil | Não | Próxima data ou `null` quando encerrada. |
| `attentionStatus` | `READY | BLOCKED` | Sim | Inicial `READY`. |
| `blockedReason` | `RELATED_RESOURCE_ARCHIVED` | Não | Presente somente bloqueada. |
| `blockedResourceType` | `ACCOUNT | CATEGORY` | Não | Presente somente bloqueada. |
| `blockedResourceId` | UUID | Não | Referência que causou o bloqueio. |
| `blockedAt` | instante | Não | Primeiro instante do bloqueio vigente. |
| `archivedAt` | instante | Não | Arquivamento lógico. |
| `createdAt` | instante | Sim | Servidor. |
| `updatedAt` | instante | Sim | Servidor; no-op idempotente não altera. |

Checks futuros garantem campos exclusivos por `kind` e `frequency`, coerência do bloco de atenção, datas e valores. FKs para usuário, contas e categoria usam `ON DELETE RESTRICT`; relações não aplicáveis ficam nulas. Índices mínimos: `(userId, archivedAt, status, nextOccurrenceDate)`, `(userId, kind, frequency)` e referências do template, sujeitos a `EXPLAIN`.

### 13.2 Vínculo das ocorrências

- Adicionar de forma aditiva `recurrenceRuleId UUID NULL` e `occurrenceDate date NULL` a `FinancialTransaction` e `FinancialTransfer`.
- Ambos são nulos em registro manual; ambos são preenchidos em ocorrência gerada. Check impede somente um deles preenchido.
- FK `recurrenceRuleId -> RecurrenceRule.id ON DELETE RESTRICT`; o serviço garante mesmo owner e kind correspondente.
- Unique em cada tabela para `(recurrenceRuleId, occurrenceDate)` quando o vínculo não é nulo. O mesmo dia pode existir uma vez em cada regra; regra de um kind jamais gera na tabela oposta.
- Registros existentes permanecem manuais com nulos. Nunca há conversão ou vínculo retroativo silencioso.

### 13.3 Migration futura

Uma migration nova e aditiva criará enums/tabela/índices/checks e colunas opcionais; nenhuma migration anterior será editada. A implantação deve permitir registros antigos, aplicar FKs `RESTRICT` e provar constraints em PostgreSQL.

## 14. Contratos de API

Todas as rotas exigem Bearer token, DTO explícito, whitelist e rejeição de campos desconhecidos. UUID alheio/inválido/ausente produz o mesmo 404 no recurso principal. Projeções nunca expõem `userId`.

### 14.1 Tipos compartilhados

```ts
type RecurrenceKind = 'TRANSACTION' | 'TRANSFER';
type RecurrenceStatus = 'ACTIVE' | 'PAUSED';
type RecurrenceFrequency = 'WEEKLY' | 'MONTHLY' | 'YEARLY';
type RecurrenceAttentionStatus = 'READY' | 'BLOCKED';

type RecurrenceCalendar =
  | { frequency: 'WEEKLY'; dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7 }
  | { frequency: 'MONTHLY'; dayOfMonth: number }
  | { frequency: 'YEARLY'; monthOfYear: number; dayOfMonth: number };

type RecurrenceTemplate =
  | { kind: 'TRANSACTION'; transactionType: 'INCOME' | 'EXPENSE'; accountId: string; categoryId: string; plannedAmount: string; description: string; notes?: string | null }
  | { kind: 'TRANSFER'; sourceAccountId: string; destinationAccountId: string; plannedAmount: string; description: string; notes?: string | null };

type CreateRecurrenceRequest = RecurrenceCalendar & RecurrenceTemplate & {
  startDate: string;
  endDate?: string | null;
};

type UpdateRecurrenceRequest = Partial<Omit<CreateRecurrenceRequest, 'kind'>>;

type PublicRecurrence = CreateRecurrenceRequest & {
  id: string;
  status: RecurrenceStatus;
  nextOccurrenceDate: string | null;
  attentionStatus: RecurrenceAttentionStatus;
  blockedReason: 'RELATED_RESOURCE_ARCHIVED' | null;
  blockedResourceType: 'ACCOUNT' | 'CATEGORY' | null;
  blockedResourceId: string | null;
  blockedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
```

`PATCH` usa DTO discriminado: só aceita campos que componham uma regra completa válida; não aceita `kind`, `status`, atenção, cursor, owner, timestamps nem vínculos. Respostas monetárias têm duas casas e datas civis permanecem strings.

### 14.2 Operações

| Operação | Entrada | Sucesso | Erros específicos | Idempotência |
|---|---|---|---|---|
| `POST /api/recurrences` | `CreateRecurrenceRequest` | `201 PublicRecurrence` | `400`, `404 RELATED_RESOURCE_NOT_FOUND`, `409 RELATED_RESOURCE_ARCHIVED/CATEGORY_TYPE_MISMATCH` | Não cria retry key; novo POST válido cria nova regra. |
| `GET /api/recurrences` | Query opcional `kind`, `status`, `frequency`, `includeArchived=false` | `200 PublicRecurrence[]` | `400`, `401` | Leitura. |
| `GET /api/recurrences/:id` | UUID na rota | `200 PublicRecurrence` | `404 RECURRENCE_NOT_FOUND` | Leitura. |
| `PATCH /api/recurrences/:id` | `UpdateRecurrenceRequest` não vazio | `200 PublicRecurrence` | `400`, `404`, `409 RECURRENCE_ARCHIVED` e relações | Mesmo estado canônico é no-op sem mudar `updatedAt`. |
| `POST /api/recurrences/:id/pause` | Body ausente | `200 PublicRecurrence` | `404`, `409 RECURRENCE_ARCHIVED` | Pausada é no-op. |
| `POST /api/recurrences/:id/resume` | Body ausente | `200 PublicRecurrence` | `404`, `409 RECURRENCE_ARCHIVED/RECURRENCE_BLOCKED` | Ativa é no-op; cursor ainda é validado. |
| `POST /api/recurrences/:id/archive` | Body ausente | `200 PublicRecurrence` | `404` | Preserva primeiro `archivedAt`. |
| `POST /api/recurrences/:id/generate` | Body ausente | `200 { generatedCount, throughDate, nextOccurrenceDate }` | `404`, `409 RECURRENCE_BLOCKED` | Idempotente por lock, cursor e unique. |

A rota manual de geração é aprovada apenas como acionador operacional/testável do mesmo caso de uso, limitada a uma regra do owner autenticado e ao horizonte fixo; não aceita data, owner nem template e não substitui a futura execução periódica.

Listagem ordena `archivedAt NULLS FIRST`, `nextOccurrenceDate ASC NULLS LAST`, `createdAt DESC`, `id ASC`. Não há paginação porque o volume de regras pessoais é baixo; métrica que demonstre crescimento exigirá SPEC própria.

## 15. Interface

A rota protegida `/recurrences` contém listagem, estado vazio, criação e edição. O formulário escolhe receita, despesa ou transferência; semanal, mensal ou anual; início/fim; parâmetros da frequência e template aplicável. Exibe estado, próxima ocorrência, aviso de bloqueio com recurso afetado e ações de pausar, retomar e arquivar com confirmação.

Controles incompatíveis não coexistem; recursos arquivados não aparecem em seletores novos. Loading impede submissão duplicada. Falha de API não simula sucesso e permite tentar novamente. Em telas estreitas, cartões e formulário usam uma coluna, ações permanecem acessíveis e não há rolagem horizontal; desktop pode usar tabela/painel.

## 16. Validações

| Campo ou ação | Validação | Resultado esperado |
|---|---|---|
| `kind/frequency` | Enum fechado | `400 VALIDATION_ERROR`. |
| `startDate/endDate` | Datas existentes e ordem válida | `400 VALIDATION_ERROR`. |
| Calendário | Exatamente os campos da frequência | `400 VALIDATION_ERROR`. |
| Template | Exatamente os campos do kind | `400 VALIDATION_ERROR`. |
| Valor/texto | SPEC-005/006 | `400 VALIDATION_ERROR`. |
| Referências | Mesmo owner e ativas | 404 indistinguível ou 409 de arquivada própria. |
| Categoria | Natureza compatível | `409 CATEGORY_TYPE_MISMATCH`. |
| Transferência | Origem diferente do destino | `400 VALIDATION_ERROR`. |
| Resume | Não arquivada nem bloqueada | `409` quando impedido. |
| Campo desconhecido/interno | Rejeitado | `400 VALIDATION_ERROR`. |

## 17. Permissões

| Ação | Ator autorizado | Condição | Negação |
|---|---|---|---|
| CRUD lógico e transições | Usuário autenticado | Regra própria | `401` ou 404 indistinguível. |
| Geração manual | Usuário autenticado | Regra própria, elegível | `401`, 404 ou 409. |
| Geração periódica | Executor interno | Escopo interno autenticado/configurado e filtro de owner | Falha fechada, sem geração. |
| Ler ocorrência | Usuário autenticado | Fluxo normal e owner da ocorrência | Contrato de SPEC-005/006. |

## 18. Segurança e privacidade

- Dados financeiros pessoais: descrições, notas, valores, datas, contas, categorias e padrões de repetição.
- Ameaças: IDOR, mass assignment, geração cross-user, duplicidade concorrente, injeção e vazamento em logs.
- Proteções: autenticação obrigatória; owner do token; filtros por owner em regra, referências e inserts; DTOs fechados; transações, locks, constraints e FKs; texto renderizado sem HTML.
- Recurso alheio retorna 404 indistinguível. Autenticação, CSRF e CORS permanecem inalterados.
- Logs/evidências não contêm token, descrição, notas, valor, IDs completos de recurso ou outros dados financeiros; usam correlation id, contagens, duração, resultado e identificador técnico minimizado/hasheado quando indispensável.

## 19. Erros e estados vazios

| Situação | Estado apresentado | Recuperação |
|---|---|---|
| Sem regras | Explicação e ação “Criar recorrência” | Abrir formulário. |
| Regra bloqueada | Aviso sem alterar ocorrências | Editar referências ou reativá-las por fluxo próprio. |
| Sem próxima data | “Recorrência encerrada” | Consultar/arquivar; editar se aplicável. |
| API indisponível | Erro sem falso sucesso | Preservar entrada segura e tentar novamente. |
| Sessão inválida | Nenhum dado privado | Redirecionar ao login. |
| Geração parcial | Sumário técnico seguro | Retry idempotente. |

## 20. Observabilidade

Registrar início/fim do lote, regras examinadas, geradas, bloqueadas, ignoradas, conflitos únicos absorvidos, falhas e duração. Métricas: ocorrências geradas, retries, bloqueios por motivo, erros e defasagem do cursor. Alertas e scheduler são de infraestrutura futura. Não registrar payloads ou dados financeiros sensíveis.

## 21. Migração e compatibilidade

- Dados existentes: permanecem manuais, com vínculo e data de ocorrência nulos.
- Compatibilidade: APIs atuais continuam aceitando e devolvendo lançamentos/transferências; campos internos novos só entram em contratos dessas entidades mediante implementação compatível aprovada.
- Migration necessária na implementação: sim, nova e aditiva, conforme seção 13.3; migrations anteriores intactas.
- Implantação gradual: migration, backend e web em entrega compatível; scheduler fica para SPEC de deploy. CI não será reativado.

## 22. Critérios de aceite

### `CA-01 — Criar receita semanal`
**Dado** usuário autenticado e referências próprias ativas **Quando** cria `TRANSACTION/INCOME/WEEKLY` **Então** a regra ativa tem cursor no primeiro dia semanal válido.

### `CA-02 — Criar despesa mensal`
**Dado** conta e categoria de despesa ativas **Quando** cria regra mensal **Então** o template de despesa é preservado sem realização.

### `CA-03 — Criar transferência anual`
**Dado** duas contas próprias ativas e distintas **Quando** cria regra anual **Então** a regra `TRANSFER` é criada sem categoria.

### `CA-04 — Rejeitar tipo diário`
**Dado** DTO com `DAILY` **Quando** é validado **Então** retorna 400 sem persistir.

### `CA-05 — Semanal após início`
**Dado** início numa terça e segunda escolhida **Quando** calcula a primeira data **Então** escolhe a segunda seguinte.

### `CA-06 — Intervalo semanal`
**Dado** uma sequência semanal **Quando** calcula datas sucessivas **Então** há exatamente sete dias civis entre elas.

### `CA-07 — Mensal dia 28`
**Dado** dia 28 **Quando** calcula qualquer mês **Então** usa dia 28.

### `CA-08 — Mensal dia 29 em fevereiro comum`
**Dado** dia 29 e fevereiro não bissexto **Quando** calcula **Então** usa 28/02.

### `CA-09 — Mensal dia 29 bissexto`
**Dado** fevereiro bissexto **Quando** calcula dia 29 **Então** usa 29/02.

### `CA-10 — Mensal dia 30 em fevereiro`
**Dado** dia 30 em fevereiro **Quando** calcula **Então** usa o dia 28 ou 29 válido.

### `CA-11 — Mensal dia 31 em mês de 30`
**Dado** dia 31 e abril **Quando** calcula **Então** usa 30/04.

### `CA-12 — Mensal dia 31 em mês de 31`
**Dado** dia 31 e maio **Quando** calcula **Então** usa 31/05.

### `CA-13 — Anual 29/02 comum`
**Dado** regra anual 29/02 e ano comum **Quando** calcula **Então** usa 28/02.

### `CA-14 — Anual 29/02 bissexto`
**Dado** regra anual 29/02 e ano bissexto **Quando** calcula **Então** usa 29/02.

### `CA-15 — Rejeitar data anual impossível`
**Dado** calendário anual 31/04 **Quando** valida **Então** retorna 400 sem normalizar.

### `CA-16 — Respeitar início`
**Dado** data calculada anterior a `startDate` **Quando** inicia sequência **Então** essa data não é gerada.

### `CA-17 — Incluir fim`
**Dado** ocorrência exatamente em `endDate` **Quando** gera **Então** ela é incluída.

### `CA-18 — Excluir após fim`
**Dado** próxima data posterior a `endDate` **Quando** avança **Então** nada gera e cursor vira nulo.

### `CA-19 — Data civil sem timezone`
**Dado** ocorrência `2027-03-28` **Quando** persiste e lê em fusos distintos **Então** a string permanece igual.

### `CA-20 — Lançamento gerado pendente`
**Dado** regra transaction elegível **Quando** gera **Então** cria `PENDING`, dueDate igual à ocorrência e realizado/pagamento nulos.

### `CA-21 — Transferência gerada pendente`
**Dado** regra transfer elegível **Quando** gera **Então** cria `PENDING`, dueDate igual à ocorrência e realizado/conclusão nulos.

### `CA-22 — Não realizar automaticamente`
**Dado** qualquer regra **Quando** gera **Então** nenhuma ocorrência fica `PAID` ou `COMPLETED`.

### `CA-23 — Vínculo explícito`
**Dado** ocorrência gerada **Quando** é consultada no domínio **Então** possui regra e `occurrenceDate` correspondentes.

### `CA-24 — Registro manual`
**Dado** lançamento ou transferência criado no fluxo normal **Quando** persiste **Então** ambos os campos recorrentes são nulos.

### `CA-25 — Não converter manual`
**Dado** registro manual existente **Quando** cria/edita regra **Então** ele não é vinculado nem alterado.

### `CA-26 — Horizonte de 60 dias`
**Dado** regra sem fim **Quando** gera hoje **Então** materializa somente datas até hoje + 60, inclusive.

### `CA-27 — Retry idempotente`
**Dado** geração concluída **Quando** repete no mesmo horizonte **Então** a contagem nova é zero e não duplica.

### `CA-28 — Dois geradores`
**Dado** dois geradores simultâneos **Quando** processam a mesma regra/data **Então** há no máximo uma ocorrência.

### `CA-29 — Falha parcial`
**Dado** falha após parte do lote **Quando** repete **Então** completa o restante sem duplicar o confirmado.

### `CA-30 — Editar futuro`
**Dado** regra com ocorrências existentes **Quando** altera template **Então** somente ocorrências posteriores ainda não geradas usam o novo template.

### `CA-31 — Preservar ocorrência editada manualmente`
**Dado** ocorrência gerada depois editada pelo fluxo normal **Quando** a regra muda **Então** a ocorrência continua intacta.

### `CA-32 — Recalcular cursor após edição`
**Dado** calendário alterado **Quando** PATCH confirma **Então** o cursor é a primeira data nova hoje/ou depois e posterior ao histórico vinculado.

### `CA-33 — Pausar`
**Dado** regra ativa **Quando** pausa **Então** fica `PAUSED` e ocorrências existentes não mudam.

### `CA-34 — Não gerar pausada`
**Dado** regra pausada **Quando** gerador executa **Então** nenhuma ocorrência nova é criada.

### `CA-35 — Retomar sem retroatividade`
**Dado** datas transcorridas durante pausa **Quando** retoma **Então** o cursor usa a primeira data válida hoje/ou depois sem repor as perdidas.

### `CA-36 — Arquivar`
**Dado** regra não arquivada **Quando** arquiva **Então** preenche `archivedAt`, preserva histórico e deixa de gerar.

### `CA-37 — Arquivamento idempotente`
**Dado** regra arquivada **Quando** arquiva novamente **Então** preserva o primeiro timestamp sem efeito adicional.

### `CA-38 — Conta arquivada posteriormente`
**Dado** conta do template arquivada após criação **Quando** gerador a encontra **Então** não gera e grava bloqueio auditável.

### `CA-39 — Categoria arquivada posteriormente`
**Dado** categoria do template arquivada após criação **Quando** gera **Então** preserva antigas, não cria nova e sinaliza `RELATED_RESOURCE_ARCHIVED`.

### `CA-40 — Corrigir bloqueio por edição`
**Dado** regra bloqueada **Quando** owner troca a referência por uma própria ativa e compatível **Então** limpa atenção e permite geração futura sem retroatividade.

### `CA-41 — Referência alheia na criação`
**Dado** ID pertencente a outro usuário **Quando** cria regra **Então** retorna 404 indistinguível e nada persiste.

### `CA-42 — Referência alheia na edição`
**Dado** regra própria e referência alheia **Quando** edita **Então** retorna 404 indistinguível e mantém a regra.

### `CA-43 — Nenhuma geração cross-user`
**Dado** regras de usuários distintos **Quando** geração manual do usuário A ocorre **Então** somente regra e ocorrências de A são acessadas.

### `CA-44 — Categoria incompatível`
**Dado** despesa e categoria de receita **Quando** cria/edita **Então** retorna 409 e nada gera.

### `CA-45 — Contas iguais`
**Dado** mesma origem e destino **Quando** cria transferência recorrente **Então** retorna 400.

### `CA-46 — Geração versus edição`
**Dado** operações concorrentes **Quando** confirmam **Então** serializam e cada ocorrência usa integralmente o template anterior ou posterior.

### `CA-47 — Geração versus pause/archive`
**Dado** operações concorrentes **Quando** pause/archive confirma **Então** nenhuma geração posterior confirma, sem apagar a que venceu antes.

### `CA-48 — Geração versus recurso arquivado`
**Dado** geração e arquivamento da referência concorrentes **Quando** confirmam **Então** ou a ocorrência anterior é válida ou a regra bloqueia, nunca surge ocorrência após o archive confirmado.

### `CA-49 — Sem autenticação`
**Dado** sessão ausente/expirada **Quando** acessa API ou web **Então** recebe 401/redirecionamento sem dados privados.

### `CA-50 — Recurso principal alheio`
**Dado** ID de regra alheia **Quando** consulta, altera ou gera **Então** recebe o mesmo 404 de regra inexistente.

### `CA-51 — Filtros de listagem`
**Dado** regras variadas **Quando** filtra kind, status, frequency e arquivadas **Então** recebe somente próprias que satisfazem todos os filtros.

### `CA-52 — Estado vazio`
**Dado** owner sem regras visíveis **Quando** abre a rota **Então** vê orientação e ação de criação.

### `CA-53 — Próxima ocorrência na web`
**Dado** regra com cursor **Quando** lista **Então** exibe a data civil exata; cursor nulo exibe encerrada.

### `CA-54 — API indisponível`
**Dado** formulário preenchido **Quando** API falha **Então** não indica sucesso, preserva entrada segura e permite retry.

### `CA-55 — Responsividade`
**Dado** viewport estreito **Quando** usa listagem/formulário **Então** conteúdo e ações ficam acessíveis sem rolagem horizontal.

## 23. Testes obrigatórios

| Nível | Cenários mínimos | Critérios relacionados | Evidência esperada |
|---|---|---|---|
| Unitário | Próxima semanal; mensal 28/29/30/31 e fevereiro; anual 29/02; start/end; criação/edição; pause/resume; idempotência; ambos kinds; owner/referências; arquivado | `CA-01`–`CA-45` | Relatório determinístico com relógio controlado. |
| Integração PostgreSQL | Migration, checks/unique/FKs, criação, geração/retry/concorrência, vínculos, pendentes, owner, arquivado, pause/resume/archive e migrations anteriores intactas | `CA-20`–`CA-50` | Banco PostgreSQL real e planos/constraints registrados. |
| Contrato/API | DTOs, códigos, filtros, 404 indistinguível, projeção e rota manual | `CA-01`–`CA-05`, `CA-41`–`CA-51` | Testes HTTP automatizados. |
| Web | Vazio; criação semanal/mensal/anual e transaction/transfer; edição; pause/resume; próxima; bloqueio; indisponibilidade; redirecionamento; responsividade | `CA-01`–`CA-03`, `CA-30`–`CA-40`, `CA-49`, `CA-52`–`CA-55` | Testes de componentes e capturas aplicáveis. |
| E2E | Login; despesa mensal; gerar e conferir; repetir; pausar sem gerar; retomar; logout | `CA-02`, `CA-20`, `CA-27`, `CA-33`–`CA-35`, `CA-49` | Execução em stack real. |
| Aceitação manual | Fluxos desktop/móvel, atenção, textos e datas limítrofes | Todos aplicáveis | Checklist sem dados sensíveis. |

## 24. Arquivos permitidos

Na implementação futura autorizada por esta SPEC: módulos compartilhados, backend, web e testes estritamente necessários a recorrências; `schema.prisma` e **uma nova migration** aditiva; adições de vínculo em lançamentos/transferências. A tarefa documental atual permite somente `docs/specs/SPEC-007-RECORRENCIAS-FINANCEIRAS.md`.

## 25. Arquivos proibidos

- Migrations existentes, autenticação, CORS, CSRF, CI e configuração de GitHub Actions.
- ADRs, documentos de produto, SPECs anteriores e funcionalidades fora do escopo.
- Nesta tarefa documental, qualquer arquivo diferente desta SPEC.

## 26. Dependências

| Dependência | Motivo | Estado | Impacto |
|---|---|---|---|
| SPEC-002 a SPEC-006 | Owner, referências e ocorrências | Aprovadas | Contratos preservados. |
| ADR-001 a ADR-006 | Arquitetura e qualidade | Aprovadas | Implementação futura coerente. |
| PostgreSQL/Prisma/NestJS/Vue/Quasar existentes | Stack aprovada | Aprovada | Sem dependência nova. |
| Scheduler de produção | Invocação periódica | Fora desta SPEC | Não bloqueia domínio nem rota manual. |

Nenhuma dependência nova ou paga é aprovada.

## 27. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Duplicidade concorrente | Média | Saldo/projeção incorretos | Lock, transação e unique. |
| Erro em fim de mês/bissexto | Média | Data errada | Algoritmo civil e testes exaustivos. |
| Corrida com edição/archive | Média | Template incoerente | Ordem de locks e releitura transacional. |
| Referência arquivada | Alta | Geração inválida | Validar, bloquear e sinalizar. |
| Cursor incorreto pular/repor datas | Média | Ausência/retroatividade | Fórmula determinística, vínculo e testes. |
| Vazamento cross-user | Baixa | Privacidade crítica | Owner em todas as queries/inserts e 404 uniforme. |
| Executor indisponível | Média | Horizonte desatualizado | Retry manual/periódico idempotente; deploy futuro. |
| Crescimento de regras | Baixa | Listagem lenta | Índices, métricas e paginação em SPEC futura. |

## 28. Rollback

Na implementação futura, desabilitar invocação do gerador e reverter aplicação antes da migration. Ocorrências já geradas são dados financeiros auditáveis e não serão apagadas automaticamente. Reverter a migration somente se nenhuma regra/vínculo tiver sido criado; caso contrário, preservar schema/dados e produzir migration compensatória aprovada. Validar contagens, vínculos e inexistência de duplicatas. Para esta unidade documental, rollback é `git revert <hash-do-commit>`.

## 29. Dúvidas

Não há dúvidas abertas. Scheduler e cadência de produção são deliberadamente remetidos a SPEC de infraestrutura/deploy e não alteram o comportamento aprovado.

## 30. Decisões aprovadas

| Data | Decisão | Responsável | Consequência |
|---|---|---|---|
| `2026-08-07` | Status inicial aprovado e escopo exclusivamente documental. | Tarefa | Autoriza futura implementação, não nesta unidade. |
| `2026-08-07` | Horizonte inclusivo de 60 dias e cursor persistido. | Tarefa | Planejamento útil sem materialização excessiva. |
| `2026-08-07` | `archivedAt` sem DELETE/reativação de regra. | Tarefa | Histórico preservado. |
| `2026-08-07` | Atenção mínima persistida com estado, motivo, recurso e instante. | Tarefa | Bloqueio observável e auditável. |
| `2026-08-07` | Rota manual limitada ao owner aciona o gerador comum. | Tarefa | Operação/teste sem depender de scheduler ou CI. |
| `2026-08-07` | Listagem sem paginação. | Tarefa | Adequada ao baixo volume inicial. |

## 31. Definition of Done específica

Além da [Definition of Done do projeto](../quality/DEFINITION-OF-DONE.md), a implementação futura exige:

- [ ] Os 55 critérios de aceite foram automatizados ou justificados e validados.
- [ ] Lint, typecheck, unitários, integração PostgreSQL, contrato, web, E2E e build aplicáveis passaram.
- [ ] Concorrência comprovou no máximo uma ocorrência por regra/data.
- [ ] Migrations anteriores permanecem byte a byte intactas e a nova migration é aditiva.
- [ ] Nenhuma geração cross-user ou dado financeiro sensível em logs.
- [ ] CI continua desativado e nenhum serviço pago/Redis foi introduzido.
- [ ] Evidências, riscos residuais e comandos foram anexados ao PR da implementação.

Para esta unidade documental: template completo, ao menos 40 cenários Dado/Quando/Então, links/caminhos válidos, revisão de diff e verificações documentais aprovadas.

## 32. Histórico de alterações da SPEC

| Data | Alteração | Motivo | Autor | Aprovador |
|---|---|---|---|---|
| `2026-08-07` | Criação da SPEC-007 com status `Aprovada`. | Definir recorrências financeiras antes da implementação. | Codex Cloud | Tarefa `PROMPT-SPEC-007-RECORRENCIAS-FINANCEIRAS.md` |
