# Glossário TO-BE do produto PlannerFin

## 1. Finalidade e uso

Este glossário consolida os termos oficiais ou candidatos do modelo conceitual TO-BE. Ele não copia automaticamente o glossário AS-IS da planilha e não define estruturas físicas, interface ou implementação.

Status:

- **Aprovado:** significado sustentado por decisão já registrada na visão, no escopo, nos princípios ou nesta unidade aprovada;
- **Proposto:** vocabulário conceitual recomendado, ainda sujeito a validação;
- **Pendente:** significado ou regra depende de decisão futura.

“Origem ou decisão” identifica a base do termo, não uma autorização para implementar comportamento sem SPEC.

## 2. Termos

| Termo | Definição TO-BE | Não confundir com | Origem ou decisão | Status |
|---|---|---|---|---|
| Ajuste de saldo | Correção explícita e rastreável da posição de uma conta, com origem, justificativa, data e efeito. | Receita, despesa ou sobrescrita silenciosa do saldo inicial. | Princípios de rastreabilidade e ações explícitas; modelo TO-BE. | Proposto |
| Amortização | Parte de um pagamento de dívida que reduz o principal, quando essa decomposição for conhecida. | Valor total do pagamento, juros ou encargos. | Escopo de dívidas; modelo TO-BE. | Proposto |
| Automação revisável | Processo automático cujo efeito pode ser identificado, inspecionado, corrigido e confirmado conforme o risco. | Alteração silenciosa ou dependência obrigatória de IA. | Princípio do produto. | Aprovado |
| Cancelamento | Encerramento explícito de um registro ou operação sem apagar seu histórico. | Exclusão, estorno ou ausência de estado. | Modelo TO-BE; transições permanecem pendentes. | Proposto |
| Cartão | Instrumento usado para organizar compras, limite e ciclos de fatura. | Conta financeira ou fatura. | Escopo do MVP; modelo TO-BE. | Proposto |
| Categoria | Classificação explícita de receita ou despesa. | Conta financeira, descrição ou natureza do lançamento. | Escopo e princípio de fonte de verdade. | Aprovado |
| Categoria ativa | Categoria disponível para novos registros e planejamento. | Categoria histórica ainda referenciada. | Modelo TO-BE. | Proposto |
| Categoria de despesa | Categoria compatível com lançamentos de despesa. | Categoria de receita. | Modelo TO-BE. | Proposto |
| Categoria de receita | Categoria compatível com lançamentos de receita. | Categoria de despesa. | Modelo TO-BE. | Proposto |
| Categoria de sistema | Categoria fornecida pelo produto para tratamento especificado. | Categoria copiada da planilha ou categoria personalizada. | Modelo TO-BE; existência concreta pendente. | Pendente |
| Categoria inativa | Categoria indisponível para novos usos, mas preservada no histórico. | Categoria excluída ou recategorização automática. | Modelo TO-BE. | Proposto |
| Categoria personalizada | Categoria criada manualmente pelo usuário. | Categoria de sistema. | Configuração inicial manual; modelo TO-BE. | Proposto |
| Competência | Período ao qual um evento econômico pertence, independentemente de seu pagamento. | Período de caixa ou vencimento. | Modelo TO-BE; aplicação por conceito pendente. | Proposto |
| Compra | Evento de consumo ou despesa associado a um cartão. | Parcela, fatura ou pagamento de fatura. | Escopo de cartões; modelo TO-BE. | Proposto |
| Conciliação | Comparação entre uma posição informada e registros rastreáveis para explicar ou corrigir divergências. | Ajuste silencioso ou estimativa. | Princípios de rastreabilidade; detalhamento futuro. | Pendente |
| Configuração inicial manual | Preparação manual de contas, saldos iniciais, categorias, cartões, dívidas, orçamento e dados necessários ao primeiro uso. | Migração de histórico ou carga baseada na planilha. | Decisão aprovada no escopo e na visão. | Aprovado |
| Conta ativa | Conta disponível para novos registros. | Conta inativa ou conta sem movimentação. | Modelo TO-BE. | Proposto |
| Conta financeira | Contexto no qual entradas, saídas e transferências alteram uma posição monetária acompanhada. | Cartão, categoria ou espaço financeiro pessoal. | Escopo do MVP; modelo TO-BE. | Aprovado |
| Conta inativa | Conta preservada para histórico, mas indisponível para novos registros ordinários. | Conta excluída. | Modelo TO-BE; regras de reativação pendentes. | Proposto |
| Contas a pagar | Consolidação de despesas pendentes elegíveis, vencidas ou a vencer. | Despesas realizadas ou orçamento planejado. | Modelo TO-BE; estados elegíveis pendentes. | Proposto |
| Contas a receber | Consolidação de receitas pendentes elegíveis, vencidas ou a vencer. | Receitas realizadas ou simples previsões. | Modelo TO-BE; distinção de previsão pendente. | Proposto |
| Credor | Pessoa ou organização perante a qual existe uma dívida. | Conta pagadora. | Escopo de dívidas e modelo TO-BE. | Aprovado |
| Data de ocorrência | Data do evento econômico segundo o conceito envolvido. | Vencimento, pagamento ou competência. | Modelo TO-BE. | Proposto |
| Data de pagamento | Data em que pagamento ou recebimento foi efetivamente reconhecido. | Data de ocorrência ou vencimento. | Modelo TO-BE. | Proposto |
| Data de referência | Data à qual um saldo informado, oficial ou inicial se aplica. | Data de cadastro ou data atual. | Decisão de configuração manual; modelo TO-BE. | Aprovado |
| Data de vencimento | Data-limite prevista para pagamento ou recebimento. | Data de pagamento ou estado realizado. | Escopo e modelo TO-BE. | Aprovado |
| Despesa | Saída econômica classificada como despesa; seu efeito de caixa depende de realização. | Transferência, pagamento de fatura duplicado ou saldo inicial. | Escopo e princípios do produto. | Aprovado |
| Dívida | Obrigação financeira acompanhada pelo usuário. | Despesa isolada, fatura ou saldo estimado. | Escopo do MVP. | Aprovado |
| Encargo | Acréscimo identificável diferente do principal ou consumo original. | Juros, principal ou pagamento. | Escopo; regras futuras. | Proposto |
| Espaço financeiro pessoal | Contexto que reúne os registros e configurações financeiras pertencentes ao usuário. | Conta financeira ou espaço compartilhado. | Uso pessoal aprovado; modelo TO-BE. | Proposto |
| Estado financeiro | Situação explícita de um registro em seu ciclo de vida. | Texto livre, emoji, célula vazia ou condição derivada. | Escopo exige estados explícitos. | Aprovado |
| Estorno | Reversão total ou parcial vinculada ao evento que corrige. | Cancelamento, exclusão ou novo registro sem vínculo. | Escopo de cartões; tratamento pendente. | Proposto |
| Fatura | Consolidação rastreável dos eventos atribuídos a um ciclo de cartão. | Compra, cartão ou pagamento de fatura. | Escopo e princípio contra dupla contagem. | Proposto |
| Fechamento de fatura | Marco que delimita os eventos atribuídos a um ciclo de fatura. | Vencimento ou pagamento. | Escopo de cartões; regras pendentes. | Proposto |
| Histórico de alteração | Registro rastreável de mudanças financeiras relevantes e de seu contexto. | Duplicação de fonte de verdade ou log técnico genérico. | Princípios de rastreabilidade e ações explícitas. | Proposto |
| Juros | Custo financeiro associado ao tempo ou às condições de uma obrigação. | Encargo, amortização ou estimativa inteira. | Escopo de dívidas; fórmula pendente. | Pendente |
| Lançamento | Registro autoritativo de receita ou despesa, com natureza e estado explícitos. | Transferência, compra ou linha de relatório. | Escopo e princípio de fonte de verdade. | Aprovado |
| Moeda padrão | Moeda de referência dos valores e consolidações do espaço financeiro pessoal. | Precisão monetária ou taxa de conversão. | Modelo TO-BE; alteração e multimoeda pendentes. | Proposto |
| Núcleo financeiro independente de IA | Condição em que registros, saldos, consolidações e regras essenciais funcionam deterministicamente sem IA. | Proibição absoluta de recursos assistivos futuros. | Princípio do produto. | Aprovado |
| Ocorrência recorrente | Lançamento identificável originado de uma regra de recorrência. | A própria regra ou cópia sem vínculo. | Escopo de recorrências; modelo TO-BE. | Proposto |
| Orçamento | Planejamento de valor por período e categoria, comparável ao realizado rastreável. | Saldo de conta ou simples total de despesas. | Escopo do MVP. | Aprovado |
| Pagamento | Realização financeira que produz saída de caixa e pode estar vinculada a lançamento, fatura ou dívida. | Despesa econômica em todos os relatórios. | Modelo TO-BE; regras específicas pendentes. | Proposto |
| Pagamento de dívida | Pagamento vinculado a uma dívida e, quando aplicável, à conta pagadora. | Parcela prevista ou atualização do saldo oficial. | Escopo de dívidas. | Proposto |
| Pagamento de fatura | Saída de caixa de uma conta pagadora vinculada à fatura. | Nova despesa quando as compras já foram consideradas. | Princípio contra dupla contagem; modelo TO-BE. | Proposto |
| Pagamento parcial | Pagamento inferior ao valor exigível de uma obrigação ou fatura. | Pagamento integral ou desconto. | Dúvida registrada no escopo. | Pendente |
| Parcela | Fração identificável de uma compra parcelada ou dívida. | Pagamento efetivo ou número de parcelas pagas. | Escopo de cartões e dívidas. | Proposto |
| Parcelamento | Acordo que distribui um valor em parcelas. | Recorrência. | Escopo de cartões e dívidas. | Proposto |
| Pendência | Obrigação ou direito ainda não realizado nem encerrado. | Previsão, vencimento ou célula vazia. | Escopo exige estado pendente explícito. | Aprovado |
| Período de caixa | Intervalo em que ocorreu entrada ou saída efetiva em conta. | Competência. | Modelo TO-BE; regime oficial pendente. | Proposto |
| Precisão monetária | Regra de casas decimais e arredondamento dos valores. | Moeda padrão. | Modelo TO-BE; regra não aprovada. | Pendente |
| Previsão | Expectativa financeira registrada, mantida separada do realizado. | Pendência, realização ou orçamento. | Princípio de previsto e realizado separados. | Aprovado |
| Realização | Reconhecimento explícito de recebimento ou pagamento. | Previsão, vencimento ou competência. | Princípio de previsto e realizado separados. | Proposto |
| Receita | Entrada econômica classificada como receita; seu efeito de caixa depende de realização. | Transferência recebida, saldo inicial ou ajuste. | Escopo e princípios do produto. | Aprovado |
| Recorrência | Regra que descreve a intenção de produzir ocorrências financeiras relacionadas ao longo do tempo. | Parcelamento ou lançamento já realizado. | Escopo do MVP; automações revisáveis. | Proposto |
| Regime de caixa | Critério que atribui valores ao período da entrada ou saída efetiva. | Regime de competência. | Modelo TO-BE; escolha oficial pendente. | Pendente |
| Regime de competência | Critério que atribui valores ao período econômico do evento. | Regime de caixa. | Modelo TO-BE; escolha oficial pendente. | Pendente |
| Renegociação | Mudança rastreável das condições de uma dívida sem apagar as condições anteriores. | Ajuste silencioso do saldo ou nova dívida sem vínculo. | Escopo de dívidas; modelo TO-BE. | Proposto |
| Resultado financeiro | Receitas menos despesas segundo o mesmo período e regime declarados. | Saldo de conta, patrimônio ou fluxo de transferências. | Proposta de valor e modelo TO-BE. | Proposto |
| Saldo calculado | Posição derivada do saldo inicial e dos eventos elegíveis e rastreáveis de uma conta. | Saldo informado, saldo estimado de dívida ou total de receitas. | Princípios de rastreabilidade; modelo TO-BE. | Proposto |
| Saldo estimado | Projeção calculada por premissas explícitas e exibida separadamente do oficial. | Saldo oficial. | Princípio do produto. | Aprovado |
| Saldo inicial | Posição manual de uma conta em uma data de referência; não é receita nem despesa. | Receita inicial, ajuste ou histórico migrado. | Decisão de configuração inicial manual. | Aprovado |
| Saldo oficial da dívida | Posição da dívida informada ou conciliada como oficial em uma data de referência. | Saldo estimado ou valor contratado. | Escopo e princípio do produto. | Aprovado |
| Transferência | Operação única entre conta de origem e destino, neutra para receitas, despesas e resultado. | Duas movimentações independentes, receita ou despesa. | Regra aprovada no escopo e princípios. | Aprovado |
| Usuário | Pessoa autenticada que administra as próprias informações financeiras. | Credor, titular compartilhado ou instituição. | Público e uso pessoal aprovados. | Aprovado |
| Valor contratado | Principal reconhecido na contratação de uma dívida, sem presumir saldo atual. | Saldo oficial, saldo estimado ou total pago. | Modelo TO-BE. | Proposto |
| Valor planejado | Valor informado no orçamento para um período e categoria. | Previsão de lançamento ou valor realizado. | Escopo de orçamento. | Aprovado |
| Valor realizado | Total derivado de registros elegíveis segundo critério e período explícitos. | Valor planejado, pendente ou estimado. | Princípio de previsto e realizado separados. | Aprovado |
| Variação orçamentária | Diferença entre valor planejado e realizado, segundo sinal a definir. | Saldo de conta ou resultado financeiro. | Modelo TO-BE; fórmula/sinal pendentes. | Pendente |
| Vencido | Condição possível de item pendente cuja data de vencimento passou. | Estado realizado, cancelado ou vencimento como data. | Proposta do modelo; decisão oficial pendente. | Pendente |
| Vencimento | Data-limite prevista associada a obrigação ou direito. | Pagamento, ocorrência ou competência. | Escopo e modelo TO-BE. | Aprovado |
