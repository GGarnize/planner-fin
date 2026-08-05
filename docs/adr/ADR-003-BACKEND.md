# ADR-003 — Backend

## Status

Aprovado

## Data

2026-08-05

## Contexto

O PlannerFin precisa concentrar regras financeiras autoritativas em uma API determinística, modular e testável. A pesquisa técnica avaliou opções de backend TypeScript e destacou a adequação de um monólito modular para o início.

## Problema

É necessário definir a tecnologia e a organização inicial do backend sem criar código, filas, serviços separados ou infraestrutura prematura.

## Decisão

Adotar NestJS com TypeScript, usando inicialmente o adaptador HTTP padrão do NestJS. O backend será um monólito modular organizado por domínio. O scaffold inicial não deve incluir filas, Redis ou microserviços; essas capacidades somente poderão ser adicionadas por necessidade aprovada.

## Justificativa

NestJS fornece uma estrutura modular explícita, adequada para separar domínios financeiros e manter testes de regras, módulos e API. TypeScript favorece contratos internos tipados. O adaptador HTTP padrão reduz decisões operacionais iniciais. Evitar filas e serviços separados preserva simplicidade até que haja requisito real.

## Alternativas consideradas

- Fastify desde o início: adiado; poderá ser avaliado se houver requisito comprovado de desempenho, compatibilidade ou operação que justifique a troca do adaptador.
- Filas e Redis no scaffold inicial: rejeitados por ausência de necessidade aprovada.
- Microserviços no backend inicial: rejeitados por complexidade prematura.
- Backend sem framework modular: rejeitado por reduzir padronização e previsibilidade para evolução por domínio.

## Consequências positivas

- Organização clara por módulos de domínio.
- Regras financeiras podem ser isoladas e testadas.
- Menor complexidade operacional inicial.
- Evolução compatível com TypeScript no cliente e em pacotes compartilhados quando necessários.

## Consequências negativas

- O desempenho do adaptador padrão pode precisar de revisão em cenários futuros.
- Operações longas ou assíncronas precisarão de nova decisão antes de filas.
- A modularidade dependerá de disciplina nas SPECs e revisões.

## Riscos

- Módulos podem expor dependências internas indevidas se os limites de domínio não forem documentados.
- Adicionar filas tardiamente pode exigir ajustes em casos de uso que nascerem síncronos.
- Uso inadequado de recursos globais do framework pode dificultar testes isolados.

## Condições de revisão

Revisar esta ADR se houver métricas que justifiquem Fastify, necessidade comprovada de processamento assíncrono com filas, integração externa resiliente, carga incompatível com o monólito modular ou separação de serviços por requisito operacional aprovado.

## Impacto nas próximas SPECs

As SPECs devem definir módulos por domínio, manter operações financeiras autoritativas no backend e justificar explicitamente qualquer necessidade de filas, Redis, Fastify ou serviços separados.

## Referências à pesquisa técnica

- `docs/research/TECHNICAL-ARCHITECTURE-EVALUATION.md`, especialmente as seções de backend, monólito modular e complexidade operacional inicial.
