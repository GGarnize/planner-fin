# SPEC de funcionalidade — `SPEC-019 — Setup inicial opcional`

> Esta unidade é exclusivamente documental. A aprovação desta SPEC autoriza uma implementação futura separada, não código, migration ou alteração de produto neste pull request.

## 1. Identificação

| Campo | Valor |
|---|---|
| ID | `SPEC-019` |
| Título | Setup inicial opcional |
| Responsável | Time PlannerFin |
| Data de criação | `2026-08-13` |
| Última atualização | `2026-08-13` |
| Tarefa relacionada | `PROMPT-SPEC-019-SETUP-INICIAL-OPCIONAL.md` |
| Documentos relacionados | SPEC-002, SPEC-003 a SPEC-009, SPEC-013 a SPEC-015, SPEC-018, ADR-003, ADR-004 e ADR-006 |

## 2. Status

`Aprovada`

**Aprovada por:** tarefa `PROMPT-SPEC-019-SETUP-INICIAL-OPCIONAL.md`, em `2026-08-13`.

## 3. Contexto e auditoria

A auditoria da `main` vigente constatou:

- a SPEC-003 e o schema definem conta com tipo fechado (`CHECKING`, `SAVINGS`, `CASH`, `PAYMENT`, `OTHER`), moeda `BRL`, `openingBalance` em `Decimal(19,2)` e `openingBalanceDate` civil obrigatória; saldo inicial não é lançamento;
- a SPEC-004 proíbe categorias no cadastro, seed global ou criação automática e reserva padrões para unidade futura; categoria é plana, `INCOME` ou `EXPENSE`, e o nome normalizado é único por usuário e natureza inclusive entre arquivadas;
- SPEC-005 a SPEC-009 preservam contratos próprios para lançamentos, transferências, recorrências, cartões e dívidas. Nenhum deles autoriza inferir movimentação, salário, compromisso ou instituição;
- a SPEC-007 já oferece recorrências canônicas, mas exige conta, categoria, valor, frequência e datas; a SPEC-014 oferece modelos, sem criar recorrência ou lançamento automaticamente;
- a SPEC-013 exige uma única experiência Web/Android mobile-first, safe areas, alvos de `44 × 44 CSS px`, texto a 200%, teclado e sem bloqueio da navegação; “Mais” e “Minha conta” são superfícies de descoberta adequadas;
- a SPEC-015 cria somente fixture local explicitamente habilitada e não é onboarding de produção;
- a SPEC-018 estabelece backend como fonte canônica por usuário, convergência Web/Android e cache local mínimo sem dado financeiro, mas suas preferências não representam estado de setup;
- o Prisma atual não possui entidade ou estado de setup. `UserPreferences` contém somente aparência e accent; contas, categorias e transações são relações separadas de `User`;
- as APIs atuais `POST /api/accounts` e `POST /api/categories` criam um objeto por chamada. Reutilizá-las sequencialmente no cliente não oferece transação conjunta nem idempotência do conjunto;
- o Dashboard já permanece navegável com dados vazios, e Contas/Categorias têm estados vazios e CTAs próprios. “Mais” leva a “Minha conta”, que contém atalhos manuais para contas e categorias;
- registro/login/restore autenticam e carregam preferências antes do shell. Não há bootstrap financeiro, onboarding ou setup existente, nem criação silenciosa de entidade financeira.

O comportamento acima é **AS-IS**; o restante desta SPEC define o **TO-BE**.

## 4. Problema

Um novo usuário chega a superfícies vazias e precisa descobrir separadamente contas e categorias. Criar padrões sem consentimento imporia estrutura financeira; encadear APIs atuais poderia deixar dados parciais; e uma oferta sem estado sincronizado poderia reaparecer a cada login ou divergir entre Web e Android.

## 5. Objetivo

Definir um fluxo curto, opt-in, explícito, idempotente, atômico e retomável que permita a um novo usuário revisar e confirmar uma primeira conta e categorias sugeridas, sem criar qualquer entidade financeira antes da confirmação e sem impedir configuração manual.

## 6. Fora do escopo

- importação PDF, CSV ou OFX; conexão bancária, Open Finance ou movimentação de dinheiro;
- IA, aconselhamento financeiro automatizado ou dados reais pré-preenchidos;
- renda, despesa ou qualquer recorrência no setup v1;
- cartões, dívidas, transferências, lançamentos, modelos e orçamentos;
- personalização visual, exclusão em massa, compartilhamento familiar, notificações e analytics;
- implementação, migration, frontend, backend ou dependência nesta unidade documental.

## 7. Termos

| Termo | Definição adotada nesta SPEC |
|---|---|
| Oferta | Card não modal e dispensável no Dashboard, com “Configurar agora” e “Fazer manualmente”. |
| Estado financeiro existente | Existência, inclusive arquivada ou excluída logicamente, de ao menos uma conta, categoria ou transação do usuário. |
| Draft | Intenção editável do setup, persistida para retomada, sem efeito no domínio financeiro. |
| Preview | Validação canônica e resumo calculado pelo servidor, ainda sem mutação financeira. |
| Confirmação | Única ação que autoriza criar os objetos exatamente mostrados no preview vigente. |
| Chave idempotente | UUID opaco gerado para uma tentativa lógica de confirmação e vinculado ao usuário. |

## 8. Comportamento atual

Não existe onboarding/setup. Novo cadastro recebe preferência visual default, mas nenhuma conta, categoria ou movimentação. Dashboard e módulos podem permanecer vazios e a configuração é manual por APIs independentes.

## 9. Comportamento desejado

### 9.1 Elegibilidade e momento da oferta

Após cadastro ou primeiro login restaurado, o shell abre normalmente no Dashboard. A oferta aparece somente quando todas as condições forem verdadeiras:

1. usuário criado depois da ativação controlada da funcionalidade (coorte/feature flag server-side);
2. estado de setup `NOT_STARTED`;
3. nenhuma conta, categoria ou transação própria existe, inclusive arquivada/deletada logicamente;
4. a sessão e a consulta de elegibilidade concluíram com sucesso.

A oferta é um card não modal, não intercepta rotas e aparece uma vez por sessão enquanto elegível. Fechar apenas o card o oculta na sessão; não muda o estado. “Configurar agora” abre o fluxo. “Fazer manualmente” exige uma confirmação curta, grava `SKIPPED`, cria zero entidades e encerra ofertas invasivas. Usuários anteriores ao rollout nunca entram automaticamente, mas podem abrir “Setup inicial” em Minha conta se ainda não têm estado financeiro existente.

### 9.2 Estado persistido e draft

O backend mantém uma linha por usuário com `status: NOT_STARTED | SKIPPED | COMPLETED`, `draft`, `draftVersion`, timestamps e dados da última confirmação idempotente. Ausência de linha equivale a **não participante do rollout**, e não a `NOT_STARTED`.

- `NOT_STARTED`: elegível e ainda não confirmado; pode ter draft;
- `SKIPPED`: escolheu configuração manual; oferta automática não reaparece, mas Minha conta permite “Retomar setup” se ainda elegível;
- `COMPLETED`: confirmação atômica concluída; setup não pode ser executado novamente.

Web e Android consultam a mesma fonte canônica. O draft financeiro fica somente no backend autenticado; memória de tela pode espelhar o draft durante a sessão, mas `localStorage`, `sessionStorage`, logs e cache visual são proibidos. Logout apaga a cópia em memória. Troca de usuário carrega somente o draft do novo owner. `draftVersion` implementa concorrência otimista e impede sobrescrita entre dispositivos.

### 9.3 Escopo v1

O setup cria exatamente:

- **uma conta principal**, obrigatória para confirmar;
- **zero ou mais categorias selecionadas**.

Não cria lançamento para saldo inicial. Renda, salário e despesas recorrentes ficam fora do setup v1: exigiriam mais campos e dependências entre conta/categoria/calendário, alongariam o fluxo e aumentariam o risco de suposição financeira. Permanecem disponíveis nos módulos canônicos após o setup.

### 9.4 Conta e saldo inicial

O usuário informa:

- nome obrigatório, seguindo o contrato vigente de conta;
- tipo obrigatório entre os cinco tipos canônicos, sem default que alegue instituição;
- saldo inicial opcional na interface;
- data civil da posição inicial, exibida e editável.

Instituição não integra o setup e é enviada como `null`; o app não sugere banco. Moeda é `BRL`. Se o saldo for omitido, o preview explicita “Saldo inicial: R$ 0,00” e a confirmação envia a string canônica `"0.00"`, porque o contrato da conta exige valor. A data inicia com hoje civil do cliente apenas como sugestão visível e deve ser confirmada; o servidor valida `YYYY-MM-DD` como data civil sem conversão de fuso. Informar saldo positivo, zero ou negativo nunca cria receita, despesa ou lançamento.

Contas atualmente permitem nomes iguais. Para evitar duplicação acidental no setup, qualquer conta própria existente torna o usuário inelegível; conflito surgido entre preview e confirmação retorna `409 SETUP_DATA_CONFLICT`, sem criar nada.

### 9.5 Categorias sugeridas

Não há criação ao abrir o app ou avançar etapas. A lista enxuta, versionada pelo servidor e inicialmente marcada, é:

| Natureza | Nome | Ícone sugerido |
|---|---|---|
| `INCOME` | Renda | `WORK` |
| `EXPENSE` | Moradia | `HOME` |
| `EXPENSE` | Alimentação | `RESTAURANT` |
| `EXPENSE` | Transporte | `DIRECTIONS_CAR` |
| `EXPENSE` | Saúde | `HEALTH_AND_SAFETY` |
| `EXPENSE` | Educação | `SCHOOL` |
| `EXPENSE` | Lazer | `SAVINGS` |

O texto esclarece que são sugestões. Cada item pode ser marcado/desmarcado e renomeado; natureza é visível e imutável. Cor é `null`. “Renda” não presume salário nem recorrência. O usuário pode desmarcar todas. Nomes seguem normalização/unicidade da SPEC-004. Conflito com categoria ativa ou arquivada, inclusive criado após o preview, retorna `409 SETUP_DATA_CONFLICT` e orienta ajustar o draft ou seguir manualmente; não restaura, sobrescreve ou duplica automaticamente.

### 9.6 Etapas, revisão e efeitos

1. **Introdução:** explica opcionalidade e zero efeitos antes da confirmação.
2. **Conta:** coleta nome, tipo, saldo opcional e data.
3. **Categorias:** permite revisar, renomear e selecionar sugestões.
4. **Revisão:** mostra nome/tipo da conta, saldo/data, quantidade e lista de categorias por natureza, total de entidades e aviso de que nenhuma recorrência ou lançamento será criado.
5. **Confirmação:** botão “Criar conta e categorias” envia o token do preview e a chave idempotente.

Voltar, sair ou cancelar na revisão cria zero entidade financeira e preserva o draft. O preview não reserva nomes nem grava domínio. Qualquer alteração depois do preview o invalida e exige novo preview. Somente sucesso da confirmação leva a `COMPLETED` e mostra quantidades/IDs criados.

### 9.7 Atomicidade e idempotência

Um endpoint orquestrador dedicado executa, em uma única transação Prisma/PostgreSQL:

1. bloqueio lógico/serialização do registro de setup do owner;
2. validação de estado, `draftVersion`, preview, elegibilidade e conflitos novamente;
3. criação da conta e das categorias aprovadas;
4. gravação do resultado da chave idempotente;
5. transição para `COMPLETED` e descarte do draft.

Qualquer falha desfaz todas as cinco operações. Não se reutilizam chamadas client-side sequenciais às APIs existentes. A combinação `(userId, idempotencyKey)` é única. Retry com a mesma chave e o mesmo hash de payload retorna `200` e o resultado original, sem duplicar. Mesma chave com payload diferente retorna `409 IDEMPOTENCY_KEY_REUSED`. Outra chave após `COMPLETED` retorna `409 SETUP_ALREADY_COMPLETED`. O servidor nunca confia em IDs, owner, preços, contagens ou hash calculados apenas pelo cliente.

### 9.8 Dados existentes e compatibilidade

Se surgir qualquer conta, categoria ou transação antes da confirmação, o setup torna-se inelegível e oferece “Continuar manualmente”; nada é sobrescrito, apagado, restaurado, mesclado ou duplicado. Objetos fora desse trio (por exemplo preferências) não impedem o fluxo. Usuários legados permanecem sem linha e sem oferta automática. Cliente antigo continua usando APIs atuais sem alteração. Rollback da funcionalidade remove a oferta/endpoints, mas preserva conta e categorias criadas por confirmação explícita.

## 10. Personas ou atores

| Ator | Necessidade | Ações autorizadas |
|---|---|---|
| Novo usuário elegível | iniciar rapidamente sem imposição | abrir, editar, revisar, confirmar, cancelar ou pular |
| Usuário manual/legado | usar o app sem onboarding | navegar e configurar módulos; reabrir pela conta quando elegível |
| API | garantir owner, validação e atomicidade | ler/gravar somente setup e entidades do usuário autenticado |

## 11. Fluxos alternativos e UX mobile

- O layout é progressivo, uma etapa por vez, e o Dashboard nunca fica bloqueado.
- Safe areas são respeitadas uma vez; conteúdo e CTA não ficam sob barras do sistema, bottom navigation ou teclado.
- Todo alvo tem no mínimo `44 × 44 CSS px`; a 200% de texto não há corte, sobreposição, scroll horizontal ou perda de ação.
- Foco e erro vão ao primeiro campo inválido; Enter não confirma financeiramente fora da etapa final; teclado pode ser fechado sem perder o draft.
- Android Back fecha teclado/seletor primeiro; depois volta uma etapa; na introdução, sai para o Dashboard sem mudar status. Na revisão, Back nunca confirma nem descarta.
- Cada avanço salva o draft canônico. Após force-stop ou sessão restaurada, `NOT_STARTED`/`SKIPPED` com draft oferece “Continuar setup” na última etapa válida. O servidor pode recuar uma etapa se o draft já não validar.
- Logout/troca de usuário remove memória local. Falha ao salvar mantém a etapa e oferece retry; não finge persistência.
- `SKIPPED` não bloqueia nada e só reaparece como ação discreta em Minha conta. `COMPLETED` não reaparece.

## 12. Regras de negócio

| ID | Regra |
|---|---|
| `RN-01` | Nenhuma entidade financeira é criada antes da confirmação final explícita. |
| `RN-02` | Confirmação cria uma conta e exatamente as categorias do preview vigente, em transação única. |
| `RN-03` | Owner deriva somente do access token; `userId` de entrada é recusado. |
| `RN-04` | Usuário com conta, categoria ou transação existente não pode confirmar setup. |
| `RN-05` | Omissão de saldo é convertida explicitamente em `"0.00"`; dinheiro permanece string/Decimal(19,2). |
| `RN-06` | Datas financeiras permanecem civis `YYYY-MM-DD`, sem horário ou deslocamento de fuso. |
| `RN-07` | Skip e cancelamento criam zero entidade; skip persiste e encerra oferta automática. |
| `RN-08` | Retry com mesma chave/payload devolve o mesmo resultado; nunca duplica. |
| `RN-09` | Recorrência, salário, lançamento e instituição nunca são inferidos. |

## 13. Modelo de dados futuro

Uma implementação futura exigirá migration **aditiva e não destrutiva**, sem editar migrations aplicadas:

| Entidade/campo | Tipo conceitual | Regra |
|---|---|---|
| `UserInitialSetup.userId` | UUID | PK/FK 1:1, owner, `onDelete: Restrict` |
| `status` | enum | `NOT_STARTED`, `SKIPPED`, `COMPLETED` |
| `draft` | JSON validado | nullable; somente campos permitidos, nunca token/secret |
| `draftVersion` | inteiro | monotônico, concorrência otimista |
| `suggestionVersion` | inteiro | identifica catálogo mostrado |
| `completedAt`, `skippedAt` | instante | nullable, conforme transição |
| `createdAt`, `updatedAt` | instante | auditoria técnica |
| `SetupConfirmation.userId + idempotencyKey` | UUIDs únicos em conjunto | resultado/hash imutável para retry |

O desenho físico poderá incorporar a confirmação à mesma tabela se preservar unicidade, retry e retenção. Payload financeiro no draft deve ter retenção mínima: apagado após conclusão; após skip pode ser mantido somente para reabertura até política técnica definida na implementação, sem logs. Essa escolha física não altera o contrato.

## 14. Contratos de API futuros

Todos exigem autenticação, CSRF nas mutações e envelope de erro vigente.

### `GET /api/users/me/setup`

- Saída: participação/eligibilidade, status, razão de inelegibilidade, draft/version, catálogo versionado e última etapa válida.
- Sem linha: `participating: false`; não cria registro por leitura.
- Owner: token; cache HTTP proibido (`no-store`).

### `PUT /api/users/me/setup/draft`

- Entrada: draft completo permitido e `expectedDraftVersion`; sem `userId`.
- Saída: draft canônico e nova versão; cria metadata `NOT_STARTED` somente por ação explícita “Configurar agora”/“Retomar setup”.
- Erros: `400`, `401/403`, `409 SETUP_VERSION_CONFLICT`, `409 SETUP_INELIGIBLE`.
- Idempotência: repetir conteúdo na mesma versão lógica não cria domínio; conflito exige refetch.

### `POST /api/users/me/setup/skip`

- Entrada: vazia; confirmação explícita na UI.
- Saída: `SKIPPED`; zero entidades financeiras.
- Idempotência: repetir skip retorna o mesmo estado; `COMPLETED` não regride.

### `POST /api/users/me/setup/preview`

- Entrada: `draftVersion`.
- Saída: token opaco curto vinculado a owner, versão e hash; resumo completo, contagens e valores canônicos; zero mutação financeira.
- Erros: validação, conflito ou inelegibilidade; resposta `no-store`.

### `POST /api/users/me/setup/confirm`

- Entrada: `previewToken` e header `Idempotency-Key` UUID; sem objetos financeiros livres.
- Saída: `201` na primeira criação ou `200` no retry, status `COMPLETED`, contagens e IDs próprios.
- Erros: `400`, `401/403`, `409 SETUP_DATA_CONFLICT`, `409 SETUP_ALREADY_COMPLETED`, `409 IDEMPOTENCY_KEY_REUSED`, preview expirado/inválido.
- Atomicidade/idempotência: conforme seção 9.7.

## 15. Interface e acessibilidade

O card de oferta fica no Dashboard após carregamento bem-sucedido. Minha conta contém “Setup inicial” para reabertura permitida. Botões usam exatamente “Configurar agora”, “Fazer manualmente” e, no final, “Criar conta e categorias”. Estado de carregamento não mostra oferta falsa; falha de elegibilidade não bloqueia o Dashboard. Semântica nativa, rótulos, descrição de progresso (“Etapa 2 de 4”), foco visível, anúncios de erro/sucesso e contraste seguem SPEC-013 e SPEC-018.

## 16. Validações

| Campo/ação | Validação | Resultado |
|---|---|---|
| nome da conta | contrato canônico de conta | erro inline antes de preview |
| tipo | enum canônico | sem valor inventado |
| saldo | string decimal, até 2 casas e limites canônicos | nunca float |
| data | data gregoriana `YYYY-MM-DD` | sem conversão de fuso |
| categoria | nome/tipo/ícone canônicos e unicidade interna | conflito indicado por item |
| confirmação | preview vigente, chave UUID, elegibilidade e versão | nenhuma mutação se inválida |

## 17. Permissões

Somente usuário autenticado lê ou altera o próprio setup. Toda consulta e mutação financeira filtra `userId` da sessão. Recurso/preview/chave de outro usuário é indistinguível de inexistente e retorna `404` ou erro opaco previsto pelo padrão de segurança, sem revelar owner.

## 18. Segurança e privacidade

- Validar/whitelist de todo payload no backend; limites de tamanho para draft e rate limit nas mutações.
- Usar transação, queries por owner e proteção CSRF existente; nunca aceitar `userId` do cliente.
- Dinheiro é string na API e `Decimal(19,2)` no banco; float é proibido. Datas são civis.
- Preview é opaco, curto, não reutilizável por outro owner e não contém dado financeiro decodificável no cliente.
- `Cache-Control: no-store`; não registrar nomes, valores, datas, draft, preview, tokens, cookies ou chaves completas. Logs técnicos podem conter request ID, código de erro e contagens não financeiras agregadas sem owner identificável.
- Draft/cache local não contém secrets; nesta versão draft financeiro persistente local é proibido.

## 19. Erros e estados vazios

| Situação | Estado | Recuperação |
|---|---|---|
| consulta falha | Dashboard utilizável, sem oferta presumida | tentar novamente |
| draft conflita entre dispositivos | aviso de versão nova | recarregar canônico, sem sobrescrever |
| dado existente/conflito | nenhuma criação | seguir manualmente ou ajustar quando permitido |
| confirmação falha | zero criação, revisão preservada | retry com mesma chave |
| nenhuma categoria selecionada | revisão mostra `0 categorias` | confirmar somente a conta |

## 20. Observabilidade

Somente métricas técnicas sem analytics de comportamento: latência/erros por endpoint, rollbacks de transação, conflitos e retries idempotentes. Alertar taxa anormal de `5xx`/rollback. Não registrar conteúdo financeiro nem distinguir usuários em dashboards de métricas.

## 21. Migração, rollout, compatibilidade e rollback

- Migration futura aditiva cria metadata/idempotência; não popula usuários legados como elegíveis.
- Rollout server-side por coorte de novos usuários e capacidade de desligar a oferta/novas confirmações, mantendo leitura de resultados.
- Apps antigos seguem funcionando; APIs de contas/categorias não mudam.
- Rollback de aplicação não apaga nem arquiva objetos explicitamente confirmados. A migration aditiva permanece até unidade futura aprovada; reversão é por deploy anterior/feature flag.
- Dados parcialmente criados não existem por contrato transacional. Dados concluídos são tratados como dados normais do usuário e preservados.

## 22. Critérios de aceite (GWT)

### `CA-01 — Oferta ao novo usuário`
**Dado** novo usuário da coorte, `NOT_STARTED` e sem dados financeiros **Quando** entra no Dashboard **Então** vê oferta não modal com “Configurar agora” e “Fazer manualmente”.

### `CA-02 — Escolha manual`
**Dado** a oferta **Quando** confirma “Fazer manualmente” **Então** o estado vira `SKIPPED`, o Dashboard continua utilizável e a oferta automática encerra.

### `CA-03 — Skip sem efeito`
**Dado** usuário vazio **Quando** faz skip **Então** nenhuma conta, categoria, transação ou recorrência é criada.

### `CA-04 — Reabertura`
**Dado** usuário `SKIPPED` ainda sem dados **Quando** abre Setup inicial em Minha conta **Então** pode retomar sem oferta invasiva.

### `CA-05 — Conta sem saldo informado`
**Dado** conta válida e saldo omitido **Quando** revisa **Então** vê `R$ 0,00`; ao confirmar persiste `"0.00"` sem lançamento.

### `CA-06 — Conta com saldo inicial`
**Dado** saldo decimal e data válidos **Quando** confirma **Então** a conta preserva valor/data e nenhum lançamento é criado.

### `CA-07 — Seleção parcial`
**Dado** catálogo sugerido **Quando** desmarca itens **Então** somente os restantes aparecem no preview e podem ser criados.

### `CA-08 — Nenhuma categoria`
**Dado** todas desmarcadas **Quando** confirma **Então** cria uma conta e zero categorias.

### `CA-09 — Revisão completa`
**Dado** draft válido **Quando** solicita preview **Então** vê conta, saldo/data, cada categoria, naturezas, quantidades e total antes de persistir.

### `CA-10 — Cancelar revisão`
**Dado** preview aberto **Quando** cancela ou volta **Então** cria zero entidade e preserva draft.

### `CA-11 — Confirmação exata`
**Dado** preview vigente **Quando** confirma **Então** cria exatamente uma conta e as categorias aprovadas, nada mais.

### `CA-12 — Retry idempotente`
**Dado** confirmação concluída cuja resposta se perdeu **Quando** repete chave e preview **Então** recebe o resultado original sem duplicar.

### `CA-13 — Rollback atômico`
**Dado** falha injetada entre criações **Quando** a transação aborta **Então** não permanece conta, categoria, confirmação nem `COMPLETED` parcial.

### `CA-14 — Usuário existente`
**Dado** qualquer conta, categoria ou transação existente **Quando** consulta/confirma setup **Então** não recebe oferta automática e nenhum dado é sobrescrito.

### `CA-15 — Conflito de categoria`
**Dado** categoria ativa ou arquivada conflitante criada após preview **Quando** confirma **Então** recebe conflito e zero criação/restauração.

### `CA-16 — Conflito de conta`
**Dado** conta criada após preview **Quando** confirma **Então** torna-se inelegível, retorna conflito e zero objeto do setup.

### `CA-17 — Decimal correto`
**Dado** valores limite e centavos **Quando** preview/confirma **Então** string e `Decimal(19,2)` são preservados sem float/arredondamento implícito.

### `CA-18 — Data civil correta`
**Dado** a mesma data em fusos distintos **Quando** salva/confirma **Então** o `YYYY-MM-DD` permanece idêntico.

### `CA-19 — Owner isolation`
**Dado** dois usuários **Quando** um usa ID, preview, chave ou draft do outro **Então** não lê/muta dados nem confirma existência.

### `CA-20 — Back Android`
**Dado** setup no Android **Quando** pressiona Back **Então** fecha superfície transitória ou volta uma etapa; na introdução sai ao Dashboard, sem confirmar/descartar.

### `CA-21 — Force-stop e retomada`
**Dado** draft salvo **Quando** ocorre force-stop e reabertura **Então** a sessão restaurada oferece continuar na última etapa válida com draft do servidor.

### `CA-22 — Texto a 200%`
**Dado** texto a 200% em 320 CSS px **Quando** percorre o fluxo **Então** conteúdo reflui sem corte, sobreposição, scroll horizontal ou ação inacessível.

### `CA-23 — Cache sem secrets`
**Dado** draft preenchido **Quando** inspeciona storages/cache/logs **Então** não encontra draft financeiro, token, cookie, preview ou chave completa.

### `CA-24 — Sessão restaurada`
**Dado** sessão restaurável e setup em curso **Quando** bootstrap conclui **Então** carrega estado/draft canônicos antes de oferecer retomada.

### `CA-25 — Logout/troca de usuário`
**Dado** draft de A em memória **Quando** faz logout e entra B **Então** memória de A é removida e B nunca a visualiza.

### `CA-26 — Concluído não reaparece`
**Dado** `COMPLETED` **Quando** faz novos logins **Então** oferta e execução não reaparecem.

### `CA-27 — Skipped não bloqueia`
**Dado** `SKIPPED` **Quando** navega **Então** todas as áreas seguem utilizáveis e só há reabertura discreta em Minha conta.

### `CA-28 — Rollback preserva dados criados`
**Dado** setup concluído **Quando** a feature é desligada ou aplicação revertida **Então** conta/categorias confirmadas permanecem intactas e utilizáveis pelas APIs antigas.

## 23. Testes obrigatórios da implementação futura

| Nível | Cenários mínimos | Evidência |
|---|---|---|
| Unitário | elegibilidade/coorte/estados, catálogo, validações, hash/chave, Decimal e data civil | testes determinísticos |
| Integração PostgreSQL | transaction rollback, locks/concorrência, unicidade, owner, migration, retry e conflitos | banco real e falha injetada |
| Contrato/API | GET/draft/skip/preview/confirm, whitelist, CSRF, status/envelopes, `no-store` | testes HTTP |
| Web/componentes | oferta, etapas, revisão, skip, erros, foco, teclado, 200% | Vitest/DOM |
| E2E Web/Android | CA-01 a CA-28, Back, force-stop/restore e troca de usuário | Playwright e dispositivo/emulador aplicável |
| Aceitação manual | 320 px, safe areas, teclado, leitor de tela básico, rollout/rollback | checklist sem dados reais |

## 24. Arquivos permitidos nesta unidade documental

- `docs/specs/SPEC-019-SETUP-INICIAL-OPCIONAL.md`;
- `docs/specs/README.md`.

## 25. Arquivos proibidos nesta unidade documental

- `apps/**`, `packages/**`, `package.json`, lockfile, configuração executável e migrations;
- qualquer arquivo não listado na seção 24.

## 26. Dependências

Nenhuma dependência nova nesta SPEC. A implementação futura deve reutilizar Prisma, NestJS, Vue e contratos existentes; qualquer dependência adicional exige justificativa e aprovação separadas.

## 27. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| duplicidade em retry/concorrência | Média | Alto | chave por owner, lock, hash e transação única |
| oferta a usuário legado/com dados | Baixa | Alto | ausência de linha não elegível, coorte e rechecagem transacional |
| vazamento de draft | Baixa | Alto | backend `no-store`, sem storage/log e owner isolation |
| fluxo longo | Média | Médio | recorrências excluídas e quatro etapas efetivas |
| conflito após preview | Média | Médio | revalidação, rollback e mensagem recuperável |

## 28. Rollback

Para esta documentação, `git revert <SHA>` remove apenas a SPEC e seu índice. Na implementação futura, desligar rollout e confirmações, reverter aplicação e preservar migration aditiva e todos os objetos explicitamente criados. Nenhum rollback automático pode apagar dados financeiros.

## 29. Dúvidas

Não há dúvida funcional ou arquitetural aberta. Detalhes físicos de retenção/tabela podem ser decididos na implementação somente se preservarem integralmente o contrato; qualquer mudança de comportamento exige revisão aprovada desta SPEC.

## 30. Decisões aprovadas

| Data | Decisão | Responsável | Consequência |
|---|---|---|---|
| `2026-08-13` | Setup é opt-in, não modal e não bloqueante. | tarefa da SPEC-019 | Dashboard permanece utilizável. |
| `2026-08-13` | Persistir três estados e draft server-side por usuário. | tarefa da SPEC-019 | sincroniza Web/Android e retoma force-stop. |
| `2026-08-13` | V1 cria uma conta e zero ou mais categorias; recorrências ficam fora. | tarefa da SPEC-019 | fluxo curto sem presumir salário. |
| `2026-08-13` | Preview + confirmação usam orquestrador transacional dedicado. | tarefa da SPEC-019 | atomicidade e idempotência não dependem do cliente. |
| `2026-08-13` | Legados não recebem oferta automática e dados existentes impedem confirmação. | tarefa da SPEC-019 | rollout compatível e sem overwrite. |

## 31. Definition of Done específica

- [ ] Implementação futura usa uma branch/PR própria da SPEC-019, sem alterar esta decisão silenciosamente.
- [ ] CA-01 a CA-28 possuem evidência automatizada ou justificativa de aceite manual.
- [ ] Falha parcial e concorrência são testadas contra PostgreSQL real.
- [ ] Web/Android comprovam Back, retomada, safe area, teclado, 44 px e texto a 200%.
- [ ] Lint, typecheck, testes unitários/integração/E2E aplicáveis e build passam.
- [ ] Não há dado financeiro ou segredo em cache, log ou evidência.

## 32. Histórico de alterações da SPEC

| Data | Alteração | Motivo | Autor | Aprovador |
|---|---|---|---|---|
| `2026-08-13` | Criação e aprovação da SPEC-019. | Definir setup inicial opcional antes de implementação. | Codex Cloud | tarefa `PROMPT-SPEC-019-SETUP-INICIAL-OPCIONAL.md` |
