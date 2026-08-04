# Visão do produto PlannerFin

## 1. Finalidade e status

Este documento registra a visão inicial do PlannerFin. Ele orienta decisões de produto, mas não define arquitetura técnica, banco de dados, frameworks, APIs nem modelo detalhado de dados. Funcionalidades somente podem ser implementadas após especificação e aprovação conforme [docs/specs/README.md](../specs/README.md).

As afirmações são classificadas assim:

- **[Decisão aprovada]** direção explicitamente fornecida para esta etapa;
- **[Hipótese]** expectativa de produto que ainda precisa ser validada;
- **[Dúvida]** questão que exige decisão do proprietário do produto;
- **[Validação futura]** resultado ou comportamento que deverá ser comprovado em pesquisa, SPEC ou teste posterior.

## 2. Problema

**[Decisão aprovada]** O PlannerFin deve substituir a dependência operacional de uma planilha de finanças pessoais baseada em fórmulas, múltiplas abas e bases auxiliares.

A análise [AS-IS da planilha](../research/XLSX-AS-IS-ANALYSIS.md) evidencia dificuldades que o produto não deve reproduzir automaticamente:

- regras importantes distribuídas entre áreas visíveis e ocultas;
- estados financeiros inferidos por texto ou células vazias;
- cálculos repetidos e sujeitos a dupla contagem;
- anos, faixas e capacidades fixas;
- incompatibilidades entre o arquivo exportado e seu ambiente de origem;
- ausência de rastreabilidade suficiente para explicar alguns resultados.

**[Hipótese]** Centralizar registros e tornar estados e cálculos explícitos reduzirá o esforço de manutenção e aumentará a confiança do usuário nas informações apresentadas.

## 3. Público inicial

**[Decisão aprovada]** O público inicial é uma pessoa que administra as próprias finanças e precisa registrar, acompanhar e compreender contas, receitas, despesas, cartões, dívidas e orçamento.

**[Decisão aprovada]** O uso inicial será pessoal. A concepção não deve impedir evolução futura para múltiplos usuários, mas compartilhamento familiar e edição conjunta não pertencem ao MVP.

**[Hipótese]** O usuário inicial valoriza uma experiência confortável no celular, com visão consolidada do mês e capacidade de conferir a origem dos valores.

## 4. Proposta de valor

**[Decisão aprovada]** O PlannerFin deve oferecer um lugar único para registrar e acompanhar a vida financeira pessoal, separando claramente previsão de realização, saldo oficial de estimativas e movimentos individuais de suas consolidações.

O valor pretendido está em:

- reduzir a necessidade de operar fórmulas e abas auxiliares;
- apresentar estados financeiros explícitos e compreensíveis;
- evitar dupla contagem, especialmente em transferências e cartões;
- permitir que resultados consolidados sejam rastreados até seus registros de origem;
- apoiar decisões pessoais sem movimentar dinheiro ou atuar como instituição financeira;
- permitir evolução incremental sem tornar IA uma dependência do núcleo financeiro.

## 5. Experiência pretendida

**[Decisão aprovada]** A experiência principal deve ser adequada ao Android, acompanhada por uma versão web responsiva.

O usuário deve conseguir:

1. registrar e consultar informações financeiras com poucos passos e linguagem clara;
2. distinguir o que está previsto, pendente e realizado;
3. compreender saldos, faturas, dívidas e orçamento sem conhecer fórmulas;
4. revisar cálculos e automações relevantes antes de aceitar seus efeitos;
5. identificar ações destrutivas e suas consequências antes de confirmá-las;
6. usar o núcleo financeiro mesmo quando recursos de IA estiverem indisponíveis.

**[Validação futura]** Fluxos, textos, acessibilidade e conforto de uso no celular deverão ser avaliados com protótipos e testes de aceitação antes da implementação de cada área.

## 6. Resultados esperados

**[Decisão aprovada]** O produto deve tornar o acompanhamento financeiro menos dependente de conhecimento técnico sobre planilhas e mais confiável para uso cotidiano.

Resultados pretendidos:

- registros financeiros mantidos em uma única fonte de verdade por conceito;
- consolidações sem dupla contagem conhecida;
- saldos e cálculos explicáveis a partir de seus componentes;
- visão mensal útil para acompanhamento de orçamento, contas, cartões e dívidas;
- importação inicial controlada, sem transformar defeitos do legado em regras do produto;
- uso principal viável em Android e acesso complementar pela web responsiva;
- evolução por SPECs pequenas, revisáveis e testáveis.

## 7. Diferenças em relação à planilha

**[Decisão aprovada]** A planilha é fonte AS-IS e referência de funcionalidades, não uma especificação TO-BE.

O PlannerFin não deve:

- copiar a organização por abas ou células;
- reproduzir fórmulas, erros, limites fixos ou bases auxiliares apenas por existirem no legado;
- tratar célula vazia como regra de negócio implícita;
- duplicar registros para produzir relatórios;
- depender de um ambiente de planilha para recalcular informações;
- transportar dados pessoais ou financeiros reais para testes.

**[Validação futura]** Cada comportamento aproveitado do AS-IS deverá ser esclarecido, especificado e aprovado antes de implementação.

## 8. Plataformas pretendidas

- **[Decisão aprovada] Android:** plataforma principal do uso inicial e da aplicação para teste interno.
- **[Decisão aprovada] Web responsiva:** acesso complementar incluído no MVP.
- **[Decisão aprovada] Online-first:** o MVP pressupõe conectividade; funcionamento offline completo não faz parte da primeira entrega.
- **[Decisão aprovada] iOS:** possibilidade futura a ser preservada, sem fazer parte do MVP.

Este documento não escolhe tecnologias para nenhuma plataforma.

## 9. Limites éticos e funcionais

**[Decisão aprovada]** O PlannerFin não movimenta dinheiro, não atua como banco e não oferece recomendação autônoma de investimentos.

Também são limites obrigatórios:

- o núcleo financeiro funciona sem IA;
- IA, quando existir, é complementar e auditável;
- nenhuma IA altera silenciosamente informações financeiras;
- automações relevantes podem ser revisadas pelo usuário;
- ações destrutivas exigem confirmação explícita;
- privacidade é o padrão, não uma configuração posterior;
- dados financeiros reais não são usados em testes;
- suporte contábil empresarial não integra o escopo atual.

## 10. Indicadores de sucesso

Os indicadores abaixo definem o que deverá ser medido. Metas numéricas serão aprovadas em etapa própria, sem serem inventadas neste documento.

| Indicador | Evidência esperada | Classificação |
|---|---|---|
| Conclusão dos fluxos essenciais | Usuário conclui cadastro, lançamento, transferência, cartão, dívida e orçamento nos fluxos previstos | **[Validação futura]** |
| Integridade das consolidações | Cenários de aceite não apresentam dupla contagem entre compra, fatura, transferência, receita e despesa | **[Validação futura]** |
| Rastreabilidade | Totais relevantes podem ser explicados pelos registros que os compõem | **[Validação futura]** |
| Clareza de estados | Usuário distingue valores previstos, pendentes e realizados, além de saldo oficial e estimado | **[Validação futura]** |
| Qualidade da importação | Importação informa o que foi aceito, rejeitado ou exige revisão | **[Validação futura]** |
| Usabilidade móvel | Fluxos principais são legíveis e operáveis confortavelmente em Android | **[Validação futura]** |
| Confiabilidade | Erros de cálculo, perda de dados e alterações silenciosas são detectáveis e tratados | **[Validação futura]** |
| Privacidade | Dados são expostos somente ao usuário autorizado e não aparecem em testes ou registros indevidos | **[Validação futura]** |
| Adoção pessoal | O usuário inicial consegue substituir o uso cotidiano da planilha nos módulos incluídos no MVP | **[Hipótese]** |

## 11. Horizonte do produto

### 11.1 MVP

**[Decisão aprovada]** O MVP concentra o núcleo de registro e acompanhamento financeiro pessoal: identidade, contas, categorias, lançamentos, transferências, recorrências, cartões e faturas, dívidas, orçamento, dashboard, importação controlada, Android para teste interno e web responsiva.

O detalhamento e as decisões pendentes desse recorte estão em [SCOPE.md](SCOPE.md).

### 11.2 Visão futura

**[Decisão aprovada]** A visão futura pode incluir compartilhamento familiar, offline completo com sincronização, iOS, integração bancária/Open Finance após análise legal e de segurança, além de recursos assistidos por IA.

**[Decisão aprovada]** Recursos futuros de IA podem apoiar categorização, detecção de duplicidades e anomalias, previsões e consultas em linguagem natural, sempre sem substituir o núcleo determinístico nem alterar dados silenciosamente.

## 12. Incertezas atuais

### 12.1 Hipóteses a validar

- **[Hipótese]** Uma experiência online-first atende ao uso inicial sem impedir o acompanhamento cotidiano.
- **[Hipótese]** Android como plataforma principal e web responsiva como complemento cobrem o primeiro ciclo de uso.
- **[Hipótese]** O recorte do MVP é suficiente para substituir o uso diário das áreas centrais da planilha.

### 12.2 Dúvidas

- **[Dúvida]** A importação inicial deve trazer todo o histórico ou somente uma posição inicial revisada?
- **[Dúvida]** Metas, investimentos e notificações devem permanecer pós-MVP?
- **[Dúvida]** A publicação inicial será privada ou pública?
- **[Dúvida]** Qual nível mínimo de operação sem conexão é necessário no uso real?
- **[Dúvida]** Quais estados financeiros oficiais existirão além de pago e pendente?

Essas dúvidas não autorizam suposições durante a implementação; devem ser resolvidas nas unidades documentais e SPECs correspondentes.
