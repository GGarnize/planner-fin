# Definition of Done

## Como usar

Esta Definition of Done define os critérios mínimos de passagem entre etapas. Cada item deve ser marcado como atendido ou como **“Não aplicável”**, sempre com justificativa e evidência quando pertinente. A SPEC pode acrescentar critérios, mas não reduzir requisitos obrigatórios sem decisão humana registrada.

## 1. Pronto para implementar

- [ ] A investigação necessária foi concluída e suas evidências estão referenciadas.
- [ ] A SPEC está aprovada por uma pessoa autorizada.
- [ ] O comportamento atual foi distinguido do comportamento desejado.
- [ ] Objetivo, fora do escopo, regras e critérios de aceite estão claros e verificáveis.
- [ ] Dúvidas que alteram comportamento, escopo, dados, segurança ou dependências estão resolvidas.
- [ ] Arquivos permitidos e proibidos estão registrados.
- [ ] Dependências novas estão identificadas e justificadas.
- [ ] Riscos, estratégia de rollback e compatibilidade foram avaliados.
- [ ] Impactos de segurança, privacidade, acessibilidade, dados e migrations foram avaliados.
- [ ] Testes obrigatórios e evidências esperadas estão definidos.
- [ ] A branch foi criada da `main` atualizada conforme o fluxo Git.

## 2. Implementação concluída

- [ ] A implementação respeita a SPEC e não inclui alterações fora do escopo.
- [ ] Necessidades não previstas foram tratadas por decisão/revisão explícita da SPEC.
- [ ] Lint foi executado e aprovado, quando aplicável.
- [ ] Typecheck foi executado e aprovado, quando aplicável.
- [ ] Testes unitários foram criados/atualizados e aprovados, quando aplicável.
- [ ] Testes de integração foram criados/atualizados e aprovados, quando aplicável.
- [ ] Testes de contrato foram criados/atualizados e aprovados, quando aplicável.
- [ ] Testes E2E foram criados/atualizados e aprovados, quando aplicável.
- [ ] Build foi executado e aprovado, quando aplicável.
- [ ] Migrations foram criadas e testadas sem editar migrations já aplicadas, quando aplicável.
- [ ] Requisitos de segurança e autorização foram verificados.
- [ ] Requisitos de privacidade e retenção foram verificados.
- [ ] Requisitos de acessibilidade foram verificados.
- [ ] Documentação técnica e funcional foi atualizada.
- [ ] Evidências dos testes e verificações estão anexadas ou referenciadas.
- [ ] Teste manual do autor foi executado nos fluxos aplicáveis.
- [ ] Não há credenciais, segredos, tokens, dados pessoais ou dados financeiros reais em código, testes, logs ou evidências.

## 3. Pronto para merge

- [ ] O pull request está restrito à unidade de trabalho e lista todos os arquivos alterados.
- [ ] O diff não contém arquivos gerados ou alterações inesperadas.
- [ ] A implementação recebeu revisão independente.
- [ ] Todos os comentários bloqueantes foram resolvidos.
- [ ] Os critérios de aceite foram automatizados quando viável e todos foram verificados.
- [ ] As verificações automatizadas aplicáveis estão aprovadas.
- [ ] O teste de aceitação humano foi concluído e registrado.
- [ ] Riscos residuais e limitações estão visíveis no pull request.
- [ ] Plano de rollback está executável e compatível com eventuais migrations.
- [ ] Documentação e evidências estão completas.
- [ ] A branch está compatível com a `main` atual ou qualquer divergência foi aceita explicitamente.
- [ ] Uma pessoa autorizou o merge.
- [ ] O agente confirmou que não realizou o merge.

## 4. Pronto para release

- [ ] O merge aprovado está presente na branch de release aplicável.
- [ ] O conjunto de mudanças da release é conhecido e rastreável a SPECs/pull requests.
- [ ] Testes de regressão e aceitação aplicáveis foram aprovados no ambiente de release.
- [ ] Build/artefato de release foi gerado de forma reproduzível, quando aplicável.
- [ ] Migrations foram validadas no fluxo de implantação e possuem recuperação definida.
- [ ] Segurança, privacidade e acessibilidade foram reavaliadas no contexto da release.
- [ ] Observabilidade, alertas e suporte operacional estão preparados, quando aplicável.
- [ ] Documentação de operação, usuário e release está atualizada.
- [ ] Riscos conhecidos, limitações e rollback foram comunicados.
- [ ] Não há credenciais ou dados pessoais/financeiros indevidos no artefato ou nas evidências.
- [ ] A aprovação humana para release foi registrada.


