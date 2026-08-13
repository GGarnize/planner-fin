# SPEC de funcionalidade — `SPEC-021 — Importação financeira OFX/CSV com revisão humana`

> Esta unidade é exclusivamente documental. Ela aprova o comportamento de uma implementação futura separada; não cria código, migration, endpoint nem interface.

## 1. Identificação

| Campo | Valor |
|---|---|
| ID | `SPEC-021` |
| Título | Importação financeira OFX/CSV com revisão humana |
| Responsável | Equipe PlannerFin |
| Data de criação | 2026-08-13 |
| Última atualização | 2026-08-13 |
| Tarefa relacionada | Prompt SPEC-021 no Codex Cloud |
| Documentos relacionados | SPEC-002–007, SPEC-010–014, SPEC-017, SPEC-019; ADR-002; `schema.prisma` atual |

## 2. Status

`Aprovada`

**Aprovada por:** solicitante da tarefa, em `2026-08-13`, ao autorizar expressamente a criação e aprovação desta SPEC com as decisões obrigatórias descritas no prompt.

A aprovação autoriza somente uma implementação futura em unidade própria. Não autoriza merge de implementação sem os testes desta SPEC.

## 3. Contexto e auditoria AS-IS

A auditoria foi feita sobre a `main` selecionada no ambiente, distinguindo fatos atuais das decisões futuras.

### 3.1 Dados e domínios atuais

| Área auditada | AS-IS confirmado | Reutilização/impacto TO-BE |
|---|---|---|
| Prisma/User | Entidades privadas carregam `userId`; FKs usam `Restrict`; não existem entidades de importação. | Reutilizar `User` como owner e acrescentar modelos próprios por migration futura aditiva. |
| `FinancialTransaction` | Exige conta e categoria; tipos `INCOME/EXPENSE`; estados `PENDING/PAID`; descrição até 200; dinheiro `Decimal(19,2)`; `dueDate`, `paidAt` e `occurrenceDate` são `@db.Date`; `deletedAt` é soft delete. Não há origem/import ID. | Cada linha confirmada cria lançamento `PAID`, com `plannedAmount = actualAmount = abs(valor)`, `dueDate = paidAt = data civil`, sem recorrência e ligado à linha importada. Categoria ativa compatível é obrigatória porque o schema não admite `categoryId` nulo. |
| `FinancialAccount` | Conta tem owner, moeda, saldo inicial/data civil e `archivedAt`; BRL é o contrato de produto atual. | Seleção explícita de conta ativa BRL; nenhuma conta é criada/restaurada. Revalidar no upload, preview e commit. |
| `FinancialCategory` | Categoria plana, própria, `INCOME/EXPENSE`, obrigatória no lançamento e arquivável; criação automática é proibida. | Seleção de categoria própria, ativa e do mesmo tipo é obrigatória para confirmar; nenhuma sugestão/criação automática. |
| `FinancialTransfer` | Transferência é entidade própria entre duas contas, com atomicidade e sem virar dois lançamentos comuns. | Não inferir transferência. Linha suspeita continua lançamento comum com aviso; usuário pode desmarcar e criar transferência fora do fluxo. |
| `TransactionTemplate` | Modelo exige categoria, natureza, descrição e valor, pode ter conta padrão e é arquivável. | Não é aplicado nem criado pela importação. |
| `RecurrenceRule` | Gera lançamentos/transferências por regra, com ponteiro, bloqueios e unicidade por ocorrência. | Importações são avulsas: não criam, vinculam ou avançam recorrência. |
| Dashboard/saldos | Read models derivam efeitos de lançamentos pagos, excluem `deletedAt != null` e preservam Decimal. | Draft e preview não entram em nenhum read model. Somente o commit atômico passa a afetar saldo/dashboard. |
| Budget | Comprometido/realizado derivam lançamentos ativos e categoria/mês. | Importados confirmados entram como qualquer lançamento pago; draft e rejeitados não entram. |
| Exclusão/SPEC-017 | Lançamento excluído vira tombstone, some dos read models e não é restaurável pela API normal. | Excluir lançamento importado não apaga sua identidade de origem; ela continua bloqueando duplicidade forte e mantém rastreabilidade. Importação não restaura tombstone. |

### 3.2 Autenticação, API e plataforma

- A API Nest usa prefixo `/api`, `AuthGuard`, `userId` derivado da sessão, DTOs com whitelist/validação e envelope canônico de erro. Consultas privadas filtram owner no backend e recursos alheios são tratados como inexistentes.
- A SPEC-002 exige access token em memória, refresh HttpOnly, CSRF nas mutações, CORS/origens explícitas e ausência de dados privados em storage inseguro.
- Dinheiro atravessa a API como string decimal e persiste como `Decimal(19,2)`, nunca `number`/float. Datas financeiras são civis `YYYY-MM-DD`; timestamps técnicos usam `timestamptz` e não alteram a data financeira.
- A SPEC-013 determina uma SPA Vue/Quasar mobile-first; a SPEC-012 empacota a mesma SPA no Capacitor, é online-first, usa HTTPS no build internal/release, trata Back/safe areas/teclado e não mantém fila financeira offline.
- A SPEC-019 fornece o precedente para draft canônico no servidor, `draftVersion`, preview sem efeito, `no-store`, confirmação transacional e idempotência `(owner, key, payloadHash)`.

### 3.3 Lacunas que exigem elementos novos

São novos: parsing defensivo OFX/CSV, upload multipart, mapeamento CSV, lifecycle/draft de importação, linhagem entre linha e lançamento, fingerprint durável, detecção/decisão de duplicidade, confirmação em lote idempotente, retenção/cleanup e UX de revisão. APIs de criação de lançamento existentes não devem ser chamadas sequencialmente pelo cliente, pois isso perderia atomicidade, idempotência e identidade de origem.

A planilha histórica do discovery não é fonte de migração, seed, parser especial ou importação. Somente arquivos explicitamente escolhidos pelo usuário no novo fluxo poderão ser processados.

## 4. Problema

O usuário não consegue trazer extratos estruturados sem digitar cada lançamento. Uma ingestão direta seria perigosa: layouts variam, sinais e datas podem ser ambíguos, arquivos podem se repetir e a criação silenciosa altera saldo e orçamento. É necessário um fluxo assistido, explicável e reversível antes do commit.

## 5. Objetivo

Permitir que um owner envie OFX ou CSV, associe uma conta, mapeie e revise todas as linhas, resolva avisos/duplicidades e confirme explicitamente um lote atômico de lançamentos pagos, com zero efeito financeiro antes da confirmação e sem duplicação em retries ou concorrência.

## 6. Fora do escopo

- PDF, OCR, Open Finance, conexão automática com bancos e leitura de e-mail;
- classificação por IA, fuzzy matching opaco e regras avançadas/sugestões de categoria;
- criação automática de conta ou categoria;
- conciliação bancária completa, importação recorrente, background sync ou fila offline;
- serviços pagos, multi-moeda avançada e anexos/comprovantes;
- transformar automaticamente pares em transferência;
- usar a planilha histórica do discovery ou criar adaptador específico para ela;
- implementar qualquer código, migration, endpoint ou UI nesta unidade documental.

## 7. Termos

| Termo | Definição |
|---|---|
| Sessão | Draft server-side de uma tentativa de importação pertencente a um owner e uma conta. |
| Linha | Registro normalizado e revisável derivado de uma transação do arquivo. |
| Estado financeiro | Conta, categoria, lançamento, transferência, recorrência, template ou efeito em read model; sessão/draft não é estado financeiro. |
| Duplicidade forte | Mesmo owner, conta, formato/origem e identificador externo confiável normalizado. |
| Duplicado provável | Sem ID forte, igualdade determinística de conta, data, tipo, valor e descrição normalizada. |
| Possível duplicado | Sem igualdade exata, mas mesma conta, tipo, valor e descrição normalizada em janela de ±2 dias civis. |
| Fingerprint | SHA-256 versionado de campos canônicos; serve à comparação, não substitui constraints/owner. |
| Override | Confirmação consciente de uma heurística; duplicidade forte não admite override na V1. |
| Versão do draft | Inteiro monotônico usado em concorrência otimista. |

## 8. Comportamento atual

Não há importação, upload ou entidades correspondentes. Lançamentos são criados individualmente por contrato próprio e exigem conta e categoria. Portanto, nenhum arquivo hoje produz estado ou efeito financeiro.

## 9. Comportamento desejado

### 9.1 Limites e upload

- Uma operação autenticada cria a sessão e recebe um único arquivo `.ofx` ou `.csv`, escolhido e enviado explicitamente, e uma conta própria ativa BRL. Limite: **10 MiB**, **10.000 linhas transacionais** e **30 segundos de parsing**; exceder qualquer limite rejeita todo o upload.
- Extensão, MIME permitido (`application/x-ofx`, `application/xml`, `text/xml`, `text/csv`, `text/plain`) e assinatura/conteúdo devem ser coerentes. MIME genérico só é aceito se extensão e parser seguro confirmarem o formato. Nome nunca decide caminho/formato.
- Upload inválido retorna erro e não cria sessão persistente nem qualquer estado financeiro. Falha após alocação transitória remove bytes e draft incompleto.
- O servidor calcula `fileHash = SHA-256(bytes)` e não confia em hash do cliente. O arquivo bruto existe somente em armazenamento temporário privado durante parsing, sem URL pública, e é apagado no sucesso ou falha, no máximo em **1 hora** pelo job de contingência. Nome original é reduzido a basename sanitizado apenas para exibição e eliminado com a sessão.
- Conteúdo bruto OFX/CSV e linha textual original não são persistidos. Persistem somente campos normalizados/revisáveis, metadados técnicos mínimos e hashes.

### 9.2 Parsing OFX

- Aceitar OFX 1.x SGML e OFX 2.x XML somente quando o parser escolhido provar limites e configuração segura. DTD, entidade externa, XInclude, rede, filesystem, expansão recursiva e execução de conteúdo são proibidos.
- Extrair, quando presentes: `FITID`, `DTPOSTED`, `TRNAMT`, `TRNTYPE`, `NAME`, `MEMO`, instituição/conta mascarada somente para contexto e campos não sensíveis úteis. `NAME` e `MEMO` compõem descrição com regra documentada, comprimento validado e sem HTML.
- `TRNAMT < 0` vira `EXPENSE`; `TRNAMT > 0` vira `INCOME`; magnitude absoluta vira dinheiro. `TRNTYPE` incompatível gera aviso e exige decisão explícita de natureza. Zero, overflow, data inválida ou ausência de campos obrigatórios bloqueia a linha.
- Offset/hora de `DTPOSTED` não desloca a data: conservar a porção civil declarada pela instituição. Ausência/ambiguidade bloqueia a linha para correção explícita.

### 9.3 Parsing e mapeamento CSV

- Não existe layout universal nem perfil especial para a planilha histórica. O parser preserva células como texto, suporta UTF-8 (BOM opcional) e rejeita encoding não reconhecido; delimitador, presença de cabeçalho, formato de data e separador decimal são escolhidos/confirmados pelo usuário.
- O usuário mapeia exatamente uma coluna para data, descrição e valor, ou para data/descrição e duas colunas exclusivas débito/crédito. Pode mapear natureza/sinal e identificador externo opcional. Colunas repetidas/incompatíveis bloqueiam preview.
- Separador decimal (`vírgula` ou `ponto`) e regra de milhar são explícitos. O servidor rejeita texto ambíguo, notação científica, `NaN`, infinito, mais de duas casas sem decisão de correção e valor zero.
- Com uma coluna de valor, sinal negativo/positivo determina despesa/entrada, salvo coluna de natureza coerente. Sem sinal suficiente, cada linha fica bloqueada até natureza explícita. Com débito/crédito, exatamente um deve conter valor positivo; ambos/nenhum geram conflito.
- Alterar mapping incrementa versão, reparsa deterministicamente e substitui as linhas do draft, nunca lançamentos. O preview exibe a regra aplicada.

### 9.4 Revisão

- Preview lista **todas** as linhas parseadas, inclusive inválidas, com número lógico, descrição, data, natureza, valor, categoria, seleção, avisos e duplicidades. Paginação/virtualização não pode ocultar contagens nem eliminar linhas do draft.
- O usuário pode selecionar/desmarcar; editar descrição, data civil, valor decimal e natureza; selecionar categoria ativa própria compatível; e justificar/aceitar override heurístico. Cada alteração registra no draft `editedFields`, versão, timestamp técnico e valores anterior/novo normalizados; não é auditoria financeira e expira com a sessão.
- Linha inválida, sem categoria, com conflito não resolvido ou duplicidade forte não pode ser selecionada para confirmação. Itens desmarcados nunca são persistidos como lançamento.
- Preview é puro sobre o draft: recalcula validações/deduplicação e devolve `previewToken` opaco curto, versão/hash, totais separados de entradas/despesas e contagens. Não cria lançamento ou read-model effect.
- Qualquer alteração de draft invalida o token. Antes de confirmar, o servidor revalida conta, categorias, linhas e duplicidades contra o banco atual.

### 9.5 Semântica do lançamento confirmado

Cada linha selecionada cria um `FinancialTransaction` próprio `PAID`, com conta escolhida, categoria compatível, tipo normalizado, descrição revisada, `plannedAmount` e `actualAmount` iguais à magnitude positiva, `dueDate` e `paidAt` iguais à data civil, `notes = null`, sem template/recorrência. A identidade de importação permanece ligada ao lançamento.

Não se infere transferência. Uma linha que mencione conta própria recebe aviso explicável; continua lançamento comum se o usuário confirmar ou pode ser desmarcada para criação posterior pelo fluxo de transferências.

### 9.6 Confirmação atômica

- A tela mostra quantidade, total de entradas, total de despesas, saldo líquido apenas como resumo e avisos aceitos. O botão rotulado “Importar N lançamentos” é a única ação que cria dados.
- A confirmação exige ao menos uma linha elegível selecionada, token/version/hash atuais, `Idempotency-Key` UUID e ação explícita. Em uma transação PostgreSQL, bloqueia/serializa a sessão, revalida owner/conta/categorias/dedup, cria todos os lançamentos e identidades, grava resultado e marca a sessão `CONFIRMED`.
- A unidade é **tudo ou nada**. Qualquer conflito, erro de linha, constraint ou falha desfaz lançamentos, identidades e confirmação. Não existe sucesso parcial. Desmarcados/rejeitados ficam apenas no resumo da sessão.
- Após sucesso, sessão e linhas ficam somente leitura. Cancelar/expirar nunca cria lançamento. Não há confirmação automática em upload, preview, Back, restore, timeout ou force-stop.

## 10. Atores

| Ator | Necessidade | Autorização |
|---|---|---|
| Usuário autenticado | Revisar e confirmar arquivo próprio | CRUD apenas de sessão própria e confirmação explícita |
| API | Proteger domínio e garantir determinismo | Validar, detectar e gravar sob owner/transação |
| Job de cleanup | Minimizar retenção | Expirar/remover drafts e temporários, sem criar/apagar lançamentos |
| SPA Web/Capacitor | Conduzir o mesmo fluxo online | Nunca parsear como fonte de verdade nem gravar offline |

## 11. Fluxos e UX mobile-first

### 11.1 Fluxo principal

`Escolher arquivo → escolher conta → mapear colunas (CSV) → preview → revisar conflitos/duplicados → confirmar → resumo`.

A escolha de conta pode aparecer junto ao upload, mas ambos são explícitos antes do parsing definitivo. OFX pula mapping somente quando todos os campos são inequívocos.

### 11.2 Requisitos de interface

- Mesma SPA em Web e Android/Capacitor, online-first, a partir de `360 × 800 CSS px`, sem segunda UI. Alvos mínimos `44 × 44 CSS px`, safe areas, teclado, foco, leitor de tela e texto a 200% sem corte/overflow/perda de ação.
- Lista grande usa paginação/virtualização com altura dinâmica e preserva foco, posição, seleção e contagens. Nunca renderizar 10.000 linhas simultaneamente. Ações em lote não mudam linha invisível sem confirmação clara.
- Chips/filtros rotulados: **Todos**, **Válidos**, **Com aviso**, **Duplicados**, **Selecionados**. Estado não depende somente de cor; contagem e razão do aviso são textuais.
- Edição informa campo original/importado e valor atual. Ajustes de data/valor/natureza e aceites heurísticos são explícitos e ficam no histórico do draft.
- Back fecha teclado/seletor primeiro e depois volta uma etapa. Se houver arquivo/mapping/edição/seleção relevante, sair ou trocar arquivo exige “Continuar revisando” ou “Descartar importação”; Back nunca confirma. Sem mudança, pode voltar normalmente.
- Cada mutação concluída salva draft no servidor. Após force-stop/reabertura e sessão autenticada, oferecer retomada na última etapa válida; sessão expirada informa perda do draft. Nada financeiro fica em `localStorage`/`sessionStorage`/IndexedDB ou fila offline.
- Falha de rede mantém somente a cópia em memória e oferece retry; não promete salvar edição não reconhecida pelo servidor. Logout limpa memória. Outro usuário jamais vê o draft anterior.
- Resumo final mostra criados, rejeitados/desmarcados, duplicidades bloqueadas, entradas/despesas e links para lançamentos próprios; retry de resposta perdida mostra o mesmo resumo.

## 12. Regras de negócio

| ID | Regra |
|---|---|
| RN-01 | Nenhum passo anterior ao confirm explícito cria lançamento ou efeito financeiro. |
| RN-02 | Conta própria ativa BRL e categoria própria ativa compatível são obrigatórias no commit. |
| RN-03 | Dinheiro é string/Decimal(19,2), magnitude positiva; float é proibido. |
| RN-04 | Datas financeiras são civis e não sofrem deslocamento de timezone. |
| RN-05 | Importado confirmado é lançamento avulso pago, não transferência/recorrência/template. |
| RN-06 | Upload/confirm são limitados, autenticados, `no-store` e sujeitos a rate limit. |
| RN-07 | Duplicidade forte é bloqueada sem override na V1, inclusive se o lançamento anterior for tombstone. |
| RN-08 | Heurística é determinística, explicada e exige aceite consciente quando confirmada. |
| RN-09 | Confirmação é atômica, serializada e idempotente. |
| RN-10 | Arquivo bruto não é retenção/auditoria permanente; dados normalizados são mínimos. |
| RN-11 | Reupload do mesmo hash nunca importa silenciosamente; apresenta sessão/resultado anterior e ainda reexecuta dedup atual. |
| RN-12 | Planilha histórica de discovery é explicitamente proibida como fonte especial. |

## 13. Modelo conceitual futuro

A implementação deve criar entidades próprias. Nomes Prisma finais podem seguir convenção do repositório sem mudar a semântica.

### 13.1 `ImportSession`

| Campo | Tipo/regra |
|---|---|
| `id`, `userId`, `accountId` | UUID; owner obrigatório; conta escolhida; índices iniciados por owner |
| `format` | `OFX | CSV` |
| `status` | `UPLOADED | MAPPING_REQUIRED | READY_FOR_REVIEW | CONFIRMING | CONFIRMED | CANCELLED | EXPIRED | FAILED` |
| `fileHash`, `parserVersion` | SHA-256 server-side e versão canônica |
| `displayFileName` | basename sanitizado, máx. 120, opcional; nunca path |
| `mapping` | JSON estritamente versionado/validado, somente CSV |
| `draftVersion` | inteiro monotônico, começa 1 |
| `rowCount`/contagens | inteiros técnicos derivados |
| `createdAt`, `updatedAt`, `expiresAt`, `confirmedAt`, `cancelledAt` | timestamps técnicos UTC |

Transições são monotônicas; `FAILED/CANCELLED/EXPIRED/CONFIRMED` são terminais. `CONFIRMING` é interno à transação/lock e não pode ficar órfão: rollback retorna ao estado anterior. Sessões editáveis expiram **7 dias após a última alteração**, sem renovação por simples leitura, e são removidas em até 24 horas após expirar/cancelar/falhar. Confirmadas retêm metadados/linhas mínimos enquanto existir lançamento vinculado; após todos os vínculos deixarem de existir por política futura, podem ser anonimizadas/removidas por unidade aprovada.

### 13.2 `ImportRow`

| Campo | Tipo/regra |
|---|---|
| `id`, `sessionId`, `userId`, `rowNumber` | UUIDs/inteiro; unicidade por sessão+linha; owner denormalizado para defesa/índice |
| campos normalizados | `date` civil, `description`, `type`, `amount Decimal(19,2)`, `externalId?`, `categoryId?` |
| revisão | `selected`, `validationStatus`, códigos de warning, `editedFields`, aceites heurísticos |
| fingerprints | `strongKeyHash?`, `exactFingerprint`, `windowFingerprint`, todos SHA-256 versionados |
| vínculo | `transactionId?` único; preenchido somente no commit |
| timestamps | criação/atualização e confirmação técnicos |

Descrição original integral não é mantida separadamente após edição; `editedFields` registra apenas o antes/depois normalizado necessário durante a vida do draft. Para linhas confirmadas, conservar campos/fingerprints necessários à origem e dedup; descartar histórico de edição e warnings transitórios após 30 dias. Hashes usam HMAC/pepper do servidor quando a reversão/dicionário for plausível; nunca são expostos como dado de negócio.

### 13.3 `ImportConfirmation`

| Campo | Tipo/regra |
|---|---|
| `id`, `sessionId`, `userId` | UUIDs, uma confirmação bem-sucedida por sessão |
| `idempotencyKey`, `payloadHash` | UUID e SHA-256; único por `(userId, idempotencyKey)` |
| `result` | snapshot mínimo do resumo e IDs próprios, sem descrições/valores linha a linha |
| `createdAt` | timestamp técnico |

As identidades/fingerprints confirmadas são a fonte durável de dedup e não são apagadas pelo cleanup de drafts. Constraints futuras devem garantir uma transação por linha e unicidade forte por owner+conta+identificador normalizado/origem; o hash não deve ser a única proteção contra colisão sem comparação canônica segura.

## 14. Duplicidade

### 14.1 Normalização explicável

Descrição: Unicode NFKC, trim, espaços consecutivos em um, case-fold locale-independente e remoção somente de pontuação separadora definida/versionada; não remover números nem palavras. ID externo: trim + case preservado/canônico por formato, com instituição/tipo de origem quando disponível. Qualquer mudança incrementa `fingerprintVersion` e preserva comparação compatível.

### 14.2 Níveis e comportamento

| Nível | Regra | UX/commit |
|---|---|---|
| Forte | owner + conta + origem + ID externo confiável iguais a linha confirmada/lançamento ativo ou excluído; também colisão dentro do arquivo | `DUPLICATE_STRONG`, desmarcada e bloqueada; sem override V1. IDs repetidos inconsistentes invalidam ambas para investigação. |
| Duplicado provável | sem forte; mesma conta, data civil, tipo, valor exato e descrição normalizada, contra ativo/tombstone ou outra linha | Mostra lançamento/linha candidata e critérios; começa desmarcado. Pode importar somente após marcar “Importar mesmo assim” naquela linha. |
| Possível duplicado | sem provável; mesma conta, tipo, valor e descrição normalizada em ±2 dias | Aviso mostra diferença de data; permanece selecionável, mas confirmação exige aceite explícito daquela linha. |

Não há similaridade textual, score secreto ou aproximação de valor. Candidatos alheios nunca participam nem são revelados. Se o arquivo não trouxer ID confiável, o identificador CSV opcional só é forte quando o usuário o mapeia e confirma que é ID estável do emissor; caso contrário é metadado auxiliar.

### 14.3 Reupload

Mesmo `fileHash` do owner mostra sessão/resultado anterior e exige decisão “Retomar/ver resumo” ou “Criar nova revisão”; não confirma nem seleciona tudo automaticamente. Nova revisão usa fingerprints atuais e encontrará fortes/prováveis. Hash igual de outro owner é invisível. Repetição de arquivo com bytes diferentes continua protegida por identidade/fingerprints.

## 15. Idempotência e concorrência

- Preview: mesma sessão+`draftVersion`+payload retorna resultado determinístico/cache privado server-side opcional; não incrementa versão nem grava finanças. Alteração produz nova versão/token.
- Draft: toda mutação exige `If-Match`/`draftVersion`. Igual versão aplica uma vez e incrementa; versão antiga retorna `409 IMPORT_VERSION_CONFLICT` com versão atual, sem sobrescrever.
- Confirm: `Idempotency-Key` UUID obrigatório. O `payloadHash` canônico inclui owner implícito, sessão, versão, preview hash, linhas/valores/aceites selecionados e conta/categorias resolvidas.
- Mesma chave+mesmo hash após sucesso retorna `200` e resultado original; primeira criação retorna `201`. Mesma chave+hash diferente retorna `409 IDEMPOTENCY_KEY_REUSED`.
- Duas confirmações, chaves iguais ou distintas, serializam pelo lock da sessão. Apenas uma cria; concorrente com chave diferente recebe `409 IMPORT_ALREADY_CONFIRMED` e pode consultar o resumo. Timeout/resposta perdida é recuperado repetindo a mesma chave.
- A constraint de sessão/linha/identidade é a última barreira contra duplicação. O servidor não confia em token, contagem, hash, owner ou decisão calculada só no cliente.

## 16. Contratos REST futuros

Todas as respostas privadas usam `Cache-Control: no-store`; todos exigem `AuthGuard`; mutações exigem CSRF conforme SPEC-002, CORS/origem permitida e validação estrita. IDs alheios/inexistentes retornam o mesmo `404 IMPORT_NOT_FOUND`. Upload usa `multipart/form-data`; demais corpos JSON. Não aceitar `userId`.

| Método/rota | Sucesso | Entrada essencial | Idempotência/erros específicos |
|---|---:|---|---|
| `POST /api/imports` | `201` | arquivo, `format`, `accountId`; opcional `Idempotency-Key` de upload | `400 INVALID_IMPORT_FILE`, `413 IMPORT_FILE_TOO_LARGE`, `415 UNSUPPORTED_IMPORT_FORMAT`, `422 IMPORT_PARSE_ERROR`, `429 RATE_LIMITED`; retry de upload pela chave/hash não duplica sessão |
| `GET /api/imports/:id` | `200` | paginação/filtro de linhas | `404`; leitura pura; inclui versão/estado/contagens, nunca bytes brutos |
| `PUT /api/imports/:id/mapping` | `200` | mapping completo + `draftVersion` | `400 INVALID_CSV_MAPPING`, `409 IMPORT_VERSION_CONFLICT`, `422` por linhas/limites |
| `PATCH /api/imports/:id/rows/:rowId` | `200` | whitelist de campos + versão | `400 INVALID_IMPORT_ROW`, `409` versão/estado, `404` opaco |
| `POST /api/imports/:id/preview` | `200` | versão atual | `409 IMPORT_DRAFT_STALE`, `422 IMPORT_NOT_READY`; puro |
| `POST /api/imports/:id/confirm` | `201/200` | preview token, versão e chave header | `409` idempotência/conflito/duplicidade/conta-categoria, `422 IMPORT_NOT_CONFIRMABLE`; atômico |
| `DELETE /api/imports/:id` | `204` | versão atual para draft editado | idempotente para cancelada própria; confirmada retorna `409 IMPORT_ALREADY_CONFIRMED` |

Envelope canônico: `{ "statusCode", "code", "message", "details?" }`; `details` usa número/field/código sanitizado, nunca conteúdo bruto. Validação sintática é `400`; formato de mídia `415`; entidade parseável mas semanticamente inválida `422`; estado/concorrência/dedup `409`; autenticação `401`, CSRF/origem `403`, owner opaco `404`, limite `413/429` e falha inesperada `500 INTERNAL_ERROR` sanitizado.

Rate limit inicial: **5 uploads/15 min/owner e IP**, **20 previews/min/owner**, **5 confirmações/min/owner**; respostas `429` incluem `Retry-After`. Ajuste futuro pode ser operacional se não reduzir proteção nem mudar o limite funcional do arquivo.

## 17. Validações e permissões

| Alvo | Validação/resultado |
|---|---|
| conta | UUID próprio, ativo, BRL no upload e confirm; senão `404` opaco ou `409 IMPORT_ACCOUNT_UNAVAILABLE` |
| categoria | própria, ativa, tipo igual à linha no confirm; conflito atômico |
| descrição | trim, 1–200 caracteres, controle/HTML neutralizado como texto |
| valor | string canônica positiva, `0.01..99999999999999999.99`, 2 casas; Decimal |
| data | gregoriana real `YYYY-MM-DD`, sem timezone; intervalo suportado pelo domínio |
| arquivo | extensão/MIME/conteúdo/bytes/linhas/tempo nos limites |
| versão/token | owner, sessão, payload e validade coincidem; caso contrário conflito |

Somente owner autenticado pode criar, ler, editar, cancelar ou confirmar. Relações de conta/categoria/lançamento são sempre consultadas com `userId`. Job de cleanup usa papel técnico mínimo e não acessa conteúdo fora da finalidade.

## 18. Segurança e privacidade

- Tratar filename, cabeçalhos, células, XML/SGML e metadados como não confiáveis; basename sanitizado, sem concatenação de path, arquivo temporário com nome aleatório/permissão restrita e remoção garantida.
- Parsing streaming/limitado quando possível; limite de profundidade/tokens/célula (descrição final 200; célula lida no máximo 8 KiB), sem macros, fórmulas, links ativos, HTML, scripts, shell, rede ou execução.
- CSV formula injection: valores iniciados por `=`, `+`, `-`, `@`, tab/CR são sempre texto inerte no preview. Se exportação futura existir, deve prefixar/escapar para planilha; esta SPEC não cria exportação. Sinal monetário é interpretado somente na coluna mapeada por parser decimal, nunca executado.
- OFX/XML desabilita DTD/XXE/XInclude/external entities e impõe tamanho, profundidade, contagem e timeout. SGML é tokenizado sem browser/DOM permissivo.
- TLS, AuthGuard, CSRF, CORS, `no-store`, CSP da SPA e owner isolation permanecem obrigatórios. Nenhum conteúdo financeiro vai para URL, analytics, storage JS persistente ou clipboard automático.
- Não logar arquivo, bytes, filename original, descrição/memo, datas, valores, saldo, mapping/células, external ID, fingerprints, token, cookie, chave idempotente completa ou resposta privada. Evidências usam dados sintéticos.
- Retenção e cleanup seguem seção 13; falha de deleção temporária gera alerta e retry. Backups futuros devem herdar prazo documentado e criptografia do banco; mudança de retenção requer revisão de privacidade.

## 19. Erros e estados vazios

| Situação | Estado | Recuperação |
|---|---|---|
| arquivo vazio/inválido | nenhuma sessão persistida | escolher outro arquivo |
| CSV sem mapping | etapa obrigatória, sem preview confirmável | mapear/confirmar regras |
| nenhuma linha válida/selecionada | CTA desabilitado com razões | corrigir/selecionar ou cancelar |
| conta/categoria arquivada durante revisão | conflito visível, zero commit | escolher recurso ativo e gerar novo preview |
| versão concorrente | draft preservado no servidor | recarregar e reaplicar conscientemente |
| rede/timeout | não afirmar sucesso | retry com mesma chave/consultar sessão |
| expirada | somente mensagem e metadados mínimos | iniciar novo upload |
| confirmada | resumo somente leitura | abrir lançamentos; não confirmar novamente |

## 20. Observabilidade

Logs estruturados permitidos: correlation ID, `importSessionId`, `ownerId` interno pseudonimizado/restrito, formato, parserVersion, status, contagem total/válida/duplicada/rejeitada, evento de confirmação, duração, bytes em bucket, retry/rollback e código de erro. O identificador interno não aparece em dashboards amplos nem em mensagens públicas.

Métricas: latência/erro por operação e formato, parsing timeout, rejeição por limite, sessões expiradas, cleanup pendente, conflitos de versão, strong/probable/possible em contagens agregadas, confirmações/rollbacks e retries idempotentes. Alertar `5xx`, rollback, temporário >1h e cleanup atrasado. Não registrar descrições, valores ou arquivo bruto por padrão.

## 21. Migração, compatibilidade e rollback

Implementação futura requer migration **aditiva** para novas entidades/índices/constraints e relação de linhagem, sem editar migrations aplicadas. Dados existentes não recebem fingerprint nem são alterados; heurística os consulta pelos campos atuais. A duplicidade forte só existe contra identidades importadas futuras.

Deploy deve poder ficar atrás de feature flag/coorte. Rollback desabilita novas sessões/confirmações, preserva lançamentos já confirmados e suas identidades, executa cleanup e volta a aplicação; não desfaz dinheiro por exclusão em massa. Reversão de lançamento é individual pela SPEC-017. Remover tabelas/dados exige SPEC destrutiva separada.

## 22. Critérios de aceite (Given/When/Then)

### CA-01 — OFX válido
**Dado** OFX válido dentro dos limites e conta própria ativa **Quando** o usuário envia **Então** vê todas as transações normalizadas em draft e nenhum lançamento criado.

### CA-02 — CSV válido
**Dado** CSV UTF-8 dentro dos limites **Quando** envia e conclui mapping válido **Então** vê todas as linhas em preview sem efeito financeiro.

### CA-03 — Arquivo inválido
**Dado** extensão/MIME/conteúdo incoerente **Quando** envia **Então** recebe erro sanitizado, sem sessão persistida ou estado financeiro.

### CA-04 — Tamanho/linhas
**Dado** arquivo acima de 10 MiB ou 10.000 linhas **Quando** envia **Então** todo upload é rejeitado e temporários são removidos.

### CA-05 — Conta obrigatória
**Dado** arquivo válido sem conta própria ativa BRL **Quando** envia/confirma **Então** a operação é bloqueada sem criação automática.

### CA-06 — CSV exige mapping
**Dado** layout CSV desconhecido **Quando** abre a sessão **Então** confirmação permanece indisponível até data, descrição, valor/natureza e separadores serem mapeados.

### CA-07 — Decimal ambíguo
**Dado** `1.234,56` sem regras confirmadas **Quando** tenta preview **Então** o servidor não infere perigosamente e exige mapping explícito.

### CA-08 — Sinal OFX
**Dado** `TRNAMT` negativo/positivo coerente **Quando** parseia **Então** produz despesa/entrada com magnitude Decimal exata.

### CA-09 — Zero/inválido
**Dado** valor zero, overflow ou data inválida **Quando** revisa **Então** linha aparece bloqueada com razão e não pode ser confirmada.

### CA-10 — Preview puro
**Dado** sessão revisável **Quando** gera ou repete preview **Então** saldos, dashboard, orçamento e lançamentos permanecem inalterados.

### CA-11 — Todas as linhas visíveis
**Dado** linhas válidas e inválidas **Quando** filtra/pagina **Então** todas permanecem acessíveis e contagens globais não mudam.

### CA-12 — Editar descrição
**Dado** descrição importada **Quando** corrige explicitamente **Então** draft registra edição/versiona e o lançamento futuro usa o texto revisado.

### CA-13 — Editar data/valor/natureza
**Dado** campo ambíguo **Quando** ajusta **Então** original/atual e aviso são visíveis, token anterior é invalidado e nenhum lançamento nasce.

### CA-14 — Desmarcar
**Dado** linha válida selecionada **Quando** desmarca e confirma outras **Então** ela não vira lançamento.

### CA-15 — Categoria obrigatória
**Dado** linha sem categoria **Quando** tenta confirmar **Então** é bloqueada; categoria não é criada automaticamente.

### CA-16 — Categoria incompatível/arquivada
**Dado** categoria alheia, arquivada ou de outra natureza **Quando** seleciona/confirma **Então** recebe erro opaco/conflito e zero lote é criado.

### CA-17 — Duplicidade forte existente
**Dado** mesmo owner, conta, origem e FITID já confirmados **Quando** revisa/reconfirma **Então** linha fica bloqueada sem override, inclusive com tombstone anterior.

### CA-18 — FITID duplicado no arquivo
**Dado** duas linhas com mesmo FITID e conteúdo conflitante **Quando** parseia **Então** ambas exibem conflito forte e não são confirmáveis.

### CA-19 — Duplicado provável
**Dado** mesmos conta/data/tipo/valor/descrição normalizada sem ID **Quando** revisa **Então** vê critérios e candidato, linha começa desmarcada e só confirma com override individual.

### CA-20 — Possível duplicado
**Dado** mesmos conta/tipo/valor/descrição em ±2 dias **Quando** revisa **Então** vê diferença explicada e precisa aceitar o aviso antes do commit.

### CA-21 — Sem fuzzy opaco
**Dado** apenas texto aproximadamente parecido **Quando** deduplica **Então** não atribui score/duplicidade secreta nem bloqueia por fuzzy matching.

### CA-22 — Reupload idêntico
**Dado** mesmo hash já enviado pelo owner **Quando** reenvia **Então** vê sessão/resultado anterior e escolhe retomar ou nova revisão, sem autoimportação.

### CA-23 — Bytes diferentes, ID igual
**Dado** arquivo alterado com FITID já confirmado **Quando** revisa **Então** constraint/dedup forte impede novo lançamento.

### CA-24 — Confirmação explícita
**Dado** preview elegível **Quando** ainda não acionou “Importar N lançamentos” **Então** há zero criação financeira.

### CA-25 — Lote atômico
**Dado** N linhas selecionadas e uma falha na última **Quando** confirma **Então** nenhuma linha, identidade ou confirmação persiste.

### CA-26 — Confirmação idempotente
**Dado** confirmação bem-sucedida **Quando** repete mesma chave e payload **Então** recebe o mesmo resultado `200` sem duplicar.

### CA-27 — Chave reutilizada
**Dado** chave já vinculada a payload **Quando** envia payload diferente **Então** recebe `409 IDEMPOTENCY_KEY_REUSED` sem escrita.

### CA-28 — Timeout/resposta perdida
**Dado** commit concluído e resposta perdida **Quando** cliente repete mesma chave **Então** recupera o resumo original e existe um único lote.

### CA-29 — Concorrência
**Dado** duas confirmações simultâneas da sessão **Quando** competem **Então** uma cria atomicamente e a outra retorna resultado idempotente ou conflito, nunca duplicação.

### CA-30 — Mudança concorrente
**Dado** draft aberto em dois dispositivos **Quando** ambos salvam a mesma versão **Então** somente o primeiro avança e o segundo recebe conflito sem sobrescrever.

### CA-31 — Conta arquivada durante revisão
**Dado** conta ativa no preview e arquivada antes do commit **Quando** confirma **Então** recebe conflito e zero lançamento.

### CA-32 — Cancelamento
**Dado** draft não confirmado **Quando** cancela explicitamente **Então** sessão termina/expira e nenhum item vira lançamento.

### CA-33 — Owner isolation
**Dado** ID de sessão/linha/conta/categoria de outro owner **Quando** acessa **Então** recebe resposta indistinguível de inexistente e nenhum dado/candidato vaza.

### CA-34 — Segurança OFX
**Dado** XML com DTD/entidade externa ou payload expansivo **Quando** envia **Então** parser rejeita sem rede/filesystem, execução ou retenção indevida.

### CA-35 — Segurança CSV
**Dado** célula com fórmula/script/path **Quando** visualiza **Então** é texto inerte e nunca é executada ou usada como caminho.

### CA-36 — Mobile 360×800
**Dado** Web/Capacitor em `360 × 800` **Quando** percorre o fluxo **Então** ações, filtros e resumo são alcançáveis sem overflow horizontal ou conteúdo sob safe area/teclado.

### CA-37 — Texto 200% e toque
**Dado** texto a 200% **Quando** revisa lista **Então** conteúdo reflui, razões permanecem legíveis e alvos têm pelo menos `44 × 44 CSS px`.

### CA-38 — Back com draft
**Dado** edição relevante **Quando** usa Back **Então** fecha transitório ou pede continuar/descartar, sem perder ou confirmar silenciosamente.

### CA-39 — Force-stop
**Dado** draft salvo no servidor **Quando** app sofre force-stop e reabre autenticado antes da expiração **Então** oferece continuar na última etapa válida.

### CA-40 — Falha offline
**Dado** API indisponível **Quando** tenta salvar/confirmar **Então** não cria fila offline nem afirma sucesso e permite retry seguro.

### CA-41 — Resumo final
**Dado** confirmação concluída **Quando** abre resumo **Então** vê contagens, entradas/despesas, desmarcados/duplicados e links próprios coerentes com o resultado imutável.

### CA-42 — Read models
**Dado** lote confirmado **Quando** commit termina **Então** lançamentos pagos passam juntos a saldos/dashboard/orçamento e drafts/rejeitados nunca entram.

### CA-43 — Transferência aparente
**Dado** linha semelhante a transferência própria **Quando** revisa **Então** recebe aviso, mas nenhuma transferência/par automático é criado.

### CA-44 — Retenção
**Dado** parsing encerrado ou sessão abandonada **Quando** prazos vencem **Então** bytes somem em até 1h e draft expira/é removido conforme política, preservando identidades confirmadas.

### CA-45 — Planilha histórica
**Dado** discovery histórico do projeto **Quando** implementação é planejada **Então** não existe seed, migração ou adaptador privilegiado para essa planilha.

## 23. Testes obrigatórios da implementação futura

| Nível | Cenários mínimos | Evidência |
|---|---|---|
| Unitário | parsers/limites, mapping, Decimal/data/sinal, normalização/fingerprints, estados, payload hash | testes determinísticos com fixtures sintéticas |
| Integração PostgreSQL | migration/constraints, owner, locks, atomicidade, tombstone dedup, cleanup, concorrência/idempotência | banco real e falha injetada |
| Contrato/API | multipart, auth/CSRF/CORS/no-store, whitelist, status/envelopes, paginação/versão/rate limit | testes HTTP |
| Segurança | XXE/billion laughs, SGML malformado, CSV formula/path, zip não aceito, timeout/memória/log redaction | suíte adversarial sem rede/execução |
| Componentes | mapping, edição, filtros, contagens, conflitos, foco/200%/44 px | Vitest/DOM/a11y |
| E2E Web | upload→resumo, retry, Back, conflito e arquivo grande | Playwright em viewports aplicáveis |
| E2E Android | arquivo picker, teclado/safe area, Back, force-stop/restore e rede ausente | emulador e dispositivo físico conforme SPEC-012 |
| Regressão | lançamentos, saldo, dashboard, orçamento e exclusão | suítes existentes + casos importados |
| Aceitação manual | OFX/CSV sintéticos, 10k linhas, explicação de dedup e zero criação prévia | checklist sem dados reais |

## 24. Arquivos permitidos

Nesta unidade documental:

- `docs/specs/SPEC-021-IMPORTACAO-OFX-CSV.md`;
- `docs/specs/README.md`.

Implementação futura deve ter branch/SPEC rastreável e declarar schema/migration, módulo API, contratos compartilhados, SPA e testes necessários.

## 25. Arquivos proibidos

Nesta unidade documental, qualquer arquivo não listado na seção 24, especialmente código, migrations, lockfiles, dependências, endpoints e UI.

## 26. Dependências

| Dependência | Motivo | Aprovação | Impacto |
|---|---|---|---|
| SPEC-002–007, 010–014, 017, 019 | owner, domínios, read models, mobile, exclusão e idempotência | Aprovadas/implementadas conforme índice/base | contratos preservados |
| Parser OFX/CSV | parsing defensivo | **A escolha de biblioteca fica para investigação técnica da implementação; nenhuma dependência é aprovada por esta SPEC** | deve ser gratuita, mantida, auditada e justificar segurança/licença |
| PostgreSQL/Prisma atuais | transação, Decimal, constraints e migration | existente | sem serviço pago |

Não há dependência de serviço externo/pago. Escolher pacote é decisão técnica reversível apenas se cumprir o contrato; adicionar dependência exige justificativa explícita e revisão de supply chain na implementação.

## 27. Riscos e limitações

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| layout bancário inconsistente | Alta | Alto | mapping/revisão, fixtures, erro por linha, sem auto-commit |
| falso positivo/negativo de dedup | Média | Alto | níveis explicáveis, ID forte, override limitado e constraints |
| lote grande em mobile | Média | Médio | limite, paginação/virtualização e filtros server-side |
| XXE/DoS/conteúdo ativo | Média | Alto | parser seguro, streaming/limites/timeout e suíte adversarial |
| vazamento financeiro | Baixa | Alto | owner/no-store, retenção curta, redaction e sem storage JS |
| timeout após commit | Média | Alto | idempotência e resumo persistido |
| categoria obrigatória torna revisão longa | Alta | Médio | filtro/edição eficiente; criação/sugestão automática permanece proibida |

Limitações aceitas: BRL, categoria por linha, ausência de PDF/IA/transferência automática e heurística simples podem exigir trabalho manual. Isso é preferível a criação incorreta ou opaca.

## 28. Rollback

Esta alteração documental reverte com `git revert <SHA>`. Na implementação futura, desabilitar feature flag e confirmações, preservar lançamentos/identidades já criados, limpar temporários/drafts nos prazos e usar a SPEC-017 para exclusão individual. Nunca apagar lote confirmado automaticamente como rollback.

## 29. Dúvidas

Não há dúvidas funcionais, financeiras, arquiteturais, de segurança ou privacidade abertas. A biblioteca concreta de parser é investigação técnica obrigatória da futura implementação e não muda as decisões de produto; se nenhuma opção cumprir segurança/licença, a implementação fica bloqueada e esta SPEC deve ser revista, sem parser caseiro silencioso.

## 30. Decisões aprovadas

| Data | Decisão | Aprovação | Consequência |
|---|---|---|---|
| 2026-08-13 | Fluxo assistido com zero efeito antes de confirmação explícita | solicitante | evita criação silenciosa |
| 2026-08-13 | Entidades próprias, draft server-side e bruto temporário ≤1h | solicitante + fechamento desta SPEC | retomada com retenção mínima |
| 2026-08-13 | Categoria ativa compatível obrigatória e importado como `PAID` | fechamento baseado no schema atual | preserva domínio/read models |
| 2026-08-13 | Forte sem override; provável/possível com aceite individual | solicitante + fechamento desta SPEC | dedup explicável |
| 2026-08-13 | Confirmação transacional, atômica, versionada e idempotente | solicitante | nenhum sucesso parcial/duplicação |
| 2026-08-13 | Não inferir transferências, contas, categorias, recorrências ou templates | solicitante | escopo V1 controlado |
| 2026-08-13 | Limites 10 MiB, 10.000 linhas, parsing 30s e sessão 7 dias | fechamento desta SPEC | segurança e operação verificáveis |
| 2026-08-13 | PDF e planilha histórica ficam fora | solicitante | próxima SPEC/adaptadores separados |

## 31. Definition of Done específica

Além da Definition of Done do projeto, a futura implementação exige:

- [ ] Todos os CA-01–45 automatizados no nível viável e aceitação manual registrada.
- [ ] Auditoria de dependência/licença/CVEs e testes adversariais dos parsers aprovados.
- [ ] PostgreSQL real comprova atomicidade, locks, idempotência, dedup e cleanup.
- [ ] Web e Android comprovam `360 × 800`, texto 200%, 44 px, Back e force-stop.
- [ ] Logs/cache/storage foram inspecionados e não contêm conteúdo financeiro proibido.
- [ ] Nenhum código da implementação entra antes de unidade/branch própria.

Para esta unidade documental: Prettier dos dois arquivos e `git diff --check` devem passar; lint, typecheck, testes e build são não aplicáveis porque não há alteração executável, conforme a proporcionalidade da DoD.

## 32. Histórico de alterações da SPEC

| Data | Alteração | Motivo | Autor | Aprovador |
|---|---|---|---|---|
| 2026-08-13 | Criação e aprovação da SPEC-021 | Fechar produto, dados, UX, API, segurança, dedup e idempotência antes de implementar | Equipe PlannerFin | solicitante da tarefa |
