# Princípios do produto PlannerFin

## 1. Finalidade

Estes princípios orientam decisões de produto e critérios de aceite. Eles são verificáveis: cada princípio descreve seu significado, uma aplicação esperada, uma violação e a evidência que deve ser procurada. Não definem arquitetura ou tecnologia.

## 2. Simplicidade sem esconder informações importantes

- **Significado:** reduzir esforço e complexidade visual sem ocultar estados, origem de valores, consequências ou exceções relevantes.
- **Exemplo de aplicação:** um resumo mensal mostra o total e permite acessar os registros que o compõem.
- **Exemplo de violação:** exibir apenas “saldo disponível” sem informar se há valores pendentes ou estimados.
- **Critério verificável:** informações que alteram a interpretação financeira permanecem visíveis ou acessíveis no contexto da decisão.

## 3. Uma única fonte de verdade para cada registro

- **Significado:** cada conta, lançamento, compra, fatura, dívida ou pagamento possui um registro autoritativo; visões e relatórios derivam dele.
- **Exemplo de aplicação:** o dashboard calcula seus totais a partir dos mesmos lançamentos exibidos no histórico.
- **Exemplo de violação:** copiar lançamentos para uma base auxiliar independente e permitir que as duas versões sejam editadas.
- **Critério verificável:** alterar o registro autoritativo atualiza todas as visões aplicáveis sem exigir edição duplicada.

## 4. Nenhuma dupla contagem

- **Significado:** o mesmo evento econômico não pode aumentar ou reduzir uma consolidação mais de uma vez.
- **Exemplo de aplicação:** a compra no cartão e o pagamento da fatura têm papéis distintos e não são somados duas vezes como despesa.
- **Exemplo de violação:** contar cada parcela como despesa e contar novamente o pagamento integral da fatura no mesmo indicador.
- **Critério verificável:** cenários de compra, fatura, transferência e amortização têm testes de reconciliação com resultado esperado.

## 5. Valores previstos e realizados separados

- **Significado:** planejamento, agendamento ou pendência não se confundem com evento financeiro efetivamente realizado.
- **Exemplo de aplicação:** o orçamento compara planejado e realizado em campos distintos, preservando ambos.
- **Exemplo de violação:** somar uma despesa futura ao total pago sem identificar que ainda está pendente.
- **Critério verificável:** toda consolidação que mistura horizontes apresenta cada componente separadamente e explica o total.

## 6. Saldo oficial e saldo estimado separados

- **Significado:** valor confirmado por registros oficiais não deve ser substituído silenciosamente por projeção, fórmula aproximada ou estimativa.
- **Exemplo de aplicação:** uma dívida mantém o saldo oficial informado ou conciliado e mostra em separado uma projeção calculada.
- **Exemplo de violação:** apresentar como saldo oficial uma conta que ignora juros ou pagamentos não conciliados.
- **Critério verificável:** a interface e os dados identificam origem, data de referência e natureza oficial ou estimada do saldo.

## 7. Cálculos financeiros rastreáveis

- **Significado:** resultados relevantes devem ser explicáveis pelos dados, regras e período que os produziram.
- **Exemplo de aplicação:** tocar no total de despesas permite ver lançamentos, filtros e ajustes incluídos.
- **Exemplo de violação:** mostrar um total sem possibilidade de determinar quais registros ou regras participaram dele.
- **Critério verificável:** critérios de aceite conseguem reconciliar o resultado exibido com seus componentes de origem.

## 8. Ações destrutivas explícitas

- **Significado:** excluir, sobrescrever, desvincular ou alterar informação financeira de forma irreversível exige intenção clara do usuário.
- **Exemplo de aplicação:** excluir uma conta informa o impacto, bloqueia a ação quando necessário e solicita confirmação.
- **Exemplo de violação:** remover registros relacionados ao apagar uma categoria sem aviso.
- **Critério verificável:** ações destrutivas têm linguagem inequívoca, confirmação proporcional ao risco e resultado auditável quando aplicável.

## 9. Automações revisáveis

- **Significado:** recorrências, importações, classificações e outros processos automáticos devem permitir inspeção e correção.
- **Exemplo de aplicação:** uma futura importação de arquivos financeiros apresenta os itens extraídos para revisão humana e trata duplicidades e inconsistências antes de sugerir a criação de lançamentos.
- **Exemplo de violação:** criar ou alterar lançamentos silenciosamente a partir de um arquivo, sem apresentar o que mudou e sem confirmação.
- **Critério verificável:** o usuário consegue identificar a automação, revisar seu efeito, corrigir exceções e confirmar explicitamente a criação ou alteração de dados, sem editar dados ocultos.

## 10. Privacidade por padrão

- **Significado:** coletar, exibir e compartilhar somente os dados necessários, restringindo o acesso desde a configuração inicial.
- **Exemplo de aplicação:** informações financeiras pertencem ao usuário autenticado e não são compartilhadas sem ação explícita.
- **Exemplo de violação:** tornar dados visíveis por link público ou ativar compartilhamento automaticamente.
- **Critério verificável:** todo acesso a dado financeiro possui finalidade, usuário autorizado e configuração inicial restritiva.

## 11. Dados financeiros reais nunca usados em testes

- **Significado:** desenvolvimento, demonstrações e testes utilizam dados sintéticos, anonimizados de forma irreversível ou especificamente preparados para esse fim.
- **Exemplo de aplicação:** cenários de fatura usam pessoas, contas e valores fictícios documentados como massa de teste.
- **Exemplo de violação:** copiar a planilha operacional ou registros do usuário para um ambiente de teste.
- **Critério verificável:** repositórios, fixtures, logs, evidências e ambientes de teste não contêm dados pessoais ou financeiros reais.

## 12. Núcleo financeiro independente de IA

- **Significado:** registro, saldo, consolidação e regras financeiras essenciais funcionam de maneira determinística sem depender de modelos de IA.
- **Exemplo de aplicação:** uma sugestão de categoria feita por IA só produz efeito após regra explícita ou confirmação revisável.
- **Exemplo de violação:** impedir o cálculo do saldo quando um serviço de IA está indisponível ou aceitar silenciosamente sua sugestão.
- **Critério verificável:** desabilitar recursos de IA não impede os fluxos financeiros centrais nem altera seus resultados.

## 13. Acessibilidade e uso confortável no celular

- **Significado:** conteúdo e interação devem ser perceptíveis, compreensíveis e operáveis em telas móveis e com tecnologias assistivas aplicáveis.
- **Exemplo de aplicação:** formulários usam rótulos claros, ordem de foco coerente, contraste adequado e áreas de toque confortáveis.
- **Exemplo de violação:** exigir planilha horizontal extensa, depender apenas de cor ou usar controles pequenos para ações críticas.
- **Critério verificável:** fluxos principais passam por validação de acessibilidade e teste em dimensões móveis representativas.

## 14. Evolução incremental baseada em SPECs

- **Significado:** cada mudança de comportamento nasce de uma unidade pequena, rastreável, revisada e aprovada antes da implementação.
- **Exemplo de aplicação:** fechamento de fatura é especificado com regras, exceções e critérios de aceite antes do código.
- **Exemplo de violação:** incluir regras de juros ou novos estados durante outra implementação sem atualizar e aprovar o escopo.
- **Critério verificável:** toda funcionalidade implementada aponta para uma SPEC aprovada e não contém comportamento fora dela.

## 15. Uso em decisões e aceite

Quando princípios entrarem em tensão, a decisão deve ser registrada na SPEC aplicável, com impacto e justificativa. Nenhum princípio autoriza sozinho uma escolha arquitetural ou uma ampliação de escopo.

Uma entrega deve indicar quais princípios são relevantes e como seus critérios foram verificados. Dúvidas que alterem comportamento interrompem a implementação até decisão e aprovação humanas.
