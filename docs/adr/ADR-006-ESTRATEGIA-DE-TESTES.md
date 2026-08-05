# ADR-006 — Estratégia de testes

## Status

Aprovado

## Data

2026-08-05

## Contexto

A estratégia de qualidade do PlannerFin prioriza testes determinísticos, dados fictícios, prevenção de dupla contagem, precisão monetária e rastreabilidade de evidências. Com as decisões técnicas iniciais, é necessário registrar ferramentas preferenciais e níveis de teste sem criar configuração ou CI.

## Problema

É necessário alinhar a arquitetura inicial à pirâmide de testes e orientar a SPEC-000 sem antecipar implementação.

## Decisão

Adotar uma pirâmide de testes com prioridade para testes unitários de regras financeiras, testes de integração para banco e módulos, testes de contrato para API quando aplicável e testes E2E dos fluxos principais. Vitest será a base preferencial no frontend e em pacotes TypeScript. O backend usará ferramentas nativas ou recomendadas do NestJS, compatíveis com a configuração escolhida. Playwright será usado para E2E web. A estratégia mobile complementar será definida quando os fluxos Android existirem. Dados de teste devem ser sempre fictícios.

## Justificativa

Regras financeiras exigem validação rápida e precisa em testes unitários. Integração com banco é essencial para transações, integridade e persistência. Contratos protegem a fronteira HTTP entre cliente e API. E2E deve cobrir fluxos críticos sem substituir testes mais específicos. Vitest e Playwright se alinham ao ecossistema TypeScript e web aprovado.

## Alternativas consideradas

- Priorizar E2E como principal garantia: rejeitado por ser mais lento, frágil e insuficiente para cálculos financeiros detalhados.
- Não definir ferramenta preferencial no frontend: rejeitado por reduzir previsibilidade para SPEC-000.
- Escolher estratégia mobile completa agora: rejeitado porque os fluxos Android ainda não existem.
- Usar dados reais ou copiados de fontes pessoais: rejeitado por segurança e privacidade.

## Consequências positivas

- Regras financeiras terão cobertura prioritária e rápida.
- Integração com banco será validada nos pontos de maior risco.
- Fronteiras HTTP poderão ser protegidas por contratos quando aplicável.
- E2E web cobrirá fluxos principais com dados sintéticos.

## Consequências negativas

- A estratégia mobile ainda exigirá detalhamento futuro.
- Ferramentas específicas do backend dependerão da configuração NestJS definida no scaffold.
- Manter dados sintéticos realistas exigirá disciplina e documentação.

## Riscos

- Falta de testes unitários financeiros pode permitir erros de saldo, arredondamento ou dupla contagem.
- Testes de integração sem isolamento adequado podem ser instáveis.
- E2E em excesso pode tornar validações lentas.
- Dados de teste inadequados podem vazar informações sensíveis ou mascarar cenários críticos.

## Condições de revisão

Revisar esta ADR se o scaffold técnico escolher configuração incompatível com as ferramentas preferenciais, se fluxos Android demandarem ferramenta mobile específica, se contratos de API exigirem abordagem formal adicional ou se riscos financeiros indicarem novos níveis de validação.

## Impacto nas próximas SPECs

A SPEC-000 deve detalhar comandos, estrutura de testes, dados sintéticos, ambientes, integração de banco, contratos quando aplicáveis, critérios E2E web e critérios para definir estratégia mobile futura.

## Referências à pesquisa técnica

- `docs/research/TECHNICAL-ARCHITECTURE-EVALUATION.md`, especialmente as seções de testes e adequação das ferramentas ao ecossistema escolhido.
- `docs/quality/TEST-STRATEGY.md`, especialmente os princípios, níveis de teste, matriz mínima do domínio financeiro e dados de teste.
