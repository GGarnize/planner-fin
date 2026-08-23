# SPEC de funcionalidade — `SPEC-022 — Captura assistida de movimentações por notificações Android`

> Esta unidade é exclusivamente documental. Ela aprova o contrato de produto de uma implementação futura separada; não cria código nativo, backend, migration, endpoint, interface ou plugin.

## 1. Identificação

| Campo | Valor |
|---|---|
| ID | `SPEC-022` |
| Título | Captura assistida de movimentações por notificações Android |
| Responsável | Equipe PlannerFin |
| Data de criação | 2026-08-13 |
| Última atualização | 2026-08-22 |
| Tarefa relacionada | Prompt SPEC-022 no Codex Cloud |
| Documentos relacionados | SPEC-002, SPEC-005–008, SPEC-012–014, SPEC-017, SPEC-021; ADR-002; `schema.prisma`; políticas e documentação Android referenciadas na seção 3 |

## 2. Status

`Aprovada`

**Aprovada por:** solicitante da tarefa, em `2026-08-13`, ao autorizar expressamente a criação e aprovação desta SPEC com as decisões obrigatórias do prompt.

A aprovação fecha o contrato de produto, mas autoriza implementação somente em unidade futura própria. Itens marcados **DEPENDÊNCIA DE VALIDAÇÃO** são provas técnicas obrigatórias dessa unidade e não são decisões em aberto desta SPEC.

## 3. Contexto, fontes externas e auditoria AS-IS

### 3.1 AS-IS confirmado na `main`

| Área | Evidência atual | Lacuna/impacto TO-BE |
|---|---|---|
| Cliente | Uma SPA Vue/Quasar é empacotada por Capacitor 8 para Android; existe projeto nativo em `apps/web/android`. | Reutilizar a SPA e criar bridge/serviço local em unidade futura; não criar segundo frontend. |
| Manifest | O manifest principal declara somente `INTERNET`; não há `NotificationListenerService`, acesso de listener, receiver de boot ou package queries. | Toda declaração nativa e seu menor privilégio exigem prova local. |
| Plugins | Existem somente Capacitor core, Android e App; não há plugin de notificações recebidas. | Plugin/bridge local é **DEPENDÊNCIA DE VALIDAÇÃO**; nenhuma dependência é aprovada silenciosamente. |
| Autenticação | Access token fica somente em memória; refresh fica em cookie `HttpOnly`; a origem Android/CSRF segue SPEC-002/012. Não há refresh permanente em background. | É proibido copiar token para storage JS/nativo. Captura offline usa fila local sem credencial e só sincroniza quando a SPA recuperar sessão válida. |
| Offline | A aplicação é online-first e não possui fila financeira offline. | A nova fila é exclusiva de notificações brutas minimizadas, criptografada, limitada e sem criar estado financeiro. |
| Dados | `FinancialTransaction` não tem origem genérica; imports possuem `ImportSession`/`ImportRow` e vínculo próprio. Conta e categoria são obrigatórias no lançamento. | Linhagem deve ser aditiva, sem trocar o schema nesta unidade; candidato sem conta/categoria não confirma. |
| Importação | SPEC-021 e implementação atual separam draft/revisão de commit, usam owner, idempotência, fingerprint e deduplicação determinística. | Reutilizar conceitos de revisão/dedup, sem acoplar captura a uma sessão de importação. |
| Captura | Não existem preferências, dispositivos, notificações capturadas, classificações, candidatos, parsers ou endpoints correspondentes. | Todos são futuros e exigem migration/API/UI próprias. |

### 3.2 Referências normativas consultadas

- [Android — `NotificationListenerService`](https://developer.android.com/reference/android/service/notification/NotificationListenerService), inclusive vínculo do serviço por `BIND_NOTIFICATION_LISTENER_SERVICE`;
- [Android — acesso a notificações](https://developer.android.com/reference/android/app/NotificationManager#isNotificationListenerAccessGranted(android.content.ComponentName)) e [Settings de listener](https://developer.android.com/reference/android/provider/Settings#ACTION_NOTIFICATION_LISTENER_SETTINGS);
- [Android — visibilidade de pacotes](https://developer.android.com/training/package-visibility) e [Google Play — permissões de visibilidade ampla](https://support.google.com/googleplay/android-developer/answer/10158779);
- [Google Play — User Data](https://support.google.com/googleplay/android-developer/answer/10144311) e [Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469).

As páginas e políticas são mutáveis. A pesquisa em 2026-08-13 orienta este contrato, mas **não garante publicação**. Implementação, Privacy Policy, Data Safety, disclosure, artefato e listing devem ser revistos contra a política vigente na data de submissão.

## 4. Problema

O usuário hoje digita ou importa movimentações. Notificações bancárias podem ajudar a preparar candidatos, mas também contêm marketing, alertas de segurança e segredos. Captura ampla, opaca ou automática violaria confiança, poderia expor dados de outros apps e criaria dupla contagem. É necessário um fluxo Android opcional, consentido, mínimo, revisável e sem efeito financeiro silencioso.

## 5. Objetivo

Definir a futura captura Android de notificações de apps escolhidos pelo usuário, com descarte imediato dos demais, classificação determinística, revisão humana, retenção limitada, isolamento por owner/dispositivo e criação de lançamento somente após confirmação explícita.

> **Regra central e inegociável:** o PlannerFin funciona integralmente sem acesso às notificações.

Login, dashboard, contas, categorias, lançamentos, transferências, recorrências, modelos, orçamento, OFX/CSV, configurações e toda funcionalidade não dependente da captura continuam normais após ausência, recusa, revogação ou falha do listener. A permissão nunca integra onboarding, login ou uso normal.

## 6. Fora do escopo

- implementação nesta unidade; iOS; SMS; `AccessibilityService`; e-mail; Open Finance; OCR; captura de tela;
- IA/LLM, auto-categorização opaca, regras aprendidas na V1 ou criação financeira automática;
- iniciar pagamento/PIX, movimentar dinheiro ou oferecer aconselhamento financeiro;
- publicidade ou analytics sobre conteúdo; exportação pública de conteúdo bruto;
- `QUERY_ALL_PACKAGES` amplo sem aprovação técnica/policy futura; bypass de segurança Android;
- ícones, imagens, intents, remote inputs, extras completos ou payload binário;
- resolver novo transporte de autenticação ou persistir access/refresh token para background.

Regras determinísticas e opt-in do tipo “descrição contém IFOOD → sugerir Alimentação” ficam como extensão futura: visíveis, editáveis, somente sugestão e nunca auto-confirmação.

## 7. Termos

| Termo | Definição |
|---|---|
| Permissão | Acesso especial de Notification Listener concedido pelo Android; não é runtime permission comum. |
| Captura ativa | `permissionGranted && captureEnabled`; ainda exige pacote monitorado. |
| Pacote monitorado | `packageName` escolhido explicitamente para aquele owner e dispositivo. |
| Capturada | Registro bruto minimizado de pacote monitorado, após filtro de segredo. |
| Classificação | Interpretação revisável, sem efeito financeiro. |
| Candidato | Interpretação potencialmente financeira apresentada em “Para revisar”. |
| Confirmação | Ação explícita e idempotente que cria um lançamento após revalidação. |
| Dispositivo | Instalação Android vinculada tecnicamente a um owner; pode ser nomeada/desvinculada. |
| Linhagem | Relação extensível entre lançamento e sua fonte, sem presumir um enum no registro atual. |

## 8. Comportamento atual

Não há captura nem permissão de listener. O manifest não registra o serviço. O schema não representa dispositivo/notificação e lançamentos não têm origem genérica. A autenticação não oferece credencial para serviço nativo em background. OFX/CSV já possui revisão e identidade próprias, mas não recebe notificações.

## 9. Comportamento desejado

### 9.1 Consentimento, estados e revogação

Fluxo único: `Mais → Captura por notificações → explicação/disclosure → [Ativar acesso] → tela oficial do Android`.

- A tela informa `Acesso às notificações: Ativo/Desativado` e distingue `permissionGranted`, `captureEnabled` e `monitoredPackages[]`.
- A explicação aparece antes de Settings; abrir Settings requer gesto afirmativo separado. Não há ativação silenciosa, coerção, dark pattern nem prompt em toda abertura.
- Recusar ou voltar mantém a feature desligada e oferece `Agora não`. Tentar novamente só ocorre por botão explícito.
- Ao entrar/resumir a tela, o app consulta o estado real. Revogação interrompe callbacks utilizáveis, muda a UI para Desativado, preserva histórico conforme retenção e mostra `Ativar novamente`, sem reabrir Settings sozinho.
- Mesmo com permissão concedida, `captureEnabled=false` descarta novas notificações. Desligar oferece: **Desativar** (preserva histórico sob TTL) ou **Desativar e apagar histórico**.

### 9.2 Seleção e descoberta de apps

A V1 usa combinação sem acesso amplo: (1) catálogo remoto/local versionado de pacotes financeiros suportados, inicialmente podendo incluir Banrisul, Nubank e C6 Bank; (2) package visibility direcionada somente aos pacotes do catálogo quando necessária; (3) pacotes observados pelo listener mostrados como “observados neste dispositivo” guardando apenas `packageName`, label obtido legitimamente e `lastSeenAt`, **nunca título/texto/conteúdo**, até o opt-in.

O usuário ativa cada pacote. Catálogo não ativa monitoramento e exemplos não viram hardcode de negócio. Listar todos os apps instalados não faz parte do contrato. `QUERY_ALL_PACKAGES` é proibido na V1; eventual necessidade é **DEPENDÊNCIA DE VALIDAÇÃO** e exige revisão de SPEC/policy.

> **Notificação de app não selecionado é descartada no callback, antes de fila, persistência, sincronização, log ou analytics.** Somente metadados mínimos de descoberta acima podem ser atualizados, sem conteúdo.

### 9.3 Captura, OTP e persistência

Para pacote monitorado e captura ativa, a V1 pode guardar todas as notificações durante o período, inclusive marketing/não financeiras, para classificação determinística. Antes de qualquer gravação, um filtro local procura OTP, código/senha/token temporário, login/dispositivo novo, autenticação e segredo. Quando detectado, descarta todo o conteúdo e guarda no máximo contador técnico agregado; não cria registro revisável. Detecção inconclusiva é risco crítico: a implementação deve provar corpus, falsos negativos e minimização antes de release.

Campos permitidos são os listados na seção 13. Proibidos: objeto Android completo, ícone/imagem, intent, remote input, anexo, binário e extras sem allowlist. Logs/telemetria não contêm package associado a pessoa quando evitável, título, texto, descrição, valor, conta, OTP ou payload. Conteúdo nunca vai a analytics/publicidade.

Desligar um pacote interrompe novas gravações imediatamente. Histórico permanece até TTL ou exclusão; a ação oferece também “Desligar e apagar histórico deste app”. Trânsito é somente HTTPS; dados locais e server-side exigem criptografia adequada e backup excluído.

### 9.4 Classificação e parsers

Captura e interpretação são etapas independentes. Estados semânticos:

| Estado | Semântica |
|---|---|
| `UNCLASSIFIED` | Ainda não processada ou parser sem decisão. |
| `FINANCIAL_CANDIDATE` | Parser encontrou compra, entrada/PIX recebido, pagamento, transferência, estorno ou tarifa plausível. |
| `NON_FINANCIAL` | Marketing/aviso sem movimentação; sem candidato. |
| `AMBIGUOUS` | Informação insuficiente ou conflitante; pode ser revisada. |
| `IGNORED` | Regra explícita determinística manda não sugerir; regra aprendida não integra V1. |
| `CONFIRMED` | Confirmação criou/vinculou exatamente um lançamento. |
| `DISMISSED` | Usuário descartou; nenhum lançamento. |

Arquitetura futura: interface `NotificationParser`, implementações específicas por pacote (Nubank, Banrisul, C6 como exemplos) e `GenericNotificationParser`. Seleção usa `packageName + parserVersion + ruleSetVersion`. V1 é determinística, explicável e sem IA. App bancário não implica lançamento. Parser desconhecido preserva item revisável como `UNCLASSIFIED/AMBIGUOUS`.

Reprocessamento grava nova classificação/versão sem alterar o bruto nem duplicar candidato/lançamento. `CONFIRMED` nunca cria outro lançamento; no máximo atualiza interpretação histórica não financeira sem mudar o lançamento. Fingerprints/versionamento tornam o resultado auditável.

### 9.5 Revisão e fonte de pagamento

Fluxo: `capturada → classificada → Para revisar → abrir original + interpretação → editar → confirmar ou descartar`.

A tela permite corrigir tipo, valor decimal exato, descrição, data, fonte de pagamento compatível e categoria; marcar não financeira; descartar; e ver original ao lado da interpretação. Para `INCOME`, a fonte de pagamento é uma conta financeira ativa. Para `EXPENSE`, a fonte de pagamento pode ser uma conta financeira ativa ou um cartão de crédito ativo; quando for cartão, a revisão também permite informar parcelas conforme os limites da SPEC-008. “Ignorar semelhantes” só existirá quando uma futura SPEC definir regra explícita. Nada é criado por captura, parser, reprocessamento, timeout ou navegação.

V1 permite uma conta PlannerFin padrão por `packageName + owner + device`, escolhida explicitamente; ela é sugestão, não prova. O mesmo pacote pode ter associações diferentes em dispositivos. O modelo conceitual evolui para fonte de pagamento padrão em implementação futura (`ACCOUNT` ou `CARD`) sem exigir migration ampla nesta revisão. Sem associação, candidato é capturado/revisável, mas confirmação exige escolha de fonte própria ativa compatível com o tipo e categoria própria ativa compatível.

### 9.6 Origem, linhagem e deduplicação

Não se adiciona agora enum `MANUAL/RECURRENCE/NOTIFICATION/OFX/CSV` a `FinancialTransaction`. A implementação futura deve preferir uma linhagem extensível própria (`TransactionSourceLink` conceitual), pois imports já têm entidade/fingerprint e recorrências têm relação própria. Enquanto essa abstração não existir, a linhagem da notificação deve apontar para exatamente um destino financeiro confirmado: `FinancialTransaction` quando a revisão usar conta, ou `CardPurchase` quando a revisão usar cartão. Linhagem registra tipo de fonte, ID estável, owner e metadados mínimos; constraints impedem uma fonte de confirmar duas vezes.

Antes de confirmar e ao importar OFX/CSV, o backend sinaliza correspondência usando owner, conta, tipo, magnitude decimal, data/hora quando disponível, descrição normalizada e janela temporal. External ID/fingerprint forte tem prioridade. Uma notificação confirmada e linha importada podem ser ligadas como fontes do mesmo lançamento somente após decisão explícita do usuário. Não há auto-merge, exclusão ou alteração destrutiva. Possível duplicado cross-device usa os mesmos critérios e nunca texto isolado.

Transferência sugerida exige revisão: a V1 não cria automaticamente entidade `FinancialTransfer`; o fluxo futuro deve encaminhar/solicitar dados das duas contas conforme SPEC-006, ou o usuário descarta e cria pelo fluxo existente.

### 9.7 Execução nativa, offline e autenticação

O serviço pode receber callbacks com SPA fechada, em background ou após processo recriado. A fila nativa local contém apenas registros já filtrados de pacotes monitorados, criptografados com chave do Android Keystore, excluídos de backup, limite de **500 itens ou 10 MiB** (o que vier primeiro) e TTL de **7 dias**. Ao atingir limite, elimina primeiro o item mais antigo e registra somente métrica agregada de perda.

Fila é vinculada a `ownerBindingId + deviceId`, mas não contém token. Sincroniza somente quando a SPA está ativa, recuperou sessão válida e confirmou que o owner atual corresponde ao binding. Não existe refresh periódico/background, credencial em JS/native storage nem criação financeira offline. A definição segura do binding e do acionamento de sync é **DEPENDÊNCIA DE VALIDAÇÃO**; mudança no contrato de auth exige SPEC/ADR própria.

Reboot/processo morto podem restabelecer o listener conforme comportamento comprovado do Android, mas não autorizam sync. Logout, troca de usuário ou desvinculação interrompem sync, desativam a configuração local e fazem purge imediato da fila não sincronizada. Histórico server-side permanece com seu owner/TTL. Novo login exige novo vínculo/opt-in; nunca reatribui fila ao novo owner.

### 9.8 Retenção e exclusão

| Classe | Retenção máxima server-side | Justificativa/fim do prazo |
|---|---|---|
| Descoberta sem conteúdo | 30 dias desde `lastSeenAt` | Prazo curto para seleção; expira automaticamente. |
| `NON_FINANCIAL`, `IGNORED`, `DISMISSED` bruto | 30 dias | Útil para ajuste inicial, baixo benefício posterior. |
| `UNCLASSIFIED`, `AMBIGUOUS`, candidato pendente | 90 dias | Janela suficiente de revisão sem retenção indefinida. |
| `CONFIRMED` bruto | 30 dias após confirmação | Depois, purge de título/textos; mantém somente linhagem/fingerprint/parser/status/timestamps necessários enquanto existir o lançamento. |
| Fila nativa | 7 dias, 500 itens ou 10 MiB | Exposição offline curta e limitada. |

Purge automático é idempotente. Usuário pode excluir imediatamente item, pacote ou todo histórico. Exclusão de bruto confirmado não apaga lançamento; exclusão do lançamento segue SPEC-017 e mantém apenas linhagem/tombstone mínima para dedup. “Desativar” não apaga por padrão, mas sempre oferece “Desativar e apagar histórico”. Retenção legal divergente exige nova decisão explícita.

### 9.9 Multi-device e idempotência

Preferências e pacotes são por `owner + device`; usuário nomeia e desvincula dispositivos. Identidade de ingestão: `ownerId + deviceId + packageName + notificationKeyHash + postedAt + fingerprintVersion`. O hash/fingerprint usa chave/normalização server-side e campos estáveis, não somente texto. Unique constraint e `Idempotency-Key` tornam retry/reconexão no mesmo dispositivo o mesmo `CapturedNotification`.

Dois aparelhos podem receber o mesmo evento. Dedup cross-device sinaliza candidato provável por conta/tipo/valor/descrição/data/janela e external ID quando houver; não descarta silenciosamente. Desvincular bloqueia novas ingestões daquele device e purga fila local na próxima execução confiável; servidor rejeita device revogado.

## 10. Atores

| Ator | Necessidade | Ações autorizadas |
|---|---|---|
| Usuário autenticado Android | Optar, revisar e controlar dados próprios | Conceder externamente, ativar/desativar, selecionar apps, revisar, confirmar, excluir/desvincular |
| Android | Mediar acesso especial | Conceder/revogar e entregar callbacks conforme sistema |
| Serviço nativo | Filtrar e enfileirar minimamente | Nunca decidir finanças nem portar credencial |
| API/parser | Isolar, ingerir e interpretar | Somente owner/device autenticado; parser determinístico |
| Job de purge | Aplicar TTL | Apagar conteúdo expirado sem criar finanças |

## 11. Fluxos, interface e acessibilidade

Sem acesso:

```text
Captura por notificações
Acesso desativado

O PlannerFin pode identificar possíveis movimentações
nas notificações dos apps que você escolher.

[Ativar acesso]  [Agora não]
```

Com acesso: status Ativo; apps monitorados com estado; `Gerenciar apps`; `Desativar captura`; `Para revisar (N)`.

Estados de permissão, captura e app usam texto/ícone além de cor. Disclosure é legível antes do CTA, acessível por leitor de tela e teclado, com foco previsível, alvos de 44 × 44 CSS px, texto a 200%, contraste e sem timeout. Settings externa é anunciada. Back/“Agora não” preserva escolha e não bloqueia navegação.

### 11.1 Gerenciar apps: seções e prioridade de rótulo

A tela `Gerenciar apps` organiza os pacotes em quatro seções, nesta ordem:

```text
Monitorados
[sempre visível, sempre aberta, sem accordion]

Observados neste dispositivo (N)
[aberta por padrão]

Ignorados (N) ▸
[accordion, fechado por padrão]

Apps conhecidos (N) ▸
[accordion, fechado por padrão]
```

`Ignorados` e `Apps conhecidos` são collapsible: o cabeçalho mostra o contador e um indicador de estado (▸ fechado / ▾ aberto); o conteúdo só é renderizado quando expandido. Cada seção some inteiramente (cabeçalho incluso) quando não há itens — não é exibido `Ignorados (0)` nem `Apps conhecidos (0)` (ex.: catálogo com todos os apps já monitorados).

Cada item observado/ignorado separa claramente o bloco de texto (nome, pacote, "Visto em") do bloco de ações (`Monitorar`/`Ignorar` para observados; `Voltar a mostrar` para ignorados), empilhados em telas estreitas e lado a lado em telas largas, para não sobrepor texto e botão.

Rótulo exibido para um pacote segue sempre a prioridade:

```text
catalogLabelFor(packageName) ?? observed.label ?? packageName
```

catálogo local conhecido primeiro, depois a label fornecida pela notificação/Android, e `packageName` como último recurso — nunca duplicando o `packageName` como título e subtítulo quando existir label.

## 12. Regras de negócio

| ID | Regra |
|---|---|
| RN-01 | Todo o PlannerFin não dependente da captura funciona sem permissão. |
| RN-02 | Permissão, feature e pacote monitorado são três estados independentes. |
| RN-03 | App não selecionado tem conteúdo descartado antes de persistência/envio. |
| RN-04 | OTP/segredo detectado é descartado antes de persistência/sync. |
| RN-05 | Somente confirmação humana cria lançamento; parser nunca cria finanças. |
| RN-06 | Monitoramento e vínculo de conta são explícitos por owner/dispositivo. |
| RN-07 | Ingestão, confirmação e reprocessamento são idempotentes. |
| RN-08 | Dedup é explicável e não faz merge destrutivo. |
| RN-09 | Conteúdo usa HTTPS, minimização, TTL e exclusão; nunca publicidade/analytics. |
| RN-10 | `QUERY_ALL_PACKAGES` e credencial persistente ficam proibidos sem nova aprovação. |

## 13. Modelo conceitual

Nenhum nome autoriza schema nesta unidade.

| Entidade | Campos/regras conceituais |
|---|---|
| `NotificationDevice` | owner, deviceId opaco, nome, binding/status, lastSeenAt, revokedAt; owner isolation. |
| `NotificationCapturePreference` | owner, deviceId, `captureEnabled`, `monitoredPackages[]`, conta padrão opcional por pacote, timestamps; permissão Android é consultada localmente, não presumida pelo servidor. |
| `ObservedPackage` | owner/device, packageName, label opcional, lastSeenAt; sem conteúdo; TTL 30 dias. |
| `CapturedNotification` | owner, deviceId, packageName, appLabel opcional, notificationKeyHash/fingerprint/version, postedAt/receivedAt/capturedAt, title/text e bigText/subText somente quando necessários, channel/category allowlisted, classificação atual, parserVersion, timestamps/TTL; sem payload Android completo. |
| `NotificationClassification` | capturedId, parser/rules versionados, classe financeira ou não, parsedAmount como decimal/string, parsedType, parsedDescription, qualidade/confiança apenas explicável, razões, processedAt; histórico de reprocessamento. |
| `NotificationCandidate` | capturedId único, status de revisão, edits, paymentSourceType/accountId/cardId/categoryId opcionais até confirmar, transactionId ou cardPurchaseId opcional após confirmação, dismissedAt/confirmedAt. |
| `NotificationParserRule` | packageName, versão, padrões determinísticos e status; regras aprendidas não integram V1. |
| `TransactionSourceLink` | owner, transactionId, sourceKind extensível, sourceId/fingerprint; unicidade/idempotência e suporte a múltiplas evidências sem enum rígido no lançamento. |

Dinheiro segue `Decimal(19,2)`/string e nunca float. Instantes técnicos são UTC; a data financeira é escolhida/revisada conforme contratos existentes. `confidence` não é probabilidade opaca: se usado, deriva de checks nomeados e exibíveis.

## 14. Contratos de API futuros

Todos usam HTTPS, `Cache-Control: no-store`, validação/limites/rate limit, owner derivado da autenticação e resposta sem eco desnecessário. SPA mutável mantém CSRF/Origin da SPEC-002/012. Ingestão nativa/background **não recebe exceção improvisada**: contrato de device binding/credencial é dependência de validação e, se exigir auth nova, outra SPEC/ADR.

| Intenção | Contrato conceitual | Idempotência/erros principais |
|---|---|---|
| Preferências | Consultar/alterar `captureEnabled`, pacotes e conta padrão por device | versão otimista; `404` alheio, `409` versão, `422` pacote/conta inválidos |
| Dispositivos | listar, nomear, vincular/desvincular | vínculo único; revogado retorna `401/403`; owner nunca vem do body |
| Ingestão | lote limitado de envelopes minimizados + device + chave | unique de identidade e `Idempotency-Key`; `409` payload divergente, `413/422/429` |
| Caixa | listar detalhe próprio e original permitido | cursor estável; `404` cross-owner; `no-store` |
| Reclassificar | solicitar parser vigente para item/histórico elegível | não duplica candidato/lançamento; versão explícita |
| Revisar/descartar | editar candidato, marcar não financeiro ou `DISMISSED` | concorrência otimista e resultado repetível |
| Confirmar | candidato + fonte de pagamento compatível + categoria + campos revisados + chave | transação atômica, vínculo de origem único para `FinancialTransaction` ou `CardPurchase`, dedup revalidado; `409` conflito |
| Excluir/purge | item, pacote ou histórico; job por TTL | repetível; bruto some, linhagem mínima confirmada permanece |

## 15. Validações e permissões

| Ação/campo | Validação/negação |
|---|---|
| Ativar acesso | Somente gesto após disclosure; cancelamento mantém desligado. |
| Monitorar pacote | packageName válido do catálogo/observado, escolha explícita e device próprio. |
| Ingerir | sessão/binding válido, device próprio, pacote monitorado no instante capturado, tamanho/campos allowlisted. |
| Conteúdo | filtro de segredo antes da fila; limites e sanitização; HTML nunca executado. |
| Confirmar | candidato próprio pendente, fonte de pagamento/categoria próprias ativas e compatíveis (`INCOME` → conta; `EXPENSE` → conta ou cartão), decimal/data/tipo/parcelas válidos e dedup revisto. |
| Excluir/desvincular | recurso próprio; cross-owner responde como inexistente. |

## 16. Segurança, privacidade, Google Play e disclosure

Finalidade única: preparar candidatos financeiros revisáveis. Proibidos venda, publicidade, profiling oculto, finalidade secundária e compartilhamento não indispensável. Privacy Policy e Data Safety devem descrever coleta, transmissão ao servidor, retenção, segurança, exclusão e terceiros efetivos. A API aplica isolamento por owner em toda consulta/mutação; conteúdo não tem URL pública.

### Divulgação em destaque conceitual obrigatória

> **Captura por notificações**
>
> Se você ativar esta função, o PlannerFin poderá ler o título e o texto das notificações dos aplicativos que você escolher para identificar possíveis compras, recebimentos, pagamentos e outras movimentações. O conteúdo selecionado poderá ser enviado por conexão segura ao servidor do PlannerFin para classificação e revisão. Notificações de apps não escolhidos não são armazenadas nem enviadas. Nada vira lançamento automaticamente: você sempre revisa e confirma. Você pode desligar a captura, remover um app e apagar o histórico em **Mais → Captura por notificações**. Consulte a **Política de Privacidade** para saber quais dados são tratados, por quanto tempo e como solicitar exclusão.

O link real para Privacy Policy deve estar visível no disclosure. O texto final pode receber revisão jurídica/policy sem ficar vago nem reduzir esses fatos. Consentimento vem depois dessa divulgação e antes de Settings. Aprovação da Play Store não é prometida.

## 17. Erros, estados vazios e observabilidade

| Situação | Resultado/recuperação |
|---|---|
| Plataforma não Android | Feature indisponível com explicação; restante funciona. |
| Sem permissão/apps/candidatos | CTA manual, gerenciamento ou estado vazio, respectivamente. |
| Listener/fila/API falha | Nenhuma finança criada; retry controlado quando sessão válida; restante funciona. |
| Fila cheia/expirada | Purge oldest/TTL e métrica agregada, sem conteúdo em log. |
| Parser falha | `UNCLASSIFIED/AMBIGUOUS`, revisável; sem crash do app. |
| Sessão/device inválido | sync interrompido, fila purgada conforme regra e novo login/vínculo. |

Métricas permitidas: contagens agregadas de callbacks descartados, capturas, classes, fila/TTL, erros por código e latência, sem texto, título, valor, descrição, OTP ou conteúdo. PackageName só aparece em diagnóstico local opt-in sanitizado quando indispensável. Alertas cobrem falha de purge, pico de rejeição, isolamento e ingestão indevida; evidências usam dados fictícios.

## 18. Migração, compatibilidade e rollback

Esta unidade não cria migration. A implementação será aditiva e gradual, desligada por padrão/feature flag Android. Clientes antigos e web/iOS ignoram a feature. Não editar migrations aplicadas.

Rollback: desligar ingestão/flag, interromper serviço/sync, preservar ou purgar dados conforme solicitação/TTL e reverter o commit futuro. Lançamentos já confirmados permanecem como lançamentos normais com linhagem; nunca são apagados em massa por rollback. Migration futura precisa de plano próprio reversível e revisão humana se destrutiva.

## 19. Critérios de aceite (Given/When/Then)

| ID | Dado | Quando | Então |
|---|---|---|---|
| CA-01 | usuário sem permissão | abre login/dashboard/contas/categorias/lançamentos/transferências/recorrências/modelos/orçamento/importação/configurações | tudo funciona sem prompt/bloqueio |
| CA-02 | onboarding ou login | usuário conclui fluxo | acesso a notificações não é solicitado |
| CA-03 | feature nunca acionada | app abre | nenhum prompt de listener aparece |
| CA-04 | acesso desativado | usuário abre a feature | status Desativado, disclosure e CTA manual aparecem |
| CA-05 | disclosure visível | usuário toca Ativar acesso | somente então Settings oficial abre |
| CA-06 | Settings aberto | usuário recusa/volta | feature permanece desligada e restante funciona |
| CA-07 | Settings aberto | usuário concede | ao retornar/resumir, status real muda para Ativo |
| CA-08 | permissão concedida | `captureEnabled=false` | callbacks não são persistidos |
| CA-09 | captura ativa | usuário revoga no Android | captura para e UI muda para Desativado no resume |
| CA-10 | permissão revogada | app abre normalmente | Settings não reabre automaticamente |
| CA-11 | permissão revogada | usuário toca Ativar novamente | disclosure/Settings seguem fluxo explícito |
| CA-12 | permissão concedida | usuário desativa no PlannerFin | permissão continua externa, mas novas capturas param |
| CA-13 | pacote não selecionado | callback contém texto de WhatsApp/Gmail/Instagram | conteúdo é descartado antes de fila/backend/log |
| CA-14 | pacote não selecionado observado | callback chega | no máximo packageName/label/lastSeenAt são guardados, sem conteúdo |
| CA-15 | pacote no catálogo | usuário não o seleciona | catálogo não ativa monitoramento |
| CA-16 | pacote selecionado | notificação comum chega | envelope minimizado é capturado uma vez |
| CA-17 | pacote é desligado | nova notificação chega | ela não é persistida |
| CA-18 | pacote é desligado | usuário preserva histórico | histórico segue TTL e pode ser apagado depois |
| CA-19 | pacote é desligado | usuário escolhe apagar histórico | bruto/candidatos elegíveis são removidos imediatamente |
| CA-20 | notificação de marketing selecionada | parser determinístico processa | estado é NON_FINANCIAL, sem lançamento |
| CA-21 | notificação de compra | parser reconhece valor/tipo | candidato revisável é criado, sem lançamento |
| CA-22 | notificação de PIX recebido | parser reconhece entrada | candidato INCOME revisável é sugerido |
| CA-23 | notificação de transferência | parser reconhece padrão | item exige revisão e não cria transferência automática |
| CA-24 | dados conflitantes | parser processa | estado AMBIGUOUS e razões explicáveis aparecem |
| CA-25 | alerta contém OTP/segredo detectável | callback é filtrado | conteúdo é descartado antes de persistência/sync |
| CA-26 | alerta de login/dispositivo novo | filtro processa | não vira candidato financeiro e conteúdo sensível é descartado |
| CA-27 | usuário offline | pacote monitorado notifica | item filtrado entra em fila criptografada limitada, sem finança |
| CA-28 | fila tem mais de 7 dias | purge executa | item expira sem sync tardio |
| CA-29 | fila atinge 500 itens/10 MiB | novo item chega | mais antigo é purgado e só métrica agregada registra perda |
| CA-30 | processo da SPA morreu | listener recebe callback conforme Android | filtro/fila funcionam sem token nem criação financeira |
| CA-31 | dispositivo reinicia | Android restabelece serviço conforme validação local | nenhuma sincronização ocorre sem sessão válida |
| CA-32 | fila existe | sessão válida do mesmo owner volta | sync HTTPS idempotente pode iniciar |
| CA-33 | fila existe | usuário faz logout | sync para e fila não sincronizada é purgada |
| CA-34 | usuário A sai | usuário B entra | B não vê, herda nem sincroniza captura de A |
| CA-35 | device desvinculado | tenta ingerir | servidor rejeita e novas sincronizações cessam |
| CA-36 | mesma notificação é reenviada | identidade coincide | existe um único CapturedNotification |
| CA-37 | mesma chave traz payload divergente | ingestão repete | servidor retorna conflito e não sobrescreve silenciosamente |
| CA-38 | dois devices recebem evento semelhante | classificação ocorre | possível duplicado cross-device é sinalizado, não autoapagado |
| CA-39 | parser v1 classificou item | parser v2 reprocessa | versão muda sem duplicar candidato/lançamento |
| CA-40 | parser desconhece padrão | item é processado | permanece revisável UNCLASSIFIED/AMBIGUOUS |
| CA-41 | candidato aberto | usuário revisa | original permitido e interpretação aparecem lado a lado |
| CA-42 | candidato sem fonte padrão | usuário tenta confirmar | confirmação bloqueia até escolher fonte própria ativa compatível com o tipo |
| CA-43 | candidato válido | usuário edita tipo/valor/descrição/fonte/categoria e confirma | exatamente um destino financeiro é criado e vinculado: `FinancialTransaction` para conta ou `CardPurchase` para cartão |
| CA-44 | confirmação perde resposta | usuário repete mesma chave/payload | recebe mesmo resultado sem segundo lançamento |
| CA-45 | candidato pendente | usuário descarta | vira DISMISSED e não cria lançamento |
| CA-46 | candidato | usuário marca não financeira | vira NON_FINANCIAL sem efeito financeiro |
| CA-47 | bruto não financeiro tem 30 dias | purge executa | conteúdo é removido |
| CA-48 | candidato pendente tem 90 dias | purge executa | conteúdo/candidato expira sem lançamento |
| CA-49 | confirmado completa 30 dias | purge executa | bruto é apagado e só linhagem mínima permanece |
| CA-50 | usuário solicita exclusão imediata | operação conclui | conteúdo elegível some e não reaparece em reprocessamento |
| CA-51 | notificação já confirmou lançamento | OFX/CSV correspondente é importado | provável/forte correspondência é sinalizada antes do commit |
| CA-52 | correspondência notificação/import existe | usuário não aprovou vínculo | não há auto-merge, exclusão ou dupla criação silenciosa |
| CA-53 | disclosure é exibido | leitor de tela/foco/texto 200% são usados | conteúdo, controles e consequência continuam compreensíveis |
| CA-54 | estados Ativo/Desativado | interface renderiza | informação não depende só de cor |
| CA-55 | usuário toca Agora não/Back | feature fecha | escolha é respeitada e demais áreas seguem acessíveis |
| CA-56 | antes de Settings | disclosure aparece | informa leitura, apps escolhidos, finalidade, envio ao servidor, revisão, desligamento/exclusão e Privacy Policy |
| CA-57 | release/listing é preparado | equipe revisa política vigente | Privacy Policy, Data Safety, disclosure e permissões são consistentes; publicação não é presumida |
| CA-58 | API recebe owner/device alheio | operação é tentada | recurso é tratado como inexistente/rejeitado sem vazamento |
| CA-59 | logs/analytics são inspecionados | captura/revisão ocorre | não há conteúdo, valor, descrição, OTP ou dados financeiros |
| CA-60 | build não Android/web/iOS | rota/feature é avaliada | listener não é oferecido e restante do PlannerFin funciona |

## 20. Testes obrigatórios da implementação futura

| Nível | Cenários mínimos | Evidência |
|---|---|---|
| Unitário | filtro de pacote/OTP, estados, parsers versionados, fingerprint, TTL, dedup e normalização decimal | testes determinísticos com corpus fictício/sanitizado |
| Integração | serviço/fila/Keystore/reboot/logout; API/PostgreSQL owner/idempotência/purge/confirmação | testes Android instrumentados e API real controlada |
| Contrato | bridge, ingestão, preferências, review/confirm/delete, auth/CSRF/no-store | schemas/versionamento e casos 4xx/concorrência |
| E2E | consentimento, recusa/revogação, pacote selecionado/não selecionado, offline/sync e revisão | aparelho/emulador suportado, sem dado real |
| Aceitação manual | disclosure/Settings, background/processo morto/reboot, acessibilidade e Data Safety | matriz de Android/versão/aparelho e screenshots sanitizados |

Valores/datas são exatos, relógio controlado e dedup demonstra totais antes/depois. Lint, typecheck, unitários, integrações aplicáveis e build serão obrigatórios na implementação; nesta unidade documental são não aplicáveis porque nenhum código mudou.

## 21. Arquivos permitidos e proibidos nesta unidade

Permitidos: `docs/specs/SPEC-022-CAPTURA-NOTIFICACOES-ANDROID.md` e `docs/specs/README.md`.

Proibidos: todo código, manifest, Gradle, pacote/lockfile, schema/migration, endpoint, UI, plugin, ADR e demais documentos.

## 22. Dependências e investigações técnicas obrigatórias

| Dependência de validação | Prova exigida antes de implementar/lançar |
|---|---|
| `NotificationListenerService` | ciclo real do callback; manifest com service exportado conforme docs e `BIND_NOTIFICATION_LISTENER_SERVICE`; filtro antes de I/O |
| Estado/Settings | validar `NotificationManager.isNotificationListenerAccessGranted(ComponentName)` nas versões alvo e abrir `Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS` com fallback seguro |
| Background/reboot | medir processo morto, reconnect, reboot, OEM/bateria e duplicação, sem prometer entrega perfeita |
| Android suportado | definir min/target/compile vigentes, testar Android 13+ e matriz ainda suportada pelo app |
| Capacitor | provar bridge/plugin local mínimo, lifecycle, thread e ausência de plugin terceiro invasivo; dependência nova requer justificativa/aprovação |
| Package visibility | provar catálogo/queries direcionadas e descoberta sem conteúdo; confirmar ausência de `QUERY_ALL_PACKAGES` e policy vigente |
| Fila segura | Keystore, criptografia autenticada, limites/TTL, atomicidade, backup exclusion, purge/logout e threat model |
| Autenticação | provar owner/device binding e sync somente com sessão válida sem persistir token; se insuficiente, nova SPEC/ADR bloqueia implementação |
| OTP | corpus fictício, ordem do filtro, redação/descarte e avaliação documentada de falsos negativos; risco crítico bloqueia release |
| Google Play | revisar User Data, Sensitive Permissions/APIs, package visibility, disclosure, Privacy Policy, Data Safety e listing na submissão |

Esses itens não mudam o contrato já fechado: se a prova falhar, a implementação para e a SPEC/ADR é revisada; não se improvisa acesso amplo, auth ou redução de privacidade.

## 23. Riscos

| Risco | Probabilidade/impacto | Mitigação |
|---|---|---|
| OTP não detectado | Média/crítico | filtro antes de I/O, minimização, corpus, release bloqueada sem evidência |
| OEM mata serviço/perde evento | Alta/médio | tratar como assistência best-effort, lifecycle testado, nunca fonte contábil automática |
| Policy muda/rejeita app | Média/alto | revisão na publicação, disclosure/listing coerentes, feature flag; sem promessa de aprovação |
| Falso positivo/duplicidade | Alta/alto | parser explicável, revisão, idempotência e sem auto-merge |
| Cross-owner/device | Baixa/crítico | binding, filtros backend, constraints e testes negativos |
| Fila/backup expõe conteúdo | Média/crítico | Keystore, TTL/limite, backup excluído, purge e threat model |
| Retenção excessiva | Média/alto | TTL diferenciado, purge monitorado e exclusão imediata |

## 24. Dúvidas e decisões aprovadas

Não há dúvida funcional, de privacidade ou de produto aberta. As incertezas empíricas nativas são dependências de validação, não licença para escolher alternativa incompatível.

| Data | Decisão aprovada | Responsável | Consequência |
|---|---|---|---|
| 2026-08-13 | Feature Android opcional e integralmente não bloqueante | Solicitante | Sem permissão, todo o restante funciona |
| 2026-08-13 | Consentimento proeminente e escolha por pacote | Solicitante | App não escolhido é descartado antes de I/O |
| 2026-08-13 | V1 determinística, revisão humana e zero criação automática | Solicitante | IA/regras aprendidas ficam futuras |
| 2026-08-13 | Retenção 30/90/30 dias e fila 7 dias/500/10 MiB | Solicitante via autorização para fechar SPEC | Minimização verificável |
| 2026-08-13 | Catálogo + observação sem conteúdo; sem acesso amplo | Solicitante | `QUERY_ALL_PACKAGES` proibido na V1 |
| 2026-08-13 | Auth não será contornada | SPEC-002/012 e solicitante | Falha de binding exige nova decisão |
| 2026-08-22 | Parser genérico passa a reconhecer valor por contexto (`R$`, `valor de/valor:`, `compra ... de`) além de `R$ X,XX`, e a extrair `cardLast4` de "cartão terminado/finalizado em/final NNNN"; nenhum número solto (ex.: últimos 4 dígitos) é tratado como valor | Solicitante, após teste real via Telegram | Mantém o princípio determinístico/explicável/revisável; sem confirmação automática |
| 2026-08-22 | Data sugerida no formulário de revisão usa o timezone local do dispositivo/browser a partir do `postedAt` (UTC armazenado); servidor continua em UTC | Solicitante, após bug observado em aparelho físico | Nunca usar `.toISOString().slice(0,10)` para essa apresentação |

## 25. Definition of Done específica e histórico

- [x] Auditoria AS-IS separada do TO-BE.
- [x] Consentimento, não bloqueio, seleção, OTP, retenção, multi-device, API e disclosure fechados.
- [x] Pelo menos 40 critérios GWT verificáveis (60 definidos).
- [x] Dependências nativas/policy marcadas sem inventar conclusões.
- [x] Escopo documental e arquivos autorizados respeitados.
- [ ] Implementação/testes/aceitação em aparelho — não aplicável a esta unidade; obrigatórios na unidade futura.

| Data | Alteração | Motivo | Autor | Aprovador |
|---|---|---|---|---|
| 2026-08-13 | Criação e aprovação da SPEC-022 | Contrato documental solicitado | Equipe PlannerFin | Solicitante da tarefa |
| 2026-08-22 | Correções pós-teste real em aparelho físico: parser genérico ganha extração de valor por contexto e de `cardLast4`; sugestão automática de cartão na revisão quando há exatamente um cartão ativo com o mesmo last4 (nunca com múltiplos matches ou cartão arquivado); data sugerida passa a usar timezone local; correção de mojibake no rótulo "Cartões de crédito"/"•••• NNNN" na revisão; hierarquia dos botões da revisão (`Confirmar lançamento` primário full-width, ações secundárias abaixo) | Achados de teste real (Telegram + APK LAN) | Equipe PlannerFin | Solicitante da tarefa |
| 2026-08-22 | Revisão mínima da fonte de pagamento na revisão de notificações | Reconciliar SPEC-022 com o domínio de cartões da SPEC-008 | Codex | Tarefa atual do solicitante |
