# Auditoria da SPEC-013 contra a `main` atual

## 1. Resumo executivo

Esta auditoria confronta a SPEC-013, aprovada em 2026-08-11, com a `main` no commit `767e5d3a21f94286891e9c0ca14b39ecab53b629`, de 2026-08-23. O resultado não sustenta reaplicar integralmente a SPEC original: o shell mobile-first foi implementado, mas partes da UX continuam incompletas e algumas decisões foram legitimamente substituídas por evoluções posteriores.

Nos 32 critérios de aceite originais, a classificação aproximada é:

| Classificação | Quantidade | Leitura |
|---|---:|---|
| `IMPLEMENTADO` | 5 | Evidência suficiente no código e em testes atuais. |
| `PARCIAL` | 16 | Há implementação relevante, mas o critério completo não está garantido ou a cobertura é insuficiente. |
| `PENDENTE` | 1 | Não há comportamento equivalente suficiente na base atual. |
| `OBSOLETO` | 2 | Era uma restrição temporal da implementação original e foi superada por SPECs aprovadas posteriores. |
| `CONFLITO` | 4 | O texto antigo colide com comportamento posterior consolidado ou com a ação global atual. |
| `NÃO VERIFICÁVEL AUTOMATICAMENTE` | 4 | Depende de aparelho, WebView, teclado, orientação, zoom, leitor de tela ou evidência histórica não disponível. |

Conclusão executiva:

- O shell, os quatro destinos primários, a rota `Mais`, o estado ativo, a adaptação desktop e a base de safe areas estão prontos.
- Lançamentos têm lista compacta, filtros recolhíveis, formulário dedicado e feed unificado, mas a validação de campo/foco, o feedback de sucesso e o E2E mobile precisam ser atualizados e completados.
- O fluxo de despesa com `Pago com` é a decisão atual: conta envia para `/transactions`, cartão envia para `/card-purchases` e revela parcelas. Restaurar o contrato visual antigo da SPEC-013 causaria regressão.
- Orçamento, recorrências, transferências e dívidas ainda não aplicam de forma consistente o padrão mobile proposto pela SPEC-013.
- Offline global, foco preso/devolvido em todos os overlays e comprovação de zoom/contraste/leitor de tela permanecem lacunas reais.
- O comportamento físico Android não pode ser declarado conforme apenas por inspeção estática; o checklist de aparelho ainda registra teclado, scroll, orientação, safe area e Back como pendentes.

## 2. Estado geral da SPEC-013

### Base e método

- Base auditada: `main` sincronizada com `origin/main`, commit `767e5d3a21f94286891e9c0ca14b39ecab53b629`.
- Fonte primária: componentes Vue, router, CSS, integração Capacitor/Android e testes versionados.
- Fontes de decisão posteriores: SPEC-014, SPEC-016, SPEC-018, SPEC-019, SPEC-021 e SPEC-022, além do histórico da `main`.
- Verificação executada durante a auditoria: Playwright focado em shell, lançamentos e recorrências. Cinco cenários passaram; o cenário mobile de lançamentos falhou porque ainda procura o botão removido `Nova despesa`, enquanto a UI atual usa a ação global unificada. Isso é uma divergência do teste em relação ao produto atual, não evidência de que o fluxo unificado esteja ausente.
- Não houve alteração funcional, refatoração, dependência nova ou mudança em código de produto.

### Leitura global

A SPEC-013 teve pelo menos duas ondas explícitas de implementação na história da `main`: shell/dashboard e alinhamentos Android, seguidas por lançamentos/modelos. Depois disso, a base recebeu UX de lançamentos Fase B, personalização, setup, importação, fluxo de notificações e a unificação de despesa entre conta e cartão. Por isso, o estado atual deve ser lido como uma evolução da SPEC-013, não como uma aplicação literal isolada.

## 3. Matriz requisito × estado atual

| Requisito | Classificação | Evidência e leitura atual |
|---|---|---|
| CA-01 — primeira dobra do dashboard | `PARCIAL` | Período, posição, ações e resumo estão na estrutura `.first-fold` (`apps/web/src/pages/DashboardPage.vue:144`, `:187`, `:189`, `:213`, `:214`, `:236`). O Playwright cobre 360×800, mas apenas visibilidade, não o limite inferior de cada elemento; a oferta de setup e o atalho `Para revisar` podem deslocar o resumo (`DashboardPage.vue:131`, `:217`). |
| CA-02 — ação global sem scroll | `CONFLITO` | FAB fixo e safe area existem (`AuthenticatedShell.vue:99`, `:266-270`), porém Orçamento oculta explicitamente o FAB (`BudgetsPage.vue:801`) e há nota de validação anterior sobre sobreposição (`docs/research/UX-FOLLOWUPS-2026-08-20.md:11`). A decisão atual evita sobreposição, mas contradiz a exigência de FAB em todo destino primário. |
| CA-03 — quatro destinos principais | `IMPLEMENTADO` | `Início`, `Lançamentos`, `Orçamento` e `Mais` estão no array único do shell, com ícone, texto, alvo de 3,75 rem, forma/peso e `aria-current` (`AuthenticatedShell.vue:11-31`, `:109-117`, `:245-260`). Há teste unitário e E2E. |
| CA-04 — módulos secundários em Mais | `IMPLEMENTADO` | `Mais` alcança Contas, Categorias, Transferências, Recorrências, Cartões, Dívidas e Conta e incorporou Modelos, Importação, Captura por notificações e Privacidade (`MorePage.vue:7-35`, `:42-60`). `MorePage.test.ts:30-40` verifica as rotas. |
| CA-05 — títulos responsivos | `PARCIAL` | Há escala global responsiva para `h1/h2` (`apps/web/src/App.vue`) e layouts com quebra. Não existe varredura de todas as telas em 320–1440 nem zoom a 200%; páginas extensas continuam com estilos locais. |
| CA-06 — ausência de overflow horizontal | `PARCIAL` | Shell, lançamentos e recorrências têm asserts de `scrollWidth` em alguns viewports (`mobile-shell.spec.ts:51-67`, `:76-80`; `recurrences-templates.spec.ts:41-63`). Não há matriz completa para 320×568, 768×1024, overlays e todos os módulos. |
| CA-07 — cards compactos | `PARCIAL` | Lançamentos e cartões foram compactados, usam padding sem altura ornamental (`TransactionsPage.vue:751-770`; `CardsPage.vue:906-973`). Orçamento ainda tem achados manuais de cards grandes e layout espremido (`UX-FOLLOWUPS-2026-08-20.md:8-11`). |
| CA-08 — ações rápidas do dashboard | `CONFLITO` | `Transferir` abre `/transfers` em uma interação. O dashboard também mantém um botão `Novo lançamento` (`DashboardPage.vue:207-214`) ao mesmo tempo que o FAB global; a ação funciona, mas duplica a ação principal consolidada. A manutenção ou remoção desse atalho exige decisão de produto, não restauração cega do texto antigo. |
| CA-09 — formulário essencial de lançamento | `CONFLITO` | Ordem essencial, status e campos condicionais existem, mas a despesa atual usa `Pago com`: conta segue o lançamento canônico e cartão cria compra/fatura com parcelas (`TransactionFormPage.vue:216`, `:342-401`). A antiga expectativa uniforme de conta + Pendente/Pago não se aplica ao ramo cartão. |
| CA-10 — erro no contexto | `PARCIAL` | O formulário preserva o estado e anuncia erro geral com `role="alert"` (`TransactionFormPage.vue:325-326`), mas a validação é predominantemente no topo do formulário, sem erro associado a cada campo nem foco automático no resumo. Orçamento possui associação de erro de campo mais completa (`BudgetsPage.vue:307-353`). |
| CA-11 — CTA e teclado Android | `NÃO VERIFICÁVEL AUTOMATICAMENTE` | CTA sticky e padding de safe area existem (`TransactionFormPage.vue:566-569`), mas teclado real, portrait/landscape e último campo exigem WebView/aparelho. O checklist físico mantém esses itens pendentes (`docs/runbooks/ANDROID-DEVICE-ACCEPTANCE.md:45-49`). |
| CA-12 — envio em progresso e sucesso | `PARCIAL` | O CTA muda para `Salvando…` e fica desabilitado (`TransactionFormPage.vue:410`). Após sucesso há `router.replace('/transactions')`, mas não há mensagem de sucesso anunciada nem garantia automatizada de item atualizado uma única vez nesse fluxo. |
| CA-13 — Back com rascunho | `PARCIAL` | Voltar da interface e Android Back abrem confirmação quando `dirty`; overlays consomem Back antes da rota (`TransactionFormPage.vue:112-181`, `:483-491`; `mobile.ts:27-44`). Não existe guarda equivalente para toda navegação do browser e o fechamento prévio do teclado só pode ser validado fisicamente. |
| CA-14 — filtros recolhíveis | `IMPLEMENTADO` | Em `/transactions`, `filtersOpen` inicia falso, o painel usa `v-show` e o acionador expõe `aria-expanded` (`TransactionsPage.vue:39`, `:489-517`). |
| CA-15 — resultado rapidamente visível | `PARCIAL` | A lista/estado vazio vem logo após o resumo recolhido e o E2E verifica o estado vazio em 360×800, mas não mede se o primeiro item começa dentro da dobra. O próprio E2E está desatualizado depois desse ponto ao procurar `Nova despesa` (`transactions-mobile.spec.ts:39-46`). |
| CA-16 — filtros ativos e limpar | `PARCIAL` | Há rótulo `Filtros ativos` e `Limpar filtros` (`TransactionsPage.vue:489-515`), mas não há chips/resumo individual dos filtros, remoção individual, anúncio de atualização ou transferência de foco para resultados. |
| CA-17 — lista e ações de lançamento | `PARCIAL` | O feed `/financial-entries` agrupa Hoje/Futuros/Anteriores e mostra descrição, valor, data, estado e fonte do cartão (`TransactionsPage.vue:120-196`, `:533-574`). Pagar/Reabrir respeitam estado, mas ficam no menu kebab, não como ação contextual frequente visível; compras de cartão têm ações diferentes por desenho atual. |
| CA-18 — loading, vazio e erro | `PARCIAL` | Dashboard, lançamentos, orçamento, cartões, dívidas e transferências distinguem estados e vários oferecem `Tentar novamente`. O padrão não é uniforme: alguns loadings não têm `role="status"`/`aria-live`, e nem todo módulo possui recuperação equivalente. |
| CA-19 — offline explícito | `PENDENTE` | Não há banner/estado offline global nem diferenciação confiável entre offline e falha da API. O cliente permanece online-first e sem fila financeira, mas rascunho/retry após reconexão não está garantido. A matriz da SPEC-012 também mantém offline real pendente (`SPEC-012-CA-MATRIX.md:65-67`). |
| CA-20 — safe area e scroll final | `PARCIAL` | Shell, FAB, bottom nav e alguns modais usam `env(safe-area-inset-*)` e reservam scroll final (`AuthenticatedShell.vue:226-241`, `:266-292`; `TransactionsPage.vue:864-885`). Não há teste em quatro bordas/todos os módulos, e Orçamento precisou ocultar o FAB. |
| CA-21 — portrait e landscape | `NÃO VERIFICÁVEL AUTOMATICAMENTE` | O Manifest não bloqueia orientação e declara `configChanges` (`AndroidManifest.xml:14-16`), mas preservação de campo, filtro, scroll e foco em rotação exige aparelho/WebView. |
| CA-22 — mesma capacidade web mobile/desktop | `PARCIAL` | A mesma SPA e as mesmas rotas atendem ambos; o desktop troca bottom nav por header (`AuthenticatedShell.vue:82-117`, `:186-220`). O E2E cobre shell e recorrências nos dois tamanhos, não todos os fluxos e módulos. |
| CA-23 — acessibilidade básica | `PARCIAL` | Há labels persistentes, `aria-current`, `role="dialog"`, estados textuais, foco visível e menus rotulados. Porém os overlays não implementam foco preso de forma completa, `KebabMenu` não move/devolve foco nem implementa navegação por setas (`KebabMenu.vue:19-65`), e não existe axe/TalkBack completo. O foco amarelo claro tem contraste calculado de aproximadamente 2,15:1 contra branco, abaixo de 3:1. |
| CA-24 — texto ampliado a 200% | `NÃO VERIFICÁVEL AUTOMATICAMENTE` | CSS usa grids responsivos e `overflow-wrap` em vários pontos, mas não há evidência automatizada ou manual atual que percorra as telas prioritárias a 200%. |
| CA-25 — rotas existentes | `IMPLEMENTADO` | As rotas originais continuam declaradas no router e renderizam dentro de `AuthenticatedShell` (`router.ts:27-52`; `App.vue:1-13`). Novas rotas foram adicionadas sem remover as antigas. |
| CA-26 — Android Back na raiz | `PARCIAL` | `mobile.ts:27-44` volta no histórico fora da raiz e chama `exitApp()` em `/` ou `/dashboard`; `mobile.test.ts` cobre ambos. O botão físico e a interação com teclado/WebView permanecem pendentes no runbook. |
| CA-27 — consistência dos domínios secundários | `PARCIAL` | Há evolução de cards, estados, retries e responsividade, mas os padrões divergem: Recorrências mantém formulário antes da lista; Transferências e Dívidas expõem filtros/formulários longos; criação/edição alterna entre inline e modal (`RecurrencesPage.vue:299-413`; `TransfersPage.vue:299-368`; `DebtsPage.vue:278-377`). |
| CA-28 — recorrências descobríveis | `CONFLITO` | Recorrências aparece em `Mais/Planejamento`, mas ainda exibe `Nova recorrência` antes da lista (`RecurrencesPage.vue:299-413`). A proibição de “modelo/template” foi substituída pela SPEC-014, que aprovou `Usar modelo...` no rascunho de recorrência (`docs/specs/SPEC-014-MODELOS-DE-LANCAMENTO-E-INTEGRACAO-COM-RECORRENCIAS.md:166-190`). |
| CA-29 — valores canônicos do dashboard | `IMPLEMENTADO` | O componente apenas formata e apresenta o `DashboardResponse`; preserva `null`, realizado/planejado/comprometido e os blocos canônicos (`DashboardPage.vue:187-352`). Testes cobrem total, parcialidade, ausência e contador de revisão. |
| CA-30 — nenhuma mudança financeira/estrutural | `OBSOLETO` | Era um gate do diff da implementação da SPEC-013. A `main` posterior ganhou endpoints, DTOs e migrations aprovados pelas SPECs 014–023; usar este critério como restrição permanente bloquearia evoluções legítimas. Continua válido apenas como evidência histórica do escopo daquela implementação. |
| CA-31 — extensão futura não exposta | `OBSOLETO` | A vedação a modelos expirou quando a SPEC-014 foi aprovada e implementada. `Usar modelo...` agora é comportamento esperado; terceiro, parceiro e reembolso continuam ausentes. |
| CA-32 — dados/evidências seguros | `NÃO VERIFICÁVEL AUTOMATICAMENTE` | Os testes versionados usam dados sintéticos, mas não há como provar por inspeção da árvore que todos os screenshots, vídeos e logs históricos externos foram sanitizados. |

## 4. Evidências por área

### Shell e navegação principal

O shell autenticado é uma implementação reconhecível da SPEC-013:

- `App.vue` separa páginas públicas do `AuthenticatedShell`.
- O shell usa os mesmos quatro destinos no header desktop e na bottom navigation mobile.
- O item ativo possui `aria-current`, fundo, cor e peso; o estado não depende só de cor.
- O mobile reserva espaço para bottom nav + FAB + inset inferior, e o desktop usa header superior.
- O seletor curto Receita/Despesa é um diálogo/bottom sheet responsivo e consome Escape/Android Back.
- A ação global também fica ativa em módulos secundários associados a `Mais`, não apenas nos quatro destinos.

Lacunas do shell:

- O diálogo global recebe foco no contêiner, mas não prende Tab dentro dele.
- O botão global é duplicado por um segundo `Novo lançamento` no Dashboard.
- Orçamento oculta o FAB e, durante edição, a bottom navigation; isso resolve uma sobreposição observada, mas rompe a regra original de persistência.
- O desktop mantém a marca `PlannerFin` junto ao título de cada página; não há problema funcional, mas a redundância de cabeçalho não foi validada sistematicamente.

### Dashboard / Home

Pronto:

- mês civil em pt-BR, anterior/próximo, seletor e retorno ao mês atual;
- posição atual com distinção de nenhuma conta, `null` e saldo disponível;
- resumo realizado versus planejado/comprometido;
- Transferir em uma interação;
- acesso condicional a `Para revisar` quando `pendingNotificationReviews > 0`;
- loading, erro com retry e estados vazios dos blocos secundários.

Parcial:

- o teste de primeira dobra não mede bounding boxes; apenas verifica visibilidade no documento;
- a oferta de setup pode aparecer antes do período, e `Para revisar` entra antes do resumo;
- o botão local `Novo lançamento` repete o FAB global;
- listas abaixo da dobra ainda são texto corrido em alguns blocos, com pouca semântica de item/estado.

### Transações e fluxo unificado

O comportamento atual consolidado está implementado e deve prevalecer:

1. o FAB escolhe Receita ou Despesa e navega para `/transactions/new?type=...`;
2. no formulário, despesa mostra `Pago com`;
3. conta envia `POST /transactions`;
4. cartão envia `POST /card-purchases`;
5. parcelas aparecem apenas no ramo cartão;
6. `/transactions` lê o feed unificado `/financial-entries` e diferencia lançamentos de conta e compras de cartão;
7. compra de cartão abre `/cards/:id`, enquanto lançamento de conta mantém edição/pagamento/reabertura.

Esse fluxo está coberto por testes unitários (`TransactionFormPage.test.ts`, `TransactionsPage.test.ts:651-735`). O E2E mobile existente, porém, ainda procura `Nova despesa` e falha antes de exercitar o fluxo atual (`transactions-mobile.spec.ts:46`). A correção desse teste deve ocorrer em unidade separada porque esta auditoria não autoriza mudança funcional nem de teste.

Pendências reais de lançamentos:

- associar erros de validação a campos e mover/anunciar foco;
- anunciar sucesso após criação e provar ausência de duplicidade no retorno;
- substituir o resumo genérico `Filtros ativos` por identificação dos filtros aplicados e garantir anúncio/foco;
- revisar se Pagar deve continuar apenas no kebab ou ser a ação frequente visível prevista na SPEC;
- validar teclado, rotação, safe areas e perda de rascunho em aparelho.

### Orçamentos

Há uma implementação mobile específica relevante: navegação mensal, estado vazio compacto, resumo em grid responsivo, progresso semântico, erros de campo e categorias em linhas responsivas. Ainda assim, a pesquisa Android já registrou formulário pesado, layout espremido, limites/cards grandes, possível sobreposição do FAB e erro `Dados inválidos` (`docs/research/UX-FOLLOWUPS-2026-08-20.md`). A CSS atual esconde o FAB na página inteira e a bottom nav durante edição.

Classificação da área: `PARCIAL`. A adequação mobile e a falha de salvamento são pendências reais a investigar em nova unidade, sem presumir causa monetária.

### Área Mais

Classificação da área: `IMPLEMENTADO` para descoberta e roteamento. A organização original foi preservada e ampliada:

- Movimentação: Contas, Categorias, Transferências, Modelos, Importação e Captura por notificações;
- Planejamento: Recorrências;
- Crédito e compromissos: Cartões e Dívidas;
- Sobre: Política de Privacidade;
- Conta: Perfil/conta e Sair.

A entrada de notificações inclui descrição curta e o Dashboard oferece `Para revisar` quando aplicável. A taxonomia de Modelos em Movimentação, em vez de Planejamento, é uma escolha atual não coberta pela SPEC-013 e pode ser revista por produto, mas não impede acesso.

### Cartões e faturas

Classificação da área: `PARCIAL`.

- Cartões, compras/parcelas futuras e faturas compartilham `/cards` e `/cards/:id`.
- Cards e compras usam resumo compacto e `KebabMenu`; faturas expõem composição, pagamento e estados.
- A criação unificada de despesa por cartão já existe no formulário de lançamento.
- A página de cartões ainda oferece `Nova compra` contextual. Isso pode ser um atalho deliberado, mas cria dois pontos de entrada para a mesma intenção e precisa de decisão antes de qualquer consolidação.
- Não há E2E atual que percorra criação unificada, detalhe da compra, fatura e retorno em viewport estreito.

### Dívidas

Classificação da área: `PARCIAL`.

- Descoberta por `Mais`, rotas de lista/detalhe, saldo devedor, próxima parcela, estados e retry estão implementados.
- A criação pode expandir um formulário muito longo com até centenas de parcelas antes da lista; filtros ficam sempre expostos.
- O detalhe é responsivo por CSS, mas ações, edição e pagamento ainda variam de padrão em relação a lançamentos/cartões.
- A usabilidade de cronogramas grandes no mobile não tem teste de viewport/overflow.

### Recorrências

Classificação da área: `CONFLITO` no requisito antigo de modelos e `PENDENTE` na ordem lista/formulário.

- É descobrível em `Mais/Planejamento`.
- Ações canônicas de editar, pausar, retomar, gerar e arquivar existem.
- A SPEC-014 tornou legítimo aplicar modelo em recorrência de lançamento; essa parte não deve ser removida.
- O formulário de nova recorrência continua permanentemente antes de `Suas recorrências`, contrariando a parte ainda válida da SPEC-013.
- O E2E de recorrências passou em 360×800 e 1440×900, inclusive sem overflow, mas ele valida aplicação de modelo, não a prioridade da lista.

### Transferências

Classificação da área: `PARCIAL`.

- Descoberta por Dashboard, Contas/links contextuais e `Mais` está implementada.
- Origem e destino impedem visualmente escolher a mesma conta; lista mostra origem → destino, valor, data e estado.
- Criação/edição usa modal com scroll interno e safe areas.
- Oito controles de filtro ficam sempre visíveis antes da lista; falta o padrão recolhível/resumo ativo.
- O modal longo e o teclado não têm validação em aparelho.

### Acessibilidade

Evidências positivas:

- controles nativos, labels persistentes e `inputmode` monetário;
- `aria-current`, `aria-expanded`, `aria-modal`, `aria-labelledby`, `role="meter"` e nomes nos ícones de ação;
- estados Pago/Pendente/Vencido e cartão têm texto, não apenas cor;
- alvos principais usam 2,75 rem/44 px;
- foco global visível e tokens de tema claro/escuro;
- pares principais medidos na auditoria atendem contraste textual: texto/claro 16,65:1, muted/branco 7,58:1, accent/branco 5,41:1, texto/escuro 18:1.

Pendências:

- o foco claro `#f59e0b` contra branco mede aproximadamente 2,15:1;
- menus `role="menu"` não implementam setas, foco inicial/devolução ou fechamento com retorno ao acionador;
- vários diálogos declaram modalidade, mas não prendem foco;
- a lista de lançamentos trunca o título com ellipsis em uma linha (`TransactionsPage.vue:790-798`), sem alternativa explícita no card;
- não há execução axe, leitor de tela, teclado integral ou zoom 200% registrada para a `main` atual.

### Android / Capacitor

Evidência estática:

- uma única SPA é empacotada pelo Capacitor (`capacitor.config.ts` aponta `webDir: 'dist'`);
- viewport usa `width=device-width, initial-scale=1` (`apps/web/index.html`);
- Manifest não fixa orientação e declara mudanças de teclado/orientação (`AndroidManifest.xml:14-16`);
- Activity é um `BridgeActivity` com WebView e plugins locais de cookies/notificações;
- Back fecha overlays quando consumido, volta no router fora da raiz e sai na raiz (`mobile.ts:27-44`);
- safe areas são tratadas no shell e em alguns formulários/modais.

Limites:

- não há `windowSoftInputMode` explícito no Manifest; o efeito do teclado depende do comportamento efetivo do Capacitor/WebView;
- safe area em quatro bordas, status/navigation bars, teclado, rotação, foco e Back físico não são inferíveis com segurança do CSS;
- o runbook de aparelho mantém esses gates pendentes, portanto não se declara conformidade física nesta auditoria.

## 5. Conflitos com decisões posteriores

### Fluxo de despesa conta/cartão

O requisito antigo que tratava toda despesa como lançamento com conta e estado Pendente/Pago conflita com a decisão consolidada na `main` pelo commit `25a5f26` e pelo código atual. O caminho correto é:

- conta → `/transactions`;
- cartão → `/card-purchases`;
- parcelas somente no cartão;
- compra aparece no feed unificado e remete ao cartão/fatura.

Não se deve restaurar conta obrigatória, campos de pagamento de conta no ramo cartão ou botões separados permanentes de receita/despesa.

### Modelos de lançamento

CA-31 e a parte de CA-28 que proibiam modelos eram temporárias. A SPEC-014 aprovou modelos como defaults independentes, aplicáveis a rascunhos de lançamento e recorrência, sem vínculo persistente com o fato financeiro. Remover `Usar modelo...` seria regressão.

### Captura e revisão de notificações Android

A SPEC-022 adicionou `Captura por notificações`, `/notifications`, `/notifications/inbox`, revisão humana e o contador `Para revisar` no Dashboard. Esses destinos devem permanecer integrados a `Mais` e ao Dashboard; a ausência deles na SPEC-013 original não os torna indevidos.

### Importação, setup e personalização

SPEC-018, SPEC-019 e SPEC-021 adicionaram preferências visuais, oferta de setup e importação com revisão. A oferta de setup pode afetar a primeira dobra, e Importação ampliou `Mais`; são evoluções deliberadas que precisam ser consideradas ao redefinir métricas da Home e a taxonomia de navegação.

### FAB e ações locais

A ação global unificada é a referência atual. A SPEC-013 também pedia ação local no Dashboard, e a página de cartões mantém `Nova compra`. Hoje existem redundâncias/atalhos contextuais. Não há decisão posterior única dizendo quais devem desaparecer; a consolidação exige decisão de produto e teste de descoberta antes de código.

## 6. Pendências reais

Prioridade sugerida, sem autorizar implementação:

1. **P0 — atualizar o contrato de teste do fluxo unificado:** o E2E mobile de lançamentos está desatualizado e não alcança o caminho atual via FAB.
2. **P0 — investigar Orçamento em mobile:** reproduzir layout espremido, sobreposição e `Dados inválidos`; separar problema visual de validação monetária/API.
3. **P1 — concluir padrão de Recorrências:** lista antes do formulário e criação em superfície dedicada, preservando a integração legítima com modelos.
4. **P1 — tornar filtros secundários progressivos:** Transferências e Dívidas ainda colocam blocos extensos antes da lista; Lançamentos precisa identificar filtros ativos e gerenciar foco/anúncio.
5. **P1 — fechar lacunas de formulário de lançamento:** erros por campo, foco no erro, anúncio de sucesso, teste de duplo envio e navegação/rascunho.
6. **P1 — acessibilidade de overlays/menus:** foco preso e devolvido, teclado completo, semântica de menu coerente e correção do contraste do foco claro.
7. **P1 — offline explícito:** distinguir indisponibilidade de rede de erro genérico e oferecer retry sem prometer fila financeira.
8. **P2 — revisar formulários longos de Dívidas e Transferências:** dedicated page versus modal/inline, alcance do CTA, listas grandes e teclado.
9. **P2 — ampliar matriz responsiva:** 320×568, 360×800, 390×844, 768×1024 e 1440×900 para todas as páginas/overlays prioritários.

## 7. Itens não verificáveis automaticamente

- teclado Android em portrait e landscape, incluindo último campo, erro e CTA;
- safe areas reais em quatro bordas, cutout, status bar e navigation bar;
- Back físico com teclado aberto, overlay, histórico e raiz;
- preservação de foco/scroll/rascunho após rotação do WebView;
- TalkBack/leitor de tela e ordem de anúncio;
- zoom/texto a 200% em todos os fluxos prioritários;
- contraste de conteúdo dinâmico definido pelo usuário, ícones/categorias e todos os estados; apenas pares estáticos principais foram medidos;
- conforto, descoberta e acionamento acidental em aparelho real;
- sanitização de evidências históricas que não estão versionadas no repositório.

Esses itens devem usar dados sintéticos e o checklist de `docs/runbooks/ANDROID-DEVICE-ACCEPTANCE.md`; não devem ser convertidos em `IMPLEMENTADO` por inspeção de CSS ou testes JSDOM.

## 8. Recomendação de próximo passo

Não implementar a SPEC-013 original como uma única unidade. Criar uma nova investigação/SPEC de convergência UX baseada nesta auditoria, com decisões explícitas para:

1. quais ações locais permanecem além do FAB global;
2. como Orçamento preserva a ação global sem sobreposição, ou se a exceção será formalizada;
3. superfície de criação/edição para Recorrências, Transferências e Dívidas;
4. contrato de filtros ativos e foco;
5. baseline automatizado de acessibilidade e matriz responsiva;
6. gate físico Android obrigatório.

### O que já está pronto

- shell autenticado responsivo;
- bottom navigation com quatro destinos e adaptação desktop;
- estado ativo acessível e rotas recarregáveis;
- FAB/seletor unificado e formulário dedicado de novo lançamento;
- feed unificado de conta/cartão;
- `Mais` ampliado para módulos atuais;
- Dashboard compacto com posição, período, resumo, Transferir e `Para revisar`;
- base de safe areas, Back e responsividade.

### O que ainda precisa ser implementado

- offline explícito;
- consistência mobile dos módulos secundários, sobretudo Orçamento e Recorrências;
- filtros progressivos em Transferências/Dívidas e resumo completo em Lançamentos;
- erros por campo, foco, sucesso anunciado e cobertura atual do fluxo de lançamento;
- foco preso/devolvido e teclado de menus/overlays;
- correção/validação do contraste de foco e matriz responsiva/a11y.

### O que não deve mais ser implementado

- proibição de modelos;
- formulário de despesa restrito a conta;
- estado Pendente/Pago aplicado a compra de cartão como se fosse lançamento de conta;
- ausência de captura/revisão de notificações e importação em `Mais`;
- restrição permanente de não alterar contratos criada apenas para o diff histórico da SPEC-013.

### O que precisa de decisão de produto antes de código

- manter ou remover o `Novo lançamento` local do Dashboard além do FAB;
- manter `Nova compra` em Cartões como atalho contextual ou convergir toda criação ao fluxo unificado;
- formalizar a ocultação do FAB/bottom nav em Orçamento ou redesenhar a superfície;
- posição de Modelos em Movimentação versus Planejamento;
- Pagar visível no card versus dentro de `Mais ações`;
- ordem da oferta de setup e do atalho `Para revisar` na primeira dobra.

## 9. Validações executadas

| Comando | Resultado |
|---|---|
| `pnpm lint` | Aprovado em todos os cinco projetos aplicáveis do workspace. |
| `pnpm typecheck` | Aprovado em config, shared, storage, API e web. |
| `pnpm --filter @planner-fin/web test -- src/AuthenticatedShell.test.ts src/DashboardPage.test.ts src/TransactionsPage.test.ts src/TransactionFormPage.test.ts src/BudgetsPage.test.ts src/MorePage.test.ts src/CardsPage.test.ts src/DebtsPage.test.ts src/RecurrencesPage.test.ts src/TransfersPage.test.ts src/mobile.test.ts` | Aprovado: 11 arquivos e 142 testes. Houve apenas warning do router sintético de `AuthenticatedShell.test.ts`, sem falha. |
| `pnpm build` | Aprovado para packages, API e web. |
| `pnpm --filter @planner-fin/web test:e2e e2e/mobile-shell.spec.ts e2e/transactions-mobile.spec.ts e2e/recurrences-templates.spec.ts` | Parcial: 5 aprovados e 1 falhou por timeout ao procurar o botão legado `Nova despesa` em `transactions-mobile.spec.ts:46`. O teste não alcançou o fluxo atual via FAB; não houve falha observada de domínio ou build. |

Não foram executados nesta auditoria: aparelho Android físico, teclado/rotação/safe areas reais, TalkBack, zoom 200%, axe completo, testes de integração de banco ou suíte E2E integral. Os testes de banco não são aplicáveis a esta alteração exclusivamente documental; as demais ausências permanecem riscos/evidências a tratar na próxima unidade.
