# ADR-001 — Arquitetura geral

## Status

Aprovado

## Data

2026-08-05

## Contexto

O PlannerFin é um sistema financeiro pessoal, inicialmente online-first, com domínio financeiro determinístico e evolução incremental. A pesquisa técnica ARCH-001 avaliou alternativas considerando Android e web no MVP, banco relacional, ausência de necessidade inicial de microserviços e necessidade de regras financeiras testáveis.

## Problema

É necessário registrar a arquitetura técnica inicial sem criar aplicação, dependências ou infraestrutura, estabelecendo fronteiras suficientes para orientar as próximas SPECs e evitar decisões implícitas.

## Decisão

Adotar monólito modular, com aplicação cliente separada da API e comunicação por API HTTP. O núcleo financeiro deve ser determinístico, independente de IA para operações centrais, online-first e sem microserviços no início.

## Justificativa

O monólito modular reduz complexidade operacional inicial e mantém fronteiras internas por domínio. A separação entre cliente e API preserva a evolução independente das interfaces e concentra regras autoritativas no backend. HTTP é suficiente para os fluxos iniciais. A ausência de IA no núcleo financeiro evita resultados não determinísticos em saldos, consolidações e validações.

## Alternativas consideradas

- Microserviços desde o início: rejeitado por adicionar distribuição, observabilidade e operação sem necessidade aprovada.
- Aplicação cliente acoplada ao backend sem fronteira HTTP clara: rejeitada por dificultar web, Android e evolução de contratos.
- Arquitetura offline-first inicial: rejeitada por ampliar escopo de sincronização antes de necessidade aprovada.
- Uso de IA em operações centrais: rejeitado para preservar determinismo financeiro.

## Consequências positivas

- Menor custo operacional inicial.
- Fronteiras de domínio podem evoluir sem distribuição prematura.
- Regras financeiras permanecem testáveis e auditáveis.
- Cliente web e Android podem consumir a mesma API.

## Consequências negativas

- Escalabilidade horizontal por serviço não estará disponível no início.
- O monólito exigirá disciplina para evitar acoplamento excessivo entre módulos.
- Recursos offline avançados dependerão de decisões futuras.

## Riscos

- Módulos podem se misturar se as próximas SPECs não definirem responsabilidades claras.
- Contratos HTTP podem ser instáveis se forem compartilhados antes de necessidade concreta.
- Requisitos futuros de sincronização podem exigir revisão da estratégia online-first.

## Condições de revisão

Revisar esta ADR se houver necessidade comprovada de operação offline-first, integração assíncrona crítica, escala incompatível com monólito modular, separação organizacional por serviços ou requisitos que alterem a fronteira cliente/API.

## Impacto nas próximas SPECs

As próximas SPECs devem preservar módulos por domínio, manter regras financeiras no backend, definir contratos HTTP explícitos quando necessário e não introduzir microserviços ou IA em operações centrais sem nova decisão aprovada.

## Referências à pesquisa técnica

- `docs/research/TECHNICAL-ARCHITECTURE-EVALUATION.md`, especialmente as seções sobre restrições arquiteturais, backend, persistência e recomendação de monólito modular.
