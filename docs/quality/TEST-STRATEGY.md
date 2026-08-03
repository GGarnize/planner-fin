# Estratégia de testes

## Objetivo e estado atual

Esta estratégia define níveis, riscos e expectativas de teste de forma agnóstica. Como a arquitetura ainda não foi aprovada, este documento não escolhe bibliotecas, frameworks, runners ou serviços. A estratégia deverá ser complementada após os ADRs técnicos, sem reduzir as garantias funcionais aqui descritas.

## Princípios

- Derivar testes das regras de negócio, riscos e critérios de aceite da SPEC.
- Automatizar critérios de aceite quando tecnicamente viável.
- Manter testes determinísticos, isolados e reproduzíveis.
- Usar somente dados fictícios e não identificáveis.
- Testar resultados financeiros exatos, não apenas a presença de telas ou respostas.
- Priorizar prevenção de perda de dados, inconsistência de saldo e dupla contagem.
- Registrar comandos, ambiente, resultado e evidências das verificações executadas.
- Justificar níveis marcados como “Não aplicável”.

## Níveis de teste

### Testes unitários

Validam uma regra ou unidade lógica isolada. Devem cobrir cálculos, validações, transições de estado, arredondamento, limites e casos de erro sem depender de infraestrutura externa.

### Testes de integração

Validam a colaboração entre componentes e recursos reais ou equivalentes controlados, como persistência, filas, relógio, autenticação e serviços internos. Devem verificar consistência, transações, idempotência e efeitos colaterais.

### Testes de contrato

Validam formatos, campos, tipos, versionamento, códigos de erro e compatibilidade nas fronteiras entre componentes ou sistemas. Aplicam-se a APIs, eventos, importações/exportações e integrações externas.

### Testes E2E

Validam fluxos críticos completos pela interface pública do sistema, com ambiente controlado e dados fictícios. Devem ser reservados aos cenários de maior valor e risco, sem substituir testes mais específicos.

### Aceitação manual

Confirma com uma pessoa autorizada que o comportamento atende à SPEC e à necessidade do produto. Deve seguir critérios Dado/Quando/Então, registrar ambiente e evidência e nunca substituir verificações automatizáveis sem justificativa.

## Matriz mínima do domínio financeiro

Toda SPEC deve avaliar os cenários abaixo e selecionar os aplicáveis.

| Tema | Cobertura mínima esperada |
|---|---|
| Valores monetários | zero, positivos, negativos permitidos/proibidos, limites, precisão e moeda |
| Arredondamento | regra adotada, casas decimais, somas acumuladas e divisão não exata |
| Datas | virada de mês/ano, ano bissexto, data inválida, ordenação e vencimento |
| Fuso horário | conversão, horário de verão quando relevante e fronteiras do dia |
| Recorrência | primeira/última ocorrência, pausa, edição, cancelamento e meses sem o mesmo dia |
| Parcelamento | quantidade, valor total, resto de arredondamento, datas e cancelamento |
| Cartão | fechamento, vencimento, limite, compra e alteração de período |
| Fatura | composição, pagamento, reabertura, atraso e prevenção de dupla contagem |
| Dívida | principal, juros aprovados, parcelas, saldo devedor, quitação e atraso |
| Transferência | débito e crédito correspondentes, atomicidade e neutralidade em receita/despesa quando prevista |
| Orçamento | planejado x realizado, categorias, período e denominador zero |
| Status | transições válidas, estados vazios, idempotência e operações concorrentes |

## Regras financeiras prioritárias

### Prevenção de dupla contagem

Testar explicitamente, conforme a SPEC:

- compra no cartão versus pagamento da fatura;
- transferência entre contas versus receita/despesa;
- lançamento recorrente versus instância materializada;
- importação repetida versus registro existente;
- reprocessamento de eventos e tentativas idempotentes;
- agregações mensais versus totais acumulados.

Os testes devem demonstrar tanto o valor individual quanto o total consolidado antes e depois da operação.

### Cálculo e precisão

- Definir na SPEC a unidade monetária e a regra de arredondamento.
- Evitar expectativas aproximadas quando o resultado precisa ser exato.
- Verificar totais por caminhos alternativos e invariantes, como soma das parcelas igual ao total segundo a regra aprovada.
- Cobrir divisões por zero, campos vazios e valores fora dos limites.

### Tempo

- Controlar o relógio nos testes automatizados quando o resultado depender da data atual.
- Declarar o fuso usado nos cenários.
- Não depender da data real da execução para aprovar um teste.

## Dados de teste

- Usar nomes, e-mails, contas, cartões e valores inteiramente fictícios.
- Não copiar dados da planilha de referência nem de ambientes reais.
- Manter conjuntos mínimos que tornem a regra auditável.
- Remover ou anonimizar conteúdo sensível de logs e capturas.
- Documentar geradores ou massas reutilizáveis quando forem definidos após a arquitetura.

## Relação com critérios de aceite

Cada critério de aceite deve indicar:

- nível ou níveis de teste aplicáveis;
- cenário positivo, limites e falhas relevantes;
- dados fictícios necessários;
- evidência esperada;
- justificativa quando não puder ser automatizado.

Critérios automatizáveis devem ser vinculados a testes rastreáveis. A aceitação humana deve se concentrar em adequação do comportamento, conteúdo, usabilidade e riscos que não possam ser comprovados somente por automação.

## Evidências e reporte

O pull request deve registrar:

- comandos executados;
- resultado de cada nível aplicável;
- testes não executados e justificativa;
- ambiente e versão/commit;
- evidências sanitizadas;
- limitações e riscos residuais.

## Complementação após ADRs

Quando existirem ADRs de arquitetura, complementar este documento com ferramentas, estrutura de diretórios, ambientes, dados de teste, cobertura, execução em CI e critérios de desempenho. Nenhuma escolha tecnológica deve ser antecipada nesta fundação documental.


