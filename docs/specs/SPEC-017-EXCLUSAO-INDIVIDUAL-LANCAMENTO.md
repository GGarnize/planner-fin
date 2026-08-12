# SPEC de funcionalidade — `SPEC-017 — Exclusão individual de lançamento`

## 1. Identificação

| Campo | Valor |
|---|---|
| ID | `SPEC-017` |
| Título | Exclusão individual de lançamento |
| Responsável | Equipe Planner Fin |
| Data de criação | `2026-08-12` |
| Última atualização | `2026-08-12` |
| Tarefa relacionada | `PROMPT-SPEC-017-EXCLUSAO-LANCAMENTO.md` |
| Documentos relacionados | SPEC-005, SPEC-007, SPEC-010, SPEC-011, SPEC-013, SPEC-014 e SPEC-016 |

## 2. Status

`Aprovada`

**Aprovada por:** autorização rastreável na tarefa `PROMPT-SPEC-017-EXCLUSAO-LANCAMENTO.md`, em `2026-08-12`.

## 3. Contexto

A SPEC-005 criou lançamentos `PENDING` e `PAID`, mas excluiu deliberadamente delete e archive. A SPEC-007 passou a materializar ocorrências com a identidade única `(recurrenceRuleId, occurrenceDate)`. A SPEC-014 cria lançamentos a partir de modelos sem manter vínculo do lançamento com o modelo. A SPEC-016 confirmou que a interface não poderia oferecer exclusão sem contrato de backend seguro.

Esta unidade fecha o contrato futuro. Ela é somente documental: não altera código, schema, migration, API ou interface.

## 4. Problema

O owner não consegue retirar um lançamento individual criado por engano de suas listas e cálculos. Uma remoção física perderia rastreabilidade e permitiria que o `upsert` da geração recorrente recriasse uma ocorrência apagada. Também é necessário evitar efeitos parciais e corridas com pagar, reabrir, editar ou gerar recorrências.

## 5. Objetivo

Definir uma exclusão lógica, individual, idempotente, transacional e isolada por owner, que retire o lançamento dos read models sem alterar seus dados financeiros, modelo de origem ou regra e demais ocorrências de recorrência.

## 6. Fora do escopo

- Implementação, migration ou abertura do endpoint nesta tarefa documental.
- Lixeira, consulta de excluídos e restore.
- Exclusão em massa, hard delete ou retenção/purga física.
- Exclusão/alteração de recorrências, modelos, contas ou categorias.
- Transferências, cartões, dívidas, importações, setup, personalização e autenticação/sessão Android.

## 7. Termos

| Termo | Definição adotada nesta SPEC |
|---|---|
| Exclusão lógica | Preenchimento imutável de `deletedAt`, preservando a linha e todos os valores anteriores. |
| Tombstone | A própria ocorrência recorrente com `deletedAt` preenchido e identidade única preservada. |
| Ativo | Lançamento com `deletedAt = null`. |
| Excluído | Lançamento com `deletedAt != null`, invisível e sem efeito nos read models normais. |
| Owner | Usuário autenticado cujo `userId` é dono do lançamento. |

## 8. Comportamento atual e auditoria

- `FinancialTransaction` não possui `deletedAt`; contém `userId`, estado, valores, datas e, opcionalmente, `recurrenceRuleId` e `occurrenceDate`.
- O par `(recurrenceRuleId, occurrenceDate)` é único. A geração usa `upsert` com `update: {}`, portanto uma linha preservada já impede nova criação para a mesma ocorrência.
- O controller expõe `POST`, `GET`, `PATCH`, `POST :id/pay` e `POST :id/reopen`; não há `DELETE`.
- Listagem, consulta, saldo de conta, dashboard e orçamento consultam `FinancialTransaction` sem filtro de exclusão porque o campo ainda não existe.
- Saldo realizado considera somente `PAID`, por `actualAmount` e `paidAt`; dashboard e orçamento combinam lançamentos pagos e pendentes conforme as regras das SPEC-010/011.
- Contas, categorias, cartões, dívidas, recorrências e modelos adotam `archivedAt`; contas e categorias possuem archive/restore idempotente. Esse padrão preserva histórico, mas lançamento usa o termo `deletedAt` porque a intenção do usuário e a rota canônica são excluir, não desativar para reutilização.
- Um lançamento instanciado por modelo é uma cópia comum, sem FK para `TransactionTemplate`; alterá-lo não altera o modelo.

## 9. Comportamento desejado

### 9.1 Semântica

A exclusão será **soft delete lógico**, nunca mudança de `status` e nunca hard delete. Em uma única transação de banco, o backend localizará e bloqueará a linha própria e ativa e preencherá `deletedAt` com o instante UTC do servidor. `status`, `plannedAmount`, `actualAmount`, `dueDate`, `paidAt`, `recurrenceRuleId`, `occurrenceDate`, relações, `createdAt` e demais dados permanecerão inalterados. A implementação não aceitará timestamp enviado pelo cliente.

Não será criado estado `CANCELLED`: cancelamento alteraria o domínio financeiro e combinaria indevidamente ciclo de pagamento com visibilidade/retenção. Soft delete preserva auditoria, desfaz a participação derivada e serve de tombstone recorrente.

### 9.2 Ocorrências e modelos

Ao excluir ocorrência recorrente, somente sua `FinancialTransaction` recebe `deletedAt`. A `RecurrenceRule`, seu `status`, `archivedAt`, `nextOccurrenceDate` e demais ocorrências não mudam. A unicidade `(recurrenceRuleId, occurrenceDate)` e o `upsert update: {}` encontram o tombstone e não o reativam; a geração contabiliza a ocorrência como já materializada para avançar normalmente, sem criar outra linha.

Geração e exclusão deverão serializar no banco sobre a identidade/linha pertinente. Em conflito de unicidade, a geração relê a ocorrência e trata tombstone como materialização suprimida, nunca como motivo para recriar ou limpar `deletedAt`.

Lançamento criado via modelo segue o mesmo fluxo de um manual. Excluir a cópia não consulta nem altera o `TransactionTemplate`.

### 9.3 Efeito financeiro e read models

- Listagem e consulta individual normais incluem obrigatoriamente `deletedAt: null`. Não haverá parâmetro para incluir excluídos nesta fase.
- Saldo de conta, dashboard, orçamento e toda projeção/agregação baseada em `FinancialTransaction` incluem obrigatoriamente `deletedAt: null` na consulta autoritativa.
- Excluir `PENDING` remove seu previsto/comprometido das projeções, dashboard e orçamento; não altera saldo realizado, que já o ignorava.
- Excluir `PAID` remove atomicamente `actualAmount` do saldo realizado e das realizações de dashboard/orçamento. Receita deixa de somar e despesa deixa de subtrair. Não se cria lançamento compensatório e nenhum valor é zerado ou negado.
- Não há cache ou saldo persistido a corrigir. Todos os efeitos são derivados da mesma linha após commit; nenhuma resposta pode observar atualização parcial.
- Registros excluídos não entram em paginação nem afetam cursores novos. Cursor emitido antes da exclusão mantém seu contrato best-effort já aceito, sem promessa de snapshot.

### 9.4 Restore

Restore não integra esta SPEC. O tombstone permanece suficiente para idempotência e supressão recorrente. Não haverá rota, botão ou acesso público a excluídos; eventual restore/lixeira exigirá outra SPEC e deverá decidir seus efeitos financeiros e concorrência.

### 9.5 Concorrência

Delete, `pay`, `reopen` e `PATCH` devem bloquear/condicionar pela mesma linha e pelo owner dentro de transação. Apenas uma ordem serial é válida:

- se pay/reopen/PATCH confirmar primeiro, delete exclui a versão resultante;
- se delete confirmar primeiro, pay/reopen/PATCH responde `404 NOT_FOUND` sem mutação;
- dois deletes simultâneos resultam ambos em `204`, com um único `deletedAt`, preservado pelo segundo;
- retry de delete de tombstone próprio retorna `204` e não altera `deletedAt` nem `updatedAt`;
- geração concorrente nunca limpa `deletedAt`, duplica a ocorrência ou altera a regra.

Leitura prévia sem bloqueio seguida de update irrestrito não satisfaz este contrato. Devem ser usados lock/isolamento e escrita condicional por `userId`, `id` e `deletedAt`, com retry limitado para conflito serializável quando aplicável.

## 10. Personas ou atores

| Ator | Necessidade | Ações autorizadas |
|---|---|---|
| Owner autenticado | Corrigir sua lista sem perder consistência | Excluir individualmente lançamento próprio ativo ou repetir delete próprio. |
| Outro usuário | Nenhuma | Não pode descobrir, consultar ou excluir lançamento alheio. |
| Gerador de recorrências | Materializar datas previstas | Reconhecer tombstone como ocorrência já tratada, sem restaurá-la. |

## 11. Fluxos

### 11.1 Fluxo principal

1. O owner aciona **Excluir** no card.
2. A interface identifica se é ocorrência recorrente e abre a confirmação correspondente.
3. Após confirmar, envia `DELETE /api/transactions/:id`, sem body nem query.
4. O backend autentica, valida o UUID, localiza e bloqueia a linha pelo owner.
5. Em transação, grava `deletedAt` uma única vez; read models passam a ignorá-la após o commit.
6. A API responde `204`; a interface refaz/invalida listagem e resumos afetados.

### 11.2 Fluxos alternativos e exceções

- Cancelar confirmação → fecha o modal/sheet sem chamada nem alteração local.
- ID inexistente ou alheio → `404 NOT_FOUND`, indistinguível.
- Tombstone próprio → `204`, sem nova escrita.
- Falha de API → mantém o card e os dados locais, mostra erro recuperável e permite tentar novamente.
- Corrida → segue a ordem serial definida na seção 9.5, sem efeito parcial.

## 12. Regras de negócio

| ID | Regra | Origem/decisão | Exemplo |
|---|---|---|---|
| `RN-01` | Exclusão é lógica, individual e preservadora. | Tarefa | `deletedAt` é preenchido; valores não mudam. |
| `RN-02` | Apenas o owner exclui e recurso alheio é indistinguível de ausente. | SPEC-002/tarefa | Ambos retornam `404`. |
| `RN-03` | Delete próprio repetido é idempotente. | Tarefa | Responde `204` sem mudar timestamps. |
| `RN-04` | Todo read model normal ignora excluídos. | Tarefa | Card, saldo, dashboard e orçamento deixam de contar. |
| `RN-05` | Excluir ocorrência não altera regra, template ou outras ocorrências. | Tarefa | Próxima ocorrência permanece. |
| `RN-06` | Tombstone nunca é reativado pela geração. | Tarefa/SPEC-007 | Reprocessamento encontra a chave única. |
| `RN-07` | Dinheiro continua Decimal/string, nunca float; delete não recalcula nem altera valores. | SPEC-005 | `actualAmount` permanece igual no histórico. |
| `RN-08` | Delete e transições concorrentes produzem ordem serial. | Tarefa | Delete vencedor faz pay retornar `404`. |

## 13. Modelo de dados

| Entidade | Campo | Tipo conceitual | Obrigatório | Regra |
|---|---|---|---|---|
| `FinancialTransaction` | `deletedAt` | `DateTime? @db.Timestamptz(3)` | Não | `null` para existentes/ativos; instante UTC do primeiro delete; não editável. |

A linha excluída mantém todas as FKs `RESTRICT`, a unicidade recorrente e dados monetários `Decimal(19,2)`. Adicionar índice composto iniciado por `userId, deletedAt` nas ordens/filtros críticos, incluindo suporte à listagem por vencimento; a implementação deverá validar planos das consultas de saldo, dashboard e orçamento e adicionar apenas índices comprovadamente necessários.

## 14. Contrato de API

### Excluir — `DELETE /api/transactions/:id`

- Entrada: `id` UUID no path; body e query devem estar ausentes.
- Saída: `204 No Content`, sempre sem corpo, tanto no primeiro delete quanto na repetição de tombstone próprio.
- Erros públicos: `400 VALIDATION_ERROR` para UUID/body/query inválido; `401 UNAUTHORIZED`; `404 NOT_FOUND` para ID válido inexistente ou pertencente a outro owner; `500 INTERNAL_ERROR` sanitizado.
- Autorização: filtro autoritativo no backend por `userId` autenticado; conhecer um UUID não concede acesso.
- Idempotência: primeiro delete fixa `deletedAt`; retries próprios retornam `204` sem alterar `deletedAt` ou `updatedAt`.
- Versionamento: integra a API `/api` existente, sem nova versão.

`GET/PATCH/pay/reopen` de excluído respondem o mesmo `404 NOT_FOUND`. A resposta pública de lançamentos ativos não expõe `deletedAt`. Não existe `includeDeleted`, endpoint de restore ou listagem de tombstones.

## 15. Interface mobile

- Cada lançamento oferece ação textual/acessível **Excluir**, com área acionável mínima de `44x44` CSS px e sem depender somente de cor/ícone.
- Manual ou criado via modelo: **“Excluir este lançamento? Esta ação remove o lançamento dos seus cálculos e listas.”**
- Ocorrência recorrente: **“Excluir somente este lançamento? A recorrência continuará ativa e as próximas ocorrências serão mantidas.”**
- A confirmação distingue botões **Cancelar** e **Excluir**, mantém foco, rótulo acessível e estado de carregamento que evita duplo envio.
- Modal/sheet deve caber em viewport pequena, respeitar safe-area, teclado e scroll interno sem esconder ações.
- Em sucesso, remove o item somente após `204`, invalida/refaz listagem e read models exibidos e trata página vazia/último item.
- Em erro, mantém card, posição e filtros; comunica falha sem afirmar exclusão e oferece nova tentativa.

## 16. Validações

| Campo ou ação | Validação | Resultado esperado |
|---|---|---|
| `id` | UUID válido | `400 VALIDATION_ERROR` se inválido. |
| body/query | Ausentes | `400 VALIDATION_ERROR` se presentes. |
| owner | Igual ao autenticado | `404 NOT_FOUND` se ausente/alheio. |
| timestamp | Somente relógio do servidor | Cliente não pode fornecê-lo. |
| estado | `PENDING` e `PAID` são excluíveis | Mesma operação transacional. |

## 17. Permissões

| Ação | Ator autorizado | Condição | Comportamento quando negado |
|---|---|---|---|
| Excluir/repetir | Owner autenticado | Linha própria, inclusive tombstone | `204`. |
| Excluir alheio | Nenhum | `userId` diferente | `404`, sem revelar existência/estado. |
| Excluir sem sessão | Nenhum | Não autenticado | `401`. |

## 18. Segurança e privacidade

- Dados envolvidos: IDs, valores, datas, descrição/notas, relações e estado financeiro.
- Ameaças: IDOR, enumeração, mass assignment de timestamp, corrida financeira, vazamento em logs e restauração acidental pela recorrência.
- Proteções: AuthGuard, owner no backend, validação estrita, transação/lock, projeção pública, filtro `deletedAt: null` por padrão e constraints existentes.
- Não registrar tokens, cookies, owner/IDs, payload, valores, datas, descrição/notas ou SQL. Logs e evidências usam somente operação, classe de resultado, status, duração e correlation ID não sensível.

## 19. Erros e estados vazios

| Situação | Estado apresentado | Recuperação esperada |
|---|---|---|
| Último item excluído | Estado vazio correto para os filtros | Criar lançamento ou mudar filtros. |
| `404` | Card permanece; erro genérico | Recarregar listagem. |
| Rede/`5xx` | Card permanece; falha recuperável | Tentar novamente. |
| Duplo toque/retry | Loading único ou `204` repetido | Sem efeito duplicado. |

## 20. Observabilidade

Medir contagem e latência agregadas de delete por resultado (`success`, `not_found`, `validation`, `conflict/retry`, `server_error`) e conflitos/retries transacionais. Alertar pelo mecanismo existente para aumento sustentado de `5xx` ou retries esgotados. Não distinguir em telemetria pública ID inexistente de alheio nem incluir dados financeiros.

## 21. Migração e compatibilidade

- Migration futura **aditiva**: adicionar `deletedAt TIMESTAMPTZ(3) NULL` a `FinancialTransaction`; registros existentes recebem implicitamente `NULL`, sem backfill financeiro.
- Criar índices não destrutivos requeridos pelos filtros `userId + deletedAt` e validar planos dos read models. Preservar unique `(recurrenceRuleId, occurrenceDate)`.
- Implantar migration antes do código; depois implantar, na mesma versão lógica, todos os filtros de leitura e a escrita do endpoint. Não habilitar a UI enquanto qualquer read model ignorar o campo.
- Compatibilidade: registros históricos existentes continuam ativos e válidos; formato monetário, datas, status e contratos atuais não mudam. Clientes antigos apenas deixam de receber tombstones nas APIs existentes.
- Rollback de aplicação desabilita primeiro UI/endpoint. Remover a coluna depois de uso faria tombstones recorrentes renascerem e é proibido sem exportação/reconciliação aprovada; preferir manter coluna/índices inertes. Antes de qualquer delete em produção, rollback técnico pode remover índices e coluna pela migration reversa documentada.

## 22. Critérios de aceite

### `CA-01 — PENDING manual`
**Dado** lançamento manual pendente próprio **Quando** confirma delete **Então** recebe `204`, fixa `deletedAt`, preserva os dados e remove o previsto dos read models.

### `CA-02 — PAID manual`
**Dado** lançamento manual pago próprio **Quando** exclui **Então** recebe `204` e seu realizado deixa atomicamente saldo e resumos sem alterar `actualAmount`/`paidAt`.

### `CA-03 — Ocorrência recorrente isolada`
**Dado** ocorrência gerada entre outras **Quando** exclui **Então** somente ela vira tombstone; regra e outras ocorrências permanecem inalteradas.

### `CA-04 — Ocorrência não renasce`
**Dado** tombstone com chave de ocorrência **Quando** geração é repetida ou reprocessada **Então** não cria nem reativa lançamento para a mesma chave.

### `CA-05 — Futuras ocorrências`
**Dado** uma ocorrência excluída e regra ativa **Quando** chega data futura **Então** a próxima ocorrência é gerada normalmente.

### `CA-06 — Listagem e consulta`
**Dado** lançamento excluído **Quando** lista ou consulta pelo endpoint normal **Então** não aparece e a consulta individual retorna `404`.

### `CA-07 — Saldo e dashboard`
**Dado** lançamento pago incluído anteriormente **Quando** exclui **Então** saldo realizado e dashboard deixam de considerá-lo após o mesmo commit.

### `CA-08 — Orçamento`
**Dado** despesa pendente ou paga no mês **Quando** exclui **Então** orçamento deixa de considerá-la em comprometido/realizado.

### `CA-09 — Delete repetido`
**Dado** tombstone próprio **Quando** repete delete **Então** recebe `204` e preserva `deletedAt` e `updatedAt`.

### `CA-10 — ID inexistente`
**Dado** UUID sem lançamento **Quando** exclui **Então** recebe `404 NOT_FOUND` sem escrita.

### `CA-11 — ID alheio`
**Dado** UUID de outro owner **Quando** tenta excluir **Então** recebe o mesmo `404 NOT_FOUND`, sem vazamento ou mutação.

### `CA-12 — Pay versus delete`
**Dado** pay e delete concorrentes **Quando** confirmam **Então** ou pay termina antes e delete exclui o pago, ou delete termina antes e pay recebe `404`, nunca efeito parcial.

### `CA-13 — Geração versus delete`
**Dado** reprocessamento e delete concorrentes sobre ocorrência existente **Quando** confirmam **Então** existe uma única linha tombstone, sem recriação e sem alteração da regra.

### `CA-14 — Confirmar ou cancelar`
**Dado** confirmação aberta **Quando** cancela **Então** nenhuma API é chamada; **quando** confirma **Então** chama delete uma vez e aguarda o resultado.

### `CA-15 — Falha da API`
**Dado** card visível **Quando** delete falha **Então** card permanece localmente e a interface oferece feedback/retry.

### `CA-16 — Cópia de modelo`
**Dado** lançamento criado via modelo **Quando** exclui **Então** é tratado como lançamento comum.

### `CA-17 — Template preservado`
**Dado** cópia criada por modelo **Quando** exclui a cópia **Então** nenhum campo/estado do template muda.

### `CA-18 — Regra preservada`
**Dado** ocorrência recorrente **Quando** exclui **Então** status, archive, calendário e ponteiro da regra não são alterados pelo delete.

### `CA-19 — Imutabilidade histórica`
**Dado** lançamento ativo **Quando** exclui **Então** apenas `deletedAt` (e o `updatedAt` do primeiro delete, conforme Prisma) muda; datas e valores financeiros permanecem idênticos.

### `CA-20 — Compatibilidade da migration`
**Dado** histórico anterior à migration **Quando** aplica a migration **Então** todos recebem `deletedAt = null`, permanecem consultáveis e produzem os mesmos cálculos.

### `CA-21 — PATCH/reopen versus delete`
**Dado** PATCH ou reopen concorrente com delete **Quando** confirmam **Então** obedecem à ordem serial da seção 9.5 e nenhuma operação muta tombstone.

### `CA-22 — UX recorrente e acessível`
**Dado** ocorrência em viewport mobile **Quando** abre Excluir **Então** vê texto específico, alvo mínimo `44x44`, foco e ações utilizáveis com scroll e safe-area.

## 23. Testes obrigatórios

| Nível | Cenários mínimos | Critérios relacionados | Evidência esperada |
|---|---|---|---|
| Unitário | projeção/filtros; resposta idempotente; textos/estado da UI | CA-01–09, 14–19, 22 | Suíte determinística aprovada. |
| Integração PostgreSQL | migration/backfill nulo, constraints, owner, saldos/read models, dois deletes, pay/reopen/PATCH e geração concorrentes | CA-01–13, 18–21 | PostgreSQL real, queries e estado final comprovados. |
| Contrato/API | `204` vazio, validação, `401`, `404` indistinguível, endpoints normais ocultam tombstone | CA-06, 09–12 | Testes HTTP automatizados. |
| E2E web/mobile | confirmação/cancelamento, manual/recorrente, sucesso/erro, refetch e viewport pequena | CA-14–17, 22 | E2E e captura visual sanitizada. |
| Aceitação manual | textos, foco, alvo, safe-area/scroll, efeito em lista/dashboard/orçamento | CA-01–08, 14–17, 22 | Checklist e capturas sanitizadas. |

Executar lint, typecheck, testes unitários, integrações aplicáveis e build conforme a Definition of Done quando esta SPEC for implementada.

## 24. Arquivos permitidos

Nesta unidade documental:

- `docs/specs/SPEC-017-EXCLUSAO-INDIVIDUAL-LANCAMENTO.md`
- `docs/specs/README.md`

Uma implementação futura deverá declarar seus próprios arquivos autorizados, incluindo migration/schema, módulo de transactions, todos os read models afetados, shared contracts e interface/testes de lançamentos.

## 25. Arquivos proibidos

Nesta unidade documental, qualquer código, schema, migration, dependência, frontend ou backend. Também são proibidas alterações em SPECs anteriores.

## 26. Dependências

| Dependência | Motivo | Estado da aprovação | Impacto |
|---|---|---|---|
| SPEC-002/005 | owner e ciclo financeiro | Aprovadas/implementadas | Autorização, valores e transições. |
| SPEC-007 | identidade e geração recorrente | Aprovada/implementada | Tombstone preserva chave única. |
| SPEC-010/011 | orçamento e dashboard | Aprovadas/implementadas | Devem filtrar excluídos. |
| SPEC-013/016 | UX mobile e tela atual | Aprovadas/implementadas | Acessibilidade e interação. |
| SPEC-014 | modelos | Aprovada/implementada | Cópia não altera template. |

Nenhuma dependência nova é autorizada ou necessária.

## 27. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Read model esquecer filtro | Média | Alto, cálculo incorreto | Inventário, testes por fonte e implantação atômica. |
| Geração reativar tombstone | Baixa | Alto | Preservar unique e proibir update de `deletedAt`. |
| Corrida com pay/update | Média | Alto | Lock/escrita condicional, transação e testes PostgreSQL. |
| Índice inadequado degradar consultas | Média | Médio | `EXPLAIN` e índices orientados pelos planos. |
| Rollback apagar tombstones | Baixa | Alto | Manter coluna; reversão destrutiva somente antes de uso ou com reconciliação aprovada. |

Risco residual aceito: sem lixeira/restore, o usuário não recupera a exclusão pela interface nesta fase, embora os dados permaneçam retidos.

## 28. Rollback

Nesta tarefa, rollback é `git revert <SHA>` do commit documental. Na implementação futura, desabilitar primeiro ação/endpoint e reverter aplicação preservando `deletedAt`. A coluna somente poderá ser removida se nenhum tombstone tiver sido criado; caso contrário, remoção exige plano aprovado para conservar supressões recorrentes e histórico. Validar rollback comparando contagens, chaves recorrentes e read models, sem expor dados.

## 29. Dúvidas

Não há dúvidas abertas. Semântica, recorrência, REST, efeitos financeiros, restore, migration, autorização, idempotência, concorrência e UX estão fechados.

## 30. Decisões aprovadas

| Data | Decisão | Responsável pela aprovação | Consequência |
|---|---|---|---|
| `2026-08-12` | Soft delete por `deletedAt`, sem status novo/hard delete | Solicitante, pela tarefa | Rastreabilidade e remoção dos cálculos. |
| `2026-08-12` | A própria ocorrência excluída é tombstone | Solicitante, pela tarefa | Regra segue ativa e ocorrência não renasce. |
| `2026-08-12` | `DELETE` idempotente com `204`; alheio/ausente `404` | Solicitante, pela tarefa | Contrato REST e owner isolation fechados. |
| `2026-08-12` | Restore e listagem de excluídos ficam fora | Solicitante, pela tarefa | Escopo individual mínimo. |

## 31. Definition of Done específica

Para a futura implementação:

- [ ] Migration aditiva e rollback seguro validados em PostgreSQL real.
- [ ] Todos os acessos a `FinancialTransaction` inventariados e read models cobertos por `deletedAt = null`.
- [ ] Corridas de delete com delete/pay/reopen/PATCH/geração comprovadas.
- [ ] Contrato HTTP, owner isolation e UX mobile/acessível comprovados.
- [ ] Lint, typecheck, testes unitários, integrações e build aprovados.
- [ ] Todos os critérios de aceite atendidos e evidências anexadas.

Nesta unidade documental, a DoD consiste em auditoria registrada, decisões sem dúvida aberta, índice atualizado, revisão do diff e validações documentais aprovadas.

## 32. Histórico de alterações da SPEC

| Data | Alteração | Motivo | Autor | Aprovador |
|---|---|---|---|---|
| `2026-08-12` | Criação e aprovação da SPEC-017 | Autorizar futuramente exclusão individual segura | Equipe Planner Fin | Solicitante, pela tarefa |
