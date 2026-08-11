# SPEC de funcionalidade — `SPEC-013 — UX mobile-first e navegação principal`

> Esta unidade é exclusivamente documental. Ela especifica a futura implementação de UX, mas não a autoriza enquanto seu status não for **Aprovada**.

## 1. Identificação

| Campo | Valor |
|---|---|
| ID | `SPEC-013` |
| Título | UX mobile-first e navegação principal |
| Responsável | Equipe PlannerFin |
| Data de criação | 2026-08-11 |
| Última atualização | 2026-08-11 |
| Tarefa relacionada | `PROMPT-SPEC-013-UX-MOBILE-FIRST-CODEX-CLOUD.md` |
| Documentos relacionados | SPEC-003 a SPEC-012; ADR-001, ADR-002 e ADR-006; `docs/runbooks/ANDROID-DEVICE-ACCEPTANCE.md` |

## 2. Status

`Em revisão`

**Aprovada por:** pendente.

## 3. Contexto

A base atual compartilha Vue 3, Quasar e Capacitor entre Android e web responsiva, conforme a ADR-002. As funcionalidades financeiras de contas, categorias, lançamentos, transferências, recorrências, cartões, dívidas, orçamento e dashboard já possuem contratos canônicos nas SPEC-003 a SPEC-011. A SPEC-012 estabelece o empacotamento Android, safe areas, teclado, orientação, navegação Back e estado offline.

O uso real no emulador Android confirmou funcionamento técnico, inclusive a criação de lançamentos com valores inteiros, mas evidenciou uma interface derivada do desktop: títulos e cards altos, ações frequentes abaixo da primeira dobra, links textuais dispersos, filtros extensos e formulários longos. Esta SPEC reorganiza apenas apresentação, navegação e interação. Nenhuma fórmula, projeção, transição financeira, contrato de API ou semântica de domínio é redefinida.

Antes da criação deste documento, foi verificado que não existia arquivo, referência ou identificador conflitante `SPEC-013` no repositório.

## 4. Problema

Em smartphone, a densidade e a hierarquia atuais retardam tarefas recorrentes. No dashboard, o título e controles consomem espaço antes do saldo e as ações rápidas aparecem após vários cards. Em lançamentos, filtros antecedem a lista e a criação expõe muitos campos de uma vez. Os módulos repetem formulários e ações sem um shell de navegação mobile comum. Feedback em superfícies altas pode ficar fora do campo visual ou atrás do teclado.

O resultado é tecnicamente utilizável, porém insuficientemente rápido, claro e confortável para uso financeiro diário.

## 5. Objetivo

Definir uma experiência mobile-first única para Android e web responsiva que:

- exponha a criação de lançamento sem scroll nas telas autenticadas principais;
- torne saldo, período e resumo essencial do dashboard visíveis na primeira dobra de `360 × 800 CSS px`;
- estabeleça navegação primária curta e acesso previsível aos módulos secundários;
- compacte hierarquia, cards, estados vazios, formulários e filtros;
- preserve rotas, regras financeiras, API e arquitetura compartilhada existentes;
- seja verificável por testes automatizados e validação em Android real.

## 6. Fora do escopo

- Implementar qualquer componente, estilo ou rota nesta unidade documental.
- Modelos/templates de lançamento ou recorrência.
- “Pago por terceiro”, compartilhamento com parceiro, reembolso ou divisão de despesa.
- Importação de arquivo, IA ou OCR.
- Nova recorrência financeira ou mudança das regras da SPEC-007.
- Nova regra de orçamento, dívida, cartão, transferência, conta, categoria ou lançamento.
- Novo cálculo, projeção, arredondamento ou alteração da SPEC-011.
- Backend, endpoint, contrato de API, persistência ou migration.
- Segundo frontend, troca de Vue 3, Quasar ou Capacitor e identidade visual pixel-perfect.
- Deep links, sincronização ou fila offline.

## 7. Termos

| Termo | Definição adotada nesta SPEC |
|---|---|
| Mobile-first | Larguras de smartphone são a referência inicial de conteúdo e interação; desktop é adaptação da mesma base. |
| Primeira dobra | Região visível sem scroll após aplicação de safe areas, shell e navegação, medida em `360 × 800 CSS px`. |
| Ação global | Ação “Novo lançamento”, disponível independentemente do módulo primário atual. |
| Navegação primária | Quatro destinos persistentes: Início, Lançamentos, Orçamento e Mais. |
| Mais | Superfície secundária que agrupa módulos e conta sem promover todos à navegação principal. |
| CTA | Controle que conclui a tarefa principal da superfície. |
| Bottom sheet | Superfície temporária ancorada ao rodapé, adequada a escolhas ou ações curtas. |
| Página dedicada | Rota/superfície de tela inteira usada para tarefa longa, com navegação de retorno. |
| Filtro essencial | Controle de uso frequente exposto sem abrir filtros avançados. |
| Card compacto | Agrupamento que mostra informação ou ação essencial sem altura mínima ornamental. |
| Estado offline | Falta confirmada de conectividade/API; não implica suporte a gravação ou fila offline. |

## 8. Comportamento atual

- `App.vue` centraliza todas as páginas vertical e horizontalmente e aplica padding mínimo de 24 px, reduzindo a área útil no smartphone; não existe shell autenticado com navegação persistente.
- O dashboard mostra “Dashboard financeiro”, mês técnico e três botões textuais antes dos dados; ações rápidas são o último card de uma grade com oito cards.
- Títulos de página e de cards não têm escala responsiva comum. Cada página mantém estilos locais e densidades distintas.
- Lançamentos apresenta links textuais, dois botões de criação e seis filtros visíveis antes da lista; criação, edição e pagamento usam overlays/formulários extensos.
- Recorrências apresenta o formulário de criação antes da listagem. Outros módulos repetem cadastro, edição e listagem com padrões diferentes.
- Rotas autenticadas existentes são `/dashboard`, `/transactions`, `/accounts`, `/categories`, `/transfers`, `/recurrences`, `/cards`, `/cards/:id`, `/debts`, `/debts/:id`, `/budgets` e `/conta`.
- O manipulador Android usa histórico quando há rota anterior e encerra na raiz/dashboard, conforme SPEC-012.

## 9. Comportamento desejado

### 9.1 Princípios e shell responsivo

1. A mesma árvore Vue e os mesmos componentes funcionais atenderão Android e web; diferenças serão responsivas e de capacidade da plataforma, não outro frontend.
2. Toda tela autenticada usará um shell com cabeçalho compacto, conteúdo rolável independente e navegação persistente. Safe areas serão somadas apenas nas bordas realmente ocupadas, sem duplicar padding.
3. Em larguras até `767 CSS px`, o shell exibirá bottom navigation e a ação global. A partir de `768 CSS px`, poderá converter os mesmos destinos em rail/sidebar ou cabeçalho, mantendo rótulos, ordem, rotas e ação global.
4. Conteúdo não ficará sob bottom navigation, FAB, teclado, barra de sistema ou notch; haverá espaço final de scroll suficiente para o último controle.
5. Nenhuma tela terá overflow horizontal em `320–1440 CSS px`, exceto componentes de visualização cujo scroll horizontal seja explicitamente rotulado e testado; tabelas de domínio devem adaptar-se a lista/card no mobile.

### 9.2 Navegação principal

**Decisão:** combinar bottom navigation de quatro itens com ação global de lançamento e uma superfície “Mais”. Drawer não será o mecanismo primário no smartphone, pois esconde destinos frequentes e adiciona um passo. Tab bar será reservada a visões irmãs dentro de um módulo, não à navegação global.

| Ordem | Item mobile | Destino | Papel |
|---:|---|---|---|
| 1 | Início | `/dashboard` | posição e resumo financeiro |
| 2 | Lançamentos | `/transactions` | lista e operações de receita/despesa |
| 3 | Orçamento | `/budgets` | acompanhamento mensal frequente |
| 4 | Mais | menu/superfície secundária | módulos restantes e conta |

- Cada item combina ícone reconhecível e rótulo textual; ícone sozinho é proibido para destinos globais.
- O item ativo é indicado por mais de cor (forma/peso e estado semântico) e expõe `aria-current`.
- A ação global “Novo lançamento” será um FAB com rótulo acessível e ícone de adição no smartphone. Poderá ser botão rotulado no desktop. Ela permanecerá acima da navegação/safe area, não cobrirá conteúdo acionável e estará disponível sem scroll em Início, Lançamentos, Orçamento e Mais. Durante um formulário ou diálogo destrutivo já aberto, poderá ser ocultada para evitar ações concorrentes.
- Ao acionar “Novo lançamento”, a primeira escolha será Receita ou Despesa em uma superfície curta; após a escolha, abre-se o fluxo dedicado já com a natureza preenchida. Em `/transactions`, controles contextuais podem oferecer as mesmas escolhas, sem duplicar dois CTAs primários permanentes.
- “Mais” agrupa, nesta ordem: **Movimentação** (Contas, Categorias, Transferências), **Planejamento** (Recorrências), **Crédito e compromissos** (Cartões, Dívidas) e **Conta** (Perfil/conta e sair, quando aplicável). Orçamento continua acessível também em seu item primário.
- Transferir é ação rápida contextual no dashboard e em Contas. Recorrências é descoberta por “Mais”, por contexto de planejamento e por sugestão não intrusiva após lançamentos; não é chamada de “modelo”.
- As rotas atuais continuam válidas e recarregáveis. “Mais” pode ser overlay ou rota de shell, desde que Back, foco e link direto preservem comportamento; criar nova rota exigirá constar no plano da futura implementação, sem remover as atuais.

### 9.3 Hierarquia visual e densidade

| Elemento | Expectativa verificável |
|---|---|
| `h1` | Um por página, 1–2 linhas, escala responsiva aproximada de `1.375–1.75rem`, line-height até `1.25`; nunca usado como espaço ornamental. |
| `h2`/título de card | Escala aproximada de `1–1.25rem`, line-height até `1.35`; título e ação cabem em layout que quebra sem corte. |
| Texto/label | Corpo mínimo equivalente a `1rem` para campos e conteúdo; auxiliares podem usar `0.875rem`, com contraste suficiente. |
| Dinheiro principal | Maior peso visual que o rótulo, com sinal/estado nunca comunicado somente por cor; quebra controlada para valores longos. |
| Espaçamento | Base de 4/8 px; margens verticais usuais de 8–16 px no mobile; 24 px somente para separar grupos maiores. |
| Ações | Uma primária por contexto; secundárias com menor ênfase; destrutivas rotuladas e confirmadas quando a SPEC canônica exigir. |
| Estados | Badge/ícone mais texto (“Pendente”, “Pago”, “Vencido”, “Arquivada”); cor é redundante. |

- Alvos de toque terão pelo menos `44 × 44 CSS px`, com separação que evite acionamento acidental.
- Cabeçalhos não repetirão nome do produto, breadcrumb e título quando um deles não adiciona contexto.
- Texto ampliado a 200% deve refluir sem corte, sobreposição ou perda de ação.

### 9.4 Cards, listas e estados vazios

- Cards simples não terão altura fixa/min-height ornamental. Padding mobile será de 12–16 px e conteúdo essencial ficará no início.
- Listas financeiras priorizam descrição, valor, vencimento e estado. Conta/categoria/notas aparecem como metadado secundário ou no detalhe, sem transformar cada item em formulário.
- A ação mais frequente pode ficar visível; demais ações ficam em menu rotulado “Mais ações”, acessível por teclado e leitor de tela.
- Um estado vazio ocupa somente o necessário para título curto, explicação de uma frase e no máximo um CTA primário e um link secundário. Ilustração, se houver, não empurra o CTA para fora da primeira dobra em `360 × 800`.
- Skeleton/loading preserva aproximadamente a geometria do conteúdo e anuncia carregamento uma vez, sem bloquear navegação global.

### 9.5 Dashboard e primeira dobra

No carregamento autenticado em `360 × 800 CSS px`, após safe areas e shell, a primeira dobra contém obrigatoriamente:

1. mês civil em linguagem local (por exemplo, “Agosto de 2026”) e controles anterior/próximo compactos, com ação para retornar ao mês atual quando necessário;
2. rótulo e valor/indisponibilidade explícita da posição atual, preservando `null`, parcialidade e mensagens da SPEC-011;
3. ação global “Novo lançamento” acessível;
4. ação rápida “Transferir”;
5. resumo essencial do mês com Receitas, Despesas e Resultado, distinguindo realizado de planejado/comprometido sem recomputar dados.

O título genérico “Dashboard financeiro” não compete com o período: pode ser removido visualmente ou virar rótulo acessível discreto. A ordem obrigatória é período → posição → ações → resumo. O resumo pode usar alternância claramente rotulada entre realizado e planejado/comprometido, mas não ocultar a distinção sem indicação.

Abaixo da primeira dobra, nesta prioridade: próximos lançamentos/vencimentos, orçamento, faturas, dívidas, despesas por categoria e detalhes adicionais do fluxo. Seções sem ocorrências usam estado compacto. Contadores, limites, ordenação, fórmulas, indisponibilidades e cenário consolidado continuam exatamente os da SPEC-011. Reordenar ou resumir não autoriza omitir informação canônica do dashboard completo.

### 9.6 Lançamentos

#### Listagem e acesso rápido

- Cabeçalho compacto contém título, resumo de filtros ativos e acesso aos filtros; a lista ou seu skeleton começa na primeira dobra.
- Cada item mostra descrição, valor principal coerente com o estado, natureza, vencimento/pagamento e badge. “Pagar” é ação contextual visível para pendente; editar, reabrir e demais ações seguem elegibilidade da SPEC-005.
- Pagamento abre superfície curta com valor realizado e data já preenchidos conforme comportamento canônico permitido, ambos editáveis antes da confirmação. Reabrir exige feedback de sucesso/erro no item ou superfície originária.
- Paginação/carregar mais preserva posição de scroll e filtros.

#### Novo lançamento

O fluxo será página dedicada no smartphone, por ser uma tarefa com campos condicionais e potencial teclado. Desktop pode usar diálogo amplo somente se cumprir os mesmos requisitos de foco, scroll, erro e URL/retorno. Bottom sheet será usado apenas para escolhas curtas (natureza, ações ou seletores), nunca para o formulário integral.

Ordem e agrupamento:

1. escolha Receita/Despesa, já preenchida quando originada por atalho;
2. essenciais visíveis: valor previsto, descrição, vencimento, conta e categoria compatível;
3. estado Pendente/Pago; ao escolher Pago, revelar valor realizado e data do pagamento;
4. “Mais detalhes” recolhível: notas e campos opcionais existentes;
5. CTA “Salvar lançamento” e ação cancelar/voltar.

- Alternar natureza limpa somente valores incompatíveis exigidos pela SPEC-005 e informa a mudança; demais valores digitados são preservados.
- Erros de campo aparecem junto ao campo e o resumo de submissão, quando necessário, recebe foco/é anunciado. Erro da API fica no formulário, mantém todos os valores e oferece nova tentativa.
- Durante envio, o CTA apresenta progresso, fica protegido contra duplicidade e a navegação não fecha silenciosamente a tela.
- O CTA será sticky dentro da área útil quando isso não encobrir campo; com teclado aberto, deve permanecer alcançável por scroll e nunca ficar permanentemente atrás do teclado.
- Cancelar/Back com alterações não salvas pede confirmação; sem alterações, retorna à origem. Sucesso retorna à lista/origem, anuncia confirmação e exibe o lançamento atualizado.
- A interface não chama o cadastro de “administrativo” nem expõe identificadores técnicos.
- A área entre natureza e campos essenciais reserva um ponto de extensão opcional para futura ação “Usar modelo…”. Ela não aparece na implementação desta SPEC e sua ausência não deixa espaço vazio.

### 9.7 Padrão de formulários

| Superfície | Quando usar | Requisitos |
|---|---|---|
| Bottom sheet | escolha ou ação curta, sem mais de um pequeno grupo de controles | foco preso, título, fechar/Back, não depender de teclado longo |
| Modal/diálogo | confirmação, edição curta ou ação atômica no desktop | conteúdo cabe/rola internamente; feedback e CTA permanecem encontráveis |
| Página dedicada | criação/edição com campos condicionais, mais de um grupo ou teclado prolongado | título compacto, retorno, progresso, CTA alcançável e preservação de estado |

- Campos essenciais precedem opcionais; relacionados compartilham seção e legenda.
- Labels são persistentes, não apenas placeholder. Tipo de teclado e `inputmode` correspondem ao dado; dinheiro aceita o formato aprovado pela SPEC-005 sem mudar precisão.
- Foco inicial não abre o teclado automaticamente ao entrar, salvo ação explícita que justifique isso.
- O próximo campo e a ação do teclado seguem ordem lógica. Em landscape, o conteúdo rola para manter campo focado e erro visíveis.
- Campos desabilitados explicam o motivo quando não for óbvio; read-only e disabled não são usados como sinônimos.

### 9.8 Padrão de filtros

- Apenas período/mês ou busca, quando realmente essencial ao módulo, pode permanecer inline.
- Demais filtros ficam em painel avançado recolhível fechado por padrão. Fechado, ele não reserva altura além do botão/linha de resumo.
- Filtros ativos aparecem como chips removíveis ou resumo textual com quantidade; sempre existe “Limpar filtros” quando algum está ativo.
- Abrir/fechar não aplica nem perde valores. “Aplicar” atualiza a lista, fecha o painel no smartphone, move o foco para o resumo de resultados e mantém chips visíveis.
- Limpar atualiza resultados e comunica a remoção. Zero resultados distingue lista vazia de filtro sem correspondência.
- Em `/transactions`, Estado e período de vencimento são os candidatos essenciais; conta, categoria, natureza e intervalos adicionais ficam avançados. A implementação pode validar por pesquisa qual dos dois essenciais merece inline, mas não pode exibir o formulário completo antes da lista.

### 9.9 Estados e feedback

| Situação | Comportamento obrigatório | Recuperação |
|---|---|---|
| Loading inicial | skeleton ou indicador próximo ao conteúdo, `aria-live` sem anúncios repetidos | navegação continua disponível |
| Vazio | mensagem específica e compacta | CTA para criar/configurar quando autorizado |
| Erro de leitura | mensagem no módulo sem substituir o shell | “Tentar novamente” preserva rota/filtros |
| Offline | banner persistente e não intrusivo; gravações indisponíveis ou falham claramente | tentar novamente ao reconectar; sem fila |
| Sucesso | confirmação anunciada e associada à operação | conteúdo atualizado sem duplicidade |
| Ação em progresso | controle indica verbo no gerúndio e bloqueia repetição | não apagar dados digitados |
| Desabilitado | aparência, semântica nativa e motivo contextual | orientar pré-condição quando possível |

Feedback não pode existir apenas em toast que desaparece enquanto teclado/modal o encobre. Erros críticos permanecem até ação do usuário. Dados e evidências devem ser sintéticos/sanitizados.

### 9.10 Contas, categorias e transferências

- Contas e categorias usam lista compacta com estado Ativa/Arquivada, criação em página dedicada quando o formulário exceder edição curta, edição acessível pelo item e arquivar/reativar somente conforme SPEC-003/SPEC-004.
- Arquivadas ficam ocultas por padrão com filtro explícito; histórico continua legível. Empty state diferencia ausência total de ausência no filtro.
- Conta mostra saldo/indisponibilidade sem converter `null` em zero. Categoria mostra natureza, nome, cor/ícone acessíveis e estado.
- Transferência é acessível por ação rápida do dashboard, contexto de Contas e “Mais”. Criação prioriza valor, origem, destino e data; impede visualmente escolher mesma conta sem substituir validação de domínio. Listagem mostra origem → destino, valor, data e ações canônicas.
- Os três módulos compartilham posições de título, criar, menu de ações, confirmação, erro e estados vazios, sem alterar sua semântica.

### 9.11 Recorrências

- A lista precede o formulário. O CTA “Nova recorrência” abre página dedicada; formulário não ocupa permanentemente a primeira dobra.
- Recorrências aparecem em “Mais” sob Planejamento e podem ser sugeridas contextualmente, sem serem chamadas de modelos.
- Itens mostram descrição, frequência, próxima ocorrência, estado/atenção e valor. Pausar, retomar, gerar, editar e arquivar obedecem integralmente à SPEC-007.

### 9.12 Cartões, dívidas e orçamento

- Cartões agrupam cartão e fatura com estado e vencimento legíveis; detalhe preserva compra, fechamento, pagamento e projeções da SPEC-008.
- Dívidas priorizam credor, saldo devedor canônico, próxima parcela e estado; detalhe explica principal/custos sem mudar reconhecimento econômico da SPEC-009.
- Orçamento, como destino primário, abre no mês atual com total, realizado, comprometido e restante; categorias são progressivamente detalhadas e mantêm fórmulas da SPEC-010.
- Esses módulos usam o padrão comum de cabeçalho, lista/card compacto, filtros recolhíveis, ações e estados; nenhuma apresentação calcula valores no cliente fora dos contratos canônicos.

### 9.13 Acessibilidade e adaptação

- Contraste de texto e controles atende WCAG 2.2 AA: `4.5:1` para texto normal, `3:1` para texto grande e componentes/estados essenciais.
- Ordem de foco acompanha ordem visual; foco visível não é removido. Overlays prendem foco e o devolvem ao acionador.
- Controles têm nome, papel, estado e associação de erro; valores não dependem de posição ou cor. Ícones decorativos são ignorados por leitores de tela.
- Bottom navigation, FAB e menus são operáveis por teclado na web. Headings preservam ordem sem saltos usados apenas por estilo.
- A interface suporta zoom/texto a 200%, portrait e landscape. Mudança de orientação preserva rota, valores digitados, filtros e scroll razoável.
- A orientação não é bloqueada. Safe areas são verificadas em quatro bordas. Android Back fecha primeiro teclado/overlay, depois retorna na pilha; na raiz segue a SPEC-012.

### 9.14 Evoluções futuras sem implementação

O fluxo de lançamento admite futuramente “Usar modelo…” antes dos campos essenciais. Uma SPEC separada poderá definir um modelo como `Aluguel`, capaz de sugerir natureza, categoria, descrição, notas padrão, valor previsto, conta padrão opcional e dia de vencimento. Toda ocorrência continuará editável; conta será substituível e o layout distinguirá valor previsto (por exemplo, `R$ 1.800`) de realizado (`R$ 1.923`) sem sobrescrever ou rotular um como erro.

O desenho também não deve tornar conta pagadora visualmente inseparável da despesa, para não bloquear futura análise de pagamento por terceiro. Entretanto, parceiro, terceiro, reembolso e consequências financeiras não terão campo, texto operacional ou regra nesta SPEC.

## 10. Personas ou atores

| Ator | Necessidade | Ações autorizadas |
|---|---|---|
| Usuário autenticado | consultar posição e registrar operações rapidamente no celular | mesmas ações autorizadas pelas SPEC-003 a SPEC-011 sobre recursos próprios |
| Usuário de web responsiva | executar os mesmos fluxos com teclado/mouse e área maior | mesmas ações, sem funcionalidade exclusiva de desktop |
| Leitor de tela/tecnologia assistiva | compreender navegação, estado, valor e feedback | operar todos os controles não visuais equivalentes |

## 11. Fluxos

### 11.1 Fluxo principal

1. Usuário autenticado abre `/dashboard` e vê mês, posição, ações e resumo essencial.
2. Aciona “Novo lançamento” sem rolar.
3. Escolhe Receita ou Despesa.
4. Preenche essenciais; revela campos de pagamento somente se escolher Pago.
5. Salva; durante a requisição o CTA impede repetição.
6. Recebe confirmação acessível e retorna ao contexto com dados atualizados.
7. Usa bottom navigation para Início, Lançamentos, Orçamento ou Mais.

### 11.2 Fluxos alternativos e exceções

- API indisponível/offline → manter shell e dados digitados, informar estado e oferecer nova tentativa; não enfileirar gravação.
- Validação local/API → focar/anunciar o erro contextual e preservar todos os campos.
- Back com formulário alterado → confirmar descarte; sem alteração → retornar diretamente.
- Back com bottom sheet/modal → fechar a superfície antes de navegar.
- Filtros sem resultado → mostrar resumo ativo, estado específico e “Limpar filtros”.
- Posição indisponível/parcial → exibir texto canônico da SPEC-011, nunca `R$ 0,00` inventado.
- Rotação/teclado → recompor layout sem perder estado e permitir scroll até CTA.

## 12. Regras de negócio

| ID | Regra | Origem/decisão | Exemplo |
|---|---|---|---|
| `RN-01` | Esta SPEC muda somente UX/apresentação; regras canônicas prevalecem. | SPEC-003 a SPEC-012 | saldo `null` continua indisponível |
| `RN-02` | Novo lançamento fica acessível sem scroll nas superfícies primárias. | decisão SPEC-013 | FAB acima da bottom nav |
| `RN-03` | Navegação mobile tem quatro destinos; módulos restantes ficam em Mais/contexto. | decisão SPEC-013 | Cartões em Mais |
| `RN-04` | Uma superfície tem apenas uma ação primária por contexto. | decisão SPEC-013 | Salvar é primária no formulário |
| `RN-05` | Formulário longo usa página dedicada no smartphone. | decisão SPEC-013 | criar lançamento |
| `RN-06` | Filtros avançados iniciam recolhidos e não reservam altura. | decisão SPEC-013 | conta/categoria fechados |
| `RN-07` | Offline não cria fila nem promessa de sincronização. | SPEC-012 | tentar novamente |
| `RN-08` | Nenhum valor monetário é recalculado ou reclassificado por esta UX. | SPEC-003 a SPEC-011 | dashboard consome snapshot |
| `RN-09` | Modelos e pagamento por terceiro são somente pontos de evolução futura. | escopo SPEC-013 | nenhum campo novo |

## 13. Modelo de dados

**Não aplicável.** Esta SPEC não cria nem altera entidade, atributo, relacionamento, persistência ou migration. Estado efêmero de UI (overlay, filtro, foco e rascunho não persistido) não é modelo financeiro.

## 14. Contratos de API

**Não aplicável.** A futura implementação deve reutilizar sem alteração os endpoints, DTOs, erros, autenticação, autorização e idempotência das SPEC-003 a SPEC-012. Necessidade de endpoint novo exige outra SPEC/revisão aprovada.

## 15. Interface

A interface é definida nas seções 9.1 a 9.14. Protótipos pixel-perfect não são requisito desta unidade. A futura implementação deve produzir evidências em `360 × 800`, web mobile, web desktop, Android portrait/landscape, teclado aberto e safe areas, sempre com dados sintéticos.

## 16. Validações

| Campo ou ação | Validação | Mensagem/resultado esperado |
|---|---|---|
| Novo lançamento | regras integrais da SPEC-005 | erro junto ao campo e anúncio contextual |
| Pagar/reabrir | transições integrais da SPEC-005 | apenas ação elegível; falha preserva contexto |
| Conta/categoria/transferência | SPEC-003/004/006 | feedback sem alterar semântica |
| Filtros | combinações da API existente | chips/resumo correspondem ao aplicado |
| Sair com rascunho | detectar alteração local | confirmação de descarte |
| Envio repetido | ação já em progresso | CTA desabilitado e indicação “Salvando…” |

## 17. Permissões

| Ação | Ator autorizado | Condição | Comportamento quando negado |
|---|---|---|---|
| Navegar e consultar | usuário autenticado | sessão válida | fluxo de autenticação existente |
| Criar/editar/operar | usuário autenticado | ownership e regra da SPEC canônica | erro indistinguível/seguro da API, sem revelar recurso alheio |
| Ver ação contextual | usuário autenticado | estado permite a transição | ocultar/desabilitar com explicação sem substituir autorização backend |

## 18. Segurança e privacidade

- Dados sensíveis ou pessoais envolvidos: descrições, notas, contas, valores, dívidas e demais dados financeiros já existentes.
- Ameaças relevantes: vazamento em screenshot/log, ação duplicada, exposição de recurso alheio e confiança indevida em autorização visual.
- Proteções exigidas: autorização permanece no backend; feedback não inclui payload sensível; envio bloqueia repetição; sessão segue SPEC-002/SPEC-012.
- Dados proibidos em logs/evidências: tokens, cookies, credenciais, nomes/valores reais, payload financeiro pessoal e identificadores reutilizáveis.

## 19. Erros e estados vazios

Aplicam-se os contratos da seção 9.9. Erro de página não remove navegação; erro de formulário permanece dentro da tarefa; vazio sem cadastro oferece ação; vazio filtrado oferece limpar; offline é distinguível de ausência de dados e não promete sincronização.

## 20. Observabilidade

Não são exigidos analytics, serviço pago ou telemetria nova. Logs técnicos existentes podem registrar rota, tipo genérico de falha e correlação já aprovada, nunca conteúdo financeiro, campo digitado, token ou screenshot. Evidências de teste devem ser sanitizadas.

## 21. Migração e compatibilidade

- Dados existentes: inalterados.
- Compatibilidade retroativa: todas as rotas autenticadas e links diretos existentes continuam válidos.
- Migração necessária: não; migration é proibida.
- Implantação gradual: a futura implementação pode ser dividida em incrementos de shell, dashboard e módulos somente se cada incremento mantiver navegação funcional e tiver rastreabilidade à SPEC-013; não haverá dois frontends.
- Rollback visual não transforma dados nem exige compensação financeira.

## 22. Critérios de aceite

### `CA-01 — Primeira dobra do dashboard`
**Dado** usuário autenticado em viewport `360 × 800` com safe areas simuladas<br>
**Quando** `/dashboard` conclui o loading<br>
**Então** mês, posição atual (ou indisponibilidade), Novo lançamento, Transferir e resumo de receitas/despesas/resultado têm conteúdo ou controle iniciado na primeira dobra, sem scroll.

### `CA-02 — Ação global sem scroll`
**Dado** qualquer destino primário em viewport mobile<br>
**Quando** a tela abre no topo<br>
**Então** “Novo lançamento” está acionável sem scroll, não cobre outro controle e respeita safe area.

### `CA-03 — Navegação principal`
**Dado** shell mobile autenticado<br>
**Quando** a navegação é inspecionada<br>
**Então** há exatamente Início, Lançamentos, Orçamento e Mais, cada um com ícone, texto, alvo mínimo `44 × 44` e estado ativo não dependente apenas de cor.

### `CA-04 — Módulos secundários`
**Dado** usuário em Mais<br>
**Quando** consulta os grupos<br>
**Então** encontra Contas, Categorias, Transferências, Recorrências, Cartões, Dívidas e Conta nos grupos definidos, e alcança cada rota existente.

### `CA-05 — Títulos responsivos`
**Dado** viewport entre 320 e 1440 px ou texto ampliado a 200%<br>
**Quando** qualquer tela autenticada é renderizada<br>
**Então** `h1/h2` refluem sem corte, sobreposição ou overflow e nenhum título sozinho consome mais de 25% da altura útil de `360 × 800`.

### `CA-06 — Sem overflow horizontal`
**Dado** viewports `320 × 568`, `360 × 800`, `768 × 1024` e `1440 × 900`<br>
**Quando** páginas e overlays são percorridos<br>
**Então** `document.scrollingElement.scrollWidth <= clientWidth`, exceto visualização explicitamente rotulada e contida.

### `CA-07 — Cards compactos`
**Dado** card com título, até três valores e uma ação<br>
**Quando** renderizado em `360 × 800`<br>
**Então** não tem altura fixa ornamental, usa padding de 12–16 px e seu conteúdo/ação não exige scroll interno.

### `CA-08 — Ações rápidas do dashboard`
**Dado** dashboard carregado<br>
**Quando** usuário aciona Novo lançamento ou Transferir<br>
**Então** chega ao fluxo correspondente em uma interação, com retorno preservado ao dashboard.

### `CA-09 — Formulário essencial de lançamento`
**Dado** início de novo lançamento<br>
**Quando** natureza é escolhida<br>
**Então** valor previsto, descrição, vencimento, conta e categoria aparecem antes de campos opcionais, e campos de pago só aparecem ao selecionar Pago.

### `CA-10 — Erro no contexto`
**Dado** submissão inválida ou resposta de erro da API<br>
**Quando** salvar falha<br>
**Então** erro é anunciado e exibido junto ao campo ou formulário, todos os valores permanecem e o usuário pode corrigir/tentar novamente.

### `CA-11 — CTA e teclado Android`
**Dado** formulário de lançamento no Android com teclado aberto em portrait e landscape<br>
**Quando** o último campo recebe foco<br>
**Então** campo, erro e CTA podem ser alcançados por scroll, não ficam permanentemente ocultos e não há salto que perca o valor digitado.

### `CA-12 — Envio em progresso e sucesso`
**Dado** lançamento válido<br>
**Quando** Salvar é acionado<br>
**Então** o CTA indica progresso e impede duplo envio; após sucesso, feedback é anunciado e o lançamento aparece uma única vez no contexto atualizado.

### `CA-13 — Back com rascunho`
**Dado** formulário com ou sem alteração<br>
**Quando** Android Back ou voltar da interface é acionado<br>
**Então** pede descarte apenas se houver alteração; caso contrário retorna; overlay/teclado é fechado antes da navegação, conforme a pilha.

### `CA-14 — Filtros recolhíveis`
**Dado** lista de lançamentos sem filtros ativos<br>
**Quando** abre<br>
**Então** filtros avançados estão fechados e não reservam altura além de seu acionador/resumo.

### `CA-15 — Resultado rapidamente visível`
**Dado** `/transactions` em `360 × 800`<br>
**Quando** loading termina<br>
**Então** pelo menos o início do primeiro item ou do estado vazio aparece na primeira dobra.

### `CA-16 — Filtros ativos e limpar`
**Dado** filtros aplicados<br>
**Quando** painel fecha<br>
**Então** chips/resumo identificam os filtros, cada removível atualiza resultados e “Limpar filtros” remove todos e anuncia a atualização.

### `CA-17 — Lista e ações de lançamento`
**Dado** lançamentos pendente e pago<br>
**Quando** a lista renderiza<br>
**Então** descrição, valor, vencimento/pagamento e estado são legíveis; Pagar aparece somente no pendente e Reabrir somente no pago, conforme SPEC-005.

### `CA-18 — Estados loading, vazio e erro`
**Dado** respostas lenta, vazia e falha em cada módulo principal<br>
**Quando** cada condição ocorre<br>
**Então** há estado distinto, anunciado, compacto e com recuperação aplicável, sem remover o shell.

### `CA-19 — Offline`
**Dado** perda de conectividade no Android ou web<br>
**Quando** leitura/gravação é tentada<br>
**Então** estado offline é explícito, nova tentativa é possível, rascunho é preservado e nenhuma fila/sincronização futura é prometida.

### `CA-20 — Safe area e scroll final`
**Dado** insets em qualquer borda e bottom navigation/FAB visíveis<br>
**Quando** usuário rola ao fim de qualquer página<br>
**Então** primeiro e último controles ficam totalmente visíveis e acionáveis sem serem cobertos.

### `CA-21 — Portrait e landscape`
**Dado** formulário ou lista com estado preenchido<br>
**Quando** orientação alterna entre portrait e landscape<br>
**Então** rota, campos, filtros e item focal são preservados, com reflow e sem overflow horizontal.

### `CA-22 — Web mobile e desktop`
**Dado** mesma build em `390 × 844` e `1440 × 900`<br>
**Quando** os fluxos principais são executados<br>
**Então** têm as mesmas capacidades/rotas; desktop adapta navegação e largura sem esticar cards de leitura nem criar funcionalidade exclusiva.

### `CA-23 — Acessibilidade básica`
**Dado** axe (ou equivalente gratuito), teclado e leitor de tela em smoke manual<br>
**Quando** dashboard, navegação, filtros e formulário são testados<br>
**Então** não há violação crítica/séria automatizada; foco é visível e lógico; labels, erros, estados e nomes acessíveis são anunciados; contraste atende AA.

### `CA-24 — Texto ampliado`
**Dado** zoom/texto a 200% em largura mobile<br>
**Quando** telas prioritárias são percorridas<br>
**Então** conteúdo reflui sem perda, corte, sobreposição ou controle inacessível.

### `CA-25 — Rotas existentes`
**Dado** cada URL autenticada listada na seção 8<br>
**Quando** é aberta diretamente e recarregada<br>
**Então** resolve para o módulo correto dentro do novo shell, preservando autenticação e links internos.

### `CA-26 — Android Back na raiz`
**Dado** dashboard sem overlay/teclado e sem rota anterior útil<br>
**Quando** Android Back é acionado<br>
**Então** segue a política de saída da SPEC-012; fora da raiz retorna no histórico antes de sair.

### `CA-27 — Domínios secundários consistentes`
**Dado** Contas, Categorias, Transferências, Recorrências, Cartões e Dívidas<br>
**Quando** listas, criação/edição e estados são comparados<br>
**Então** usam cabeçalho, criar, ações, feedback e empty state comuns, preservando ações e elegibilidade das SPECs canônicas.

### `CA-28 — Recorrências descobríveis`
**Dado** usuário autenticado<br>
**Quando** abre Mais/Planejamento<br>
**Então** encontra Recorrências com descrição de finalidade, sem menção a modelo/template e sem formulário antes da lista.

### `CA-29 — Valores canônicos do dashboard`
**Dado** snapshots total, parcial, `null` e consolidado da SPEC-011<br>
**Quando** o dashboard compacto renderiza<br>
**Então** valores, distinções realizado/planejado e mensagens permanecem semanticamente idênticos, sem cálculo/reclassificação no cliente.

### `CA-30 — Nenhuma mudança financeira ou estrutural`
**Dado** diff completo da futura implementação<br>
**Quando** revisado<br>
**Então** não há alteração em fórmulas, DTOs, endpoints, schema, migrations ou regras financeiras; eventual necessidade interrompe o trabalho para nova decisão.

### `CA-31 — Extensão futura não exposta`
**Dado** implementação da SPEC-013 sem SPEC de modelos aprovada<br>
**Quando** novo lançamento é aberto<br>
**Então** nenhum modelo, terceiro, parceiro ou reembolso é exibido/persistido, e inserir futuramente “Usar modelo…” não exige reordenar os campos essenciais.

### `CA-32 — Dados e evidências seguros`
**Dado** screenshots, vídeos, relatórios e logs de teste<br>
**Quando** anexados à validação<br>
**Então** contêm somente dados sintéticos/sanitizados e nenhum token, credencial ou dado financeiro pessoal.

## 23. Testes obrigatórios

| Nível | Cenários mínimos | Critérios relacionados | Evidência esperada |
|---|---|---|---|
| Unitário/componente | shell, ordem/visibilidade, FAB, estados, filtros, formulário condicional, preservação após erro, Back em overlays | CA-02–CA-04, CA-09–CA-18, CA-25–CA-31 | relatório Vitest com dados sintéticos |
| Integração frontend | roteador, auth, API existente, loading/erro/offline e submissão sem duplicidade | CA-12, CA-18, CA-19, CA-25, CA-29 | relatório automatizado; mocks/ambiente gratuito |
| Contrato | não criar contrato novo; executar regressão dos contratos existentes | CA-29, CA-30 | suíte existente aprovada |
| E2E Playwright mobile | `360 × 800` e `390 × 844`: primeira dobra, navegação, criar/pagar/reabrir, filtros, overflow, zoom quando suportado | CA-01–CA-18, CA-24–CA-25 | trace e screenshots sanitizados |
| E2E Playwright desktop | `1440 × 900`: rotas, navegação adaptada, teclado, formulários e regressão | CA-06, CA-22, CA-23, CA-25 | relatório e screenshots sanitizados |
| Android emulador | teclado, portrait/landscape, safe area simulada/real, Back, offline e scroll final | CA-02, CA-11, CA-13, CA-19–CA-21, CA-26 | checklist, vídeo/screenshot sanitizado e versão do emulador |
| Android aparelho físico | smoke completo do dashboard e lançamento; teclado, notch/safe area, rotação, Back e offline | CA-01–CA-02, CA-08–CA-13, CA-19–CA-21, CA-26 | matriz assinada, modelo/Android e evidência sanitizada |
| Acessibilidade | axe gratuito, teclado web, TalkBack smoke, foco, labels, contraste e texto 200% | CA-03, CA-05, CA-23–CA-24 | relatório sem violações críticas/sérias e checklist manual |
| Regressão | lint, typecheck, unitários, integrações aplicáveis, E2E, build web e Android | todos | comandos e resultados no PR |

Nenhuma validação dependerá de serviço pago. Falha em aparelho físico, acessibilidade, lint, typecheck, testes ou builds obrigatórios bloqueia conclusão/merge da futura implementação.

## 24. Arquivos permitidos

Para **esta unidade documental**:

- `docs/specs/SPEC-013-UX-MOBILE-FIRST-E-NAVEGACAO-PRINCIPAL.md`
- `docs/specs/README.md`

Para a **futura implementação**, após aprovação e em outra branch/PR:

- `apps/web/src/**`
- testes/configurações frontend e Android estritamente necessários dentro de `apps/web/**`
- documentação/evidências sanitizadas diretamente relacionadas à SPEC-013

## 25. Arquivos proibidos

Nesta unidade documental:

- `apps/**`, `packages/**`, schema/migrations, dependências e arquivos de runtime/build.

Na futura implementação, salvo revisão aprovada da SPEC:

- `apps/api/**`
- schema Prisma e `**/migrations/**`
- contratos/regras financeiras em `packages/shared/**`
- SPEC-003 a SPEC-012 e ADRs aprovadas
- lockfile e manifests para adicionar dependências

## 26. Dependências

| Dependência | Motivo | Estado da aprovação | Impacto |
|---|---|---|---|
| Vue 3 + Quasar + Capacitor existentes | base única Android/web | aprovada pela ADR-002 | preservar |
| SPEC-003 a SPEC-011 | semântica financeira canônica | aprovadas/concluídas conforme documentos | não alterar |
| SPEC-012 | lifecycle, teclado, safe area, Back e offline | concluída | complementar, não substituir |
| Nova dependência | não necessária | proibida sem justificativa e aprovação | usar ferramentas atuais/gratuitas |

## 27. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| FAB cobrir conteúdo/CTA | média | ação inacessível | insets, espaço final e testes 320/360 px |
| Compactação ocultar distinções financeiras | média | interpretação errada | rótulos explícitos e regressão SPEC-011 |
| Mais reduzir descoberta de módulo | média | módulo esquecido | grupos semânticos, contexto e teste de encontrabilidade |
| Formulário perder rascunho em erro/rotação | média | retrabalho | estado local preservado e testes Android |
| Teclado/safe area variar por dispositivo | alta | CTA oculto | emulador mais aparelho físico portrait/landscape |
| Desktop divergir do mobile | média | manutenção duplicada | mesmos componentes/rotas e E2E duplo |
| Escopo invadir domínio/modelos | média | regra não aprovada | CA-30/31 e revisão de diff |
| Evidência vazar finanças | baixa | privacidade | dados sintéticos e revisão antes de anexar |

## 28. Rollback

Nesta unidade documental, rollback é `git revert` do commit documental e não afeta runtime ou dados. Na futura implementação, reverter componentes/shell para a versão anterior deve restaurar somente apresentação; não há migration, transformação de dados ou compensação. Se rollback exigir mudança de API/dados, isso evidencia violação de escopo e bloqueia a entrega.

## 29. Dúvidas

| ID | Dúvida | Impacto | Responsável | Estado |
|---|---|---|---|---|
| `D-01` | Bottom navigation, drawer ou tabs? | estrutura global | Equipe PlannerFin | Resolvida: bottom navigation + Mais + ação global |
| `D-02` | Formulário integral em modal? | teclado e feedback | Equipe PlannerFin | Resolvida: página dedicada no mobile; sheets só para escolhas curtas |
| `D-03` | Modelos entram nesta entrega? | domínio e escopo | Equipe PlannerFin | Resolvida: somente ponto de extensão futuro, sem UI/regra |

Nenhuma dúvida bloqueante permanece para revisão desta SPEC. A aprovação humana do documento continua pendente e é requisito para implementação.

## 30. Decisões aprovadas

| Data | Decisão | Responsável pela aprovação | Consequência |
|---|---|---|---|
| 2026-08-11 | Elaborar SPEC documental mobile-first sem implementar UI | tarefa atual | limita alterações a `docs/specs/**` |
| 2026-08-11 | Preservar Vue 3, Quasar, Capacitor e regras existentes | tarefa atual/ADRs | nenhum segundo frontend ou backend |
| 2026-08-11 | Proposta de bottom navigation, ação global e padrões descritos | pendente de aprovação humana da SPEC | não autoriza implementação enquanto status for Em revisão |

## 31. Definition of Done específica

### Para esta unidade documental

- [x] Ausência de conflito `SPEC-013` verificada antes da criação.
- [x] Diagnóstico confrontado com páginas, shell, router, estilos e SPEC-003 a SPEC-012.
- [x] Template completo, escopo, arquivos, riscos, rollback e critérios verificáveis registrados.
- [x] Índice de SPECs atualizado.
- [x] Nenhum arquivo de `apps/**`, dependência, API, migration ou regra financeira alterado.
- [ ] Revisão e aprovação humana registradas; pendente no PR.

### Para a futura implementação

- [ ] SPEC com status Aprovada antes de alterar UI.
- [ ] Todos os CA-01 a CA-32 atendidos.
- [ ] Lint, typecheck, testes unitários/componentes, integração aplicável, Playwright mobile/desktop e builds web/Android aprovados.
- [ ] Android validado em emulador e aparelho físico, incluindo teclado, portrait/landscape, safe area, offline e Back.
- [ ] Acessibilidade básica e texto ampliado validados.
- [ ] Screenshots/evidências sanitizadas anexadas.
- [ ] Revisão comprova zero mudança financeira, API, migration, dependência ou segundo frontend.

## 32. Histórico de alterações da SPEC

| Data | Alteração | Motivo | Autor | Aprovador, quando aplicável |
|---|---|---|---|---|
| 2026-08-11 | Criação da SPEC-013 e inclusão no índice | definir UX mobile-first observada no Android | Equipe PlannerFin | pendente |
