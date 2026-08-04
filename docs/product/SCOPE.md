# Escopo inicial do produto PlannerFin

## 1. Finalidade e convenções

Este documento delimita o escopo inicial do produto. Ele não escolhe arquitetura, tecnologias, banco de dados, API nem modelo detalhado de dados e não autoriza implementação sem uma SPEC aprovada.

Classificações usadas:

- **[Decisão aprovada]** direção aceita para o planejamento atual;
- **[Hipótese]** premissa que precisa ser validada;
- **[Dúvida]** decisão pendente do proprietário do produto;
- **[Validação futura]** definição ou resultado que será detalhado e comprovado posteriormente.

## 2. MVP

**[Decisão aprovada]** O MVP é online-first, voltado ao uso pessoal, com aplicação Android para teste interno e versão web responsiva. Compartilhamento familiar, edição conjunta, iOS e offline completo não fazem parte desse recorte.

### 2.1 Acesso e identidade

- cadastro;
- autenticação;
- acesso às próprias informações financeiras.

**[Validação futura]** Regras detalhadas de identidade, recuperação de acesso, sessões e autorização serão definidas em SPEC própria.

### 2.2 Cadastros financeiros

- contas financeiras;
- categorias de receitas e despesas;
- informações necessárias ao uso de cartões e dívidas.

**[Decisão aprovada]** A configuração inicial será feita totalmente de forma manual no aplicativo e abrangerá contas, saldos iniciais, categorias, cartões, dívidas, orçamento e os demais dados necessários ao primeiro uso. A planilha legada não será usada como fonte de dados.

**[Decisão aprovada]** Cada registro deve ter uma fonte de verdade identificável, sem duplicar bases apenas para produzir relatórios.

### 2.3 Lançamentos e transferências

- lançamentos de receita e despesa;
- valores previstos e realizados separados;
- estados pago e pendente explicitamente modelados;
- recorrências;
- transferências entre contas sem afetar totais de receitas e despesas.

**[Dúvida]** A lista completa de estados financeiros e suas transições ainda precisa ser aprovada.

### 2.4 Cartões e faturas

- cartões;
- compras à vista e parceladas;
- fechamento de fatura;
- pagamento de fatura;
- prevenção de dupla contagem entre compras e pagamento da fatura.

**[Validação futura]** Datas de corte, vencimento, parcelamento, estorno, pagamento parcial e tratamento de atraso serão detalhados em SPECs.

### 2.5 Dívidas

- cadastro e acompanhamento de dívidas;
- pagamentos e amortizações vinculados à dívida;
- saldo oficial da dívida separado de saldo estimado;
- rastreabilidade entre movimentação e alteração do saldo.

**[Validação futura]** Juros, renegociação, encargos e critérios para o saldo oficial exigem definição específica.

### 2.6 Orçamento e acompanhamento mensal

- orçamento mensal;
- valores planejados e realizados separados;
- dashboard mensal;
- consolidações rastreáveis de contas, receitas, despesas, cartões, dívidas e orçamento incluídos no MVP.

### 2.7 Plataformas do MVP

- aplicação Android para teste interno;
- versão web responsiva;
- operação online-first.

**[Dúvida]** O nível mínimo de tolerância à perda temporária de conexão ainda precisa ser definido; offline completo está fora do MVP.

## 3. Pós-MVP próximo

**[Decisão aprovada]** Estes itens não fazem parte da linha de base do MVP atual:

- metas;
- investimentos;
- calendário financeiro;
- notificações locais;
- anexos e comprovantes;
- publicação mais ampla na Play Store.

**[Dúvida]** O proprietário do produto ainda deve validar se metas, investimentos ou notificações precisam ser antecipados para o MVP.

## 4. Visão futura

**[Decisão aprovada]** Itens considerados para horizontes posteriores, sem compromisso de implementação nesta etapa:

- compartilhamento familiar;
- edição por mais de uma pessoa;
- funcionamento offline completo e sincronização;
- aplicação para iOS;
- integração bancária ou Open Finance, condicionada a análise legal, regulatória e de segurança;
- importação assistida de arquivos financeiros, que poderá avaliar possibilidades como PDF de extrato, CSV, OFX, faturas ou documentos semelhantes, sempre em unidade própria e sem compromisso de implementar todos ou qualquer um desses formatos;
- sugestão de criação de lançamentos a partir de itens extraídos, somente após revisão humana, tratamento de duplicidades e inconsistências e confirmação explícita;
- categorização assistida por IA;
- detecção de duplicidades e anomalias;
- previsões e consultas em linguagem natural;
- outros recursos de IA ainda não definidos.

**[Decisão aprovada]** Qualquer IA futura será complementar, auditável e incapaz de alterar silenciosamente informações financeiras.

## 5. Fora do escopo atual

**[Decisão aprovada]** Não pertencem ao escopo atual:

- movimentar dinheiro;
- atuar como banco ou instituição financeira;
- recomendação autônoma de investimentos;
- alterações financeiras silenciosas por IA;
- copiar célula por célula a planilha;
- usar a planilha legada como fonte de dados ou oferecer compatibilidade de importação com seu arquivo no MVP;
- migrar o histórico ou a posição atual da planilha;
- reproduzir defeitos, limites ou fórmulas incompatíveis do legado;
- suporte contábil empresarial;
- criptomoedas como meio de pagamento;
- automação financeira sem possibilidade de revisão;
- compartilhamento familiar e edição conjunta no MVP;
- funcionamento offline completo no MVP;
- iOS na primeira entrega.

## 6. Hipóteses de planejamento

- **[Hipótese]** O núcleo definido para o MVP cobre as necessidades cotidianas mais importantes do usuário inicial.
- **[Hipótese]** O uso online-first é aceitável no primeiro ciclo de teste.
- **[Hipótese]** Android e web responsiva são suficientes para validar o produto antes de ampliar plataformas.
- **[Hipótese]** A configuração inicial manual oferece os dados necessários para iniciar o uso sem transportar as ambiguidades da planilha.

Hipóteses não são regras aprovadas e devem ser testadas antes de orientar decisões irreversíveis.

## 7. Decisões pendentes

### 7.1 Composição do MVP

- **[Dúvida]** Metas devem entrar no MVP ou permanecer no pós-MVP?
- **[Dúvida]** Investimentos devem entrar no MVP ou permanecer no pós-MVP?
- **[Dúvida]** Notificações devem entrar no MVP ou permanecer no pós-MVP?

### 7.2 Distribuição e usuários

- **[Dúvida]** A publicação inicial será privada, para teste interno, ou pública?
- **[Dúvida]** Existe necessidade imediata de compartilhar dados com outra pessoa?
- **[Validação futura]** Mesmo fora do MVP, a prioridade de compartilhamento familiar deverá ser reavaliada após o uso inicial.

### 7.3 Conectividade

- **[Dúvida]** Qual comportamento é esperado durante interrupções breves de conexão?
- **[Dúvida]** Há algum fluxo que precise funcionar sem conexão já no MVP, ainda que offline completo esteja excluído?

### 7.4 Estados financeiros

- **[Dúvida]** Quais são os estados oficiais de lançamentos, faturas, parcelas e dívidas?
- **[Dúvida]** Como representar agendado, vencido, cancelado, parcialmente pago e estornado?
- **[Dúvida]** Quais transições exigem confirmação, justificativa ou histórico?

## 8. Critérios para inclusão de trabalho futuro

Um item somente pode avançar para implementação quando:

1. estiver dentro do horizonte aprovado ou tiver mudança de escopo aprovada;
2. suas dúvidas que alteram comportamento estiverem resolvidas;
3. houver SPEC própria, revisada e aprovada;
4. critérios de aceite, riscos e verificações estiverem definidos;
5. não introduzir escolha arquitetural silenciosa nem ampliar o escopo de outra unidade de trabalho.
