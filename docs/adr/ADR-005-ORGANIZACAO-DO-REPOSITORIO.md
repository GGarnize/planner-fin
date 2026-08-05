# ADR-005 — Organização do repositório

## Status

Aprovado

## Data

2026-08-05

## Contexto

A arquitetura aprovada prevê cliente, API e possíveis pacotes compartilhados. O repositório deve permitir evolução incremental sem introduzir ferramenta de orquestração antes de necessidade concreta.

## Problema

É necessário definir a organização inicial candidata do repositório sem criar aplicações, `package.json`, dependências, CI ou scaffold.

## Decisão

Adotar monorepo pnpm simples, sem Nx e sem Turborepo inicialmente. A estrutura candidata será:

```text
apps/
  api/
  web/

packages/
  shared/
  config/
```

Os comandos devem ser centralizados na raiz quando o scaffold existir. Contratos compartilhados serão criados somente quando houver necessidade concreta. Deve-se evitar pacote genérico de utilitários sem domínio claro.

## Justificativa

Um monorepo simples facilita coordenação entre cliente, API e pacotes TypeScript sem adicionar orquestração prematura. pnpm workspace atende à organização inicial esperada. Evitar pacotes genéricos reduz acoplamento e abstrações sem domínio.

## Alternativas consideradas

- Repositórios separados: rejeitado por aumentar coordenação inicial entre cliente e API.
- Nx desde o início: rejeitado por adicionar complexidade sem necessidade aprovada.
- Turborepo desde o início: rejeitado por adicionar camada de orquestração antes de demanda concreta.
- Pacote genérico de utilitários: rejeitado por risco de dependências difusas e ausência de fronteira de domínio.

## Consequências positivas

- Estrutura simples e previsível.
- Menor custo de configuração inicial.
- Espaço claro para API, web e pacotes compartilhados.
- Possibilidade futura de adoção de ferramenta de orquestração com critérios objetivos.

## Consequências negativas

- Sem Nx ou Turborepo, recursos avançados de cache e orquestração não estarão disponíveis inicialmente.
- Comandos centralizados precisarão ser bem definidos no scaffold futuro.
- Pacotes compartilhados exigirão disciplina para não antecipar contratos desnecessários.

## Riscos

- Crescimento do monorepo pode tornar comandos lentos sem orquestração futura.
- `packages/shared` pode acumular utilidades genéricas se não houver governança.
- Dependências entre apps e packages podem ficar acopladas se contratos forem criados cedo demais.

## Condições de revisão

Revisar esta ADR se o monorepo apresentar lentidão relevante, necessidade de cache remoto, graph de tarefas, múltiplas equipes com fronteiras complexas, builds independentes frequentes ou volume de pacotes que justifique Nx, Turborepo ou ferramenta equivalente.

## Impacto nas próximas SPECs

SPECs de scaffold devem criar apenas a estrutura aprovada, centralizar comandos na raiz, justificar qualquer pacote compartilhado e não adicionar Nx ou Turborepo sem nova decisão aprovada.

## Referências à pesquisa técnica

- `docs/research/TECHNICAL-ARCHITECTURE-EVALUATION.md`, especialmente as seções de organização de repositório, monorepo simples e ferramentas de orquestração.
