# ADR-004 — Persistência e acesso a dados

## Status

Aprovado

## Data

2026-08-05

## Contexto

O domínio financeiro exige precisão monetária, integridade relacional, rastreabilidade e transações para operações compostas. A pesquisa técnica avaliou persistência relacional e ferramentas de acesso a dados para a arquitetura inicial.

## Problema

É necessário registrar a estratégia inicial de banco, migrations e acesso a dados sem criar banco, schema Prisma, migrations ou código.

## Decisão

Adotar PostgreSQL como banco principal e Prisma como ferramenta inicial de acesso a dados e migrations. Valores monetários nunca devem ser armazenados como ponto flutuante. Operações financeiras compostas devem usar transações. A integridade referencial deve ser preservada no banco. Migrations já aplicadas nunca podem ser editadas. SQL direto controlado poderá ser usado quando uma necessidade comprovada não for bem atendida pelo Prisma.

## Justificativa

PostgreSQL atende ao requisito de banco relacional e integridade. Prisma oferece fluxo inicial tipado para acesso a dados e migrations. Restringir ponto flutuante evita erros de precisão monetária. Transações e integridade referencial no banco reduzem risco de inconsistência financeira.

## Alternativas consideradas

- Banco não relacional como principal: rejeitado por não atender tão diretamente à necessidade relacional inicial.
- Armazenar valores monetários em ponto flutuante: rejeitado por risco de imprecisão.
- SQL manual como padrão exclusivo: rejeitado inicialmente por menor padronização e maior custo de manutenção.
- Editar migrations aplicadas: rejeitado por comprometer rastreabilidade e reprodutibilidade.

## Consequências positivas

- Maior segurança para relações financeiras e consistência transacional.
- Evolução de schema rastreável por migrations.
- Acesso a dados tipado no início.
- Possibilidade de SQL direto controlado quando houver justificativa técnica.

## Consequências negativas

- Prisma pode não atender todos os casos avançados de consulta ou otimização.
- Transações exigirão desenho cuidadoso nas operações compostas.
- Mudanças estruturais precisarão seguir disciplina rígida de migrations.

## Riscos

- Escolha inadequada do tipo monetário ou regra de arredondamento em SPEC futura pode comprometer cálculos.
- Consultas complexas podem exigir SQL direto e revisão adicional.
- Falhas em limites transacionais podem gerar saldos inconsistentes ou dupla contagem.

## Condições de revisão

Revisar esta ADR se Prisma limitar uma necessidade comprovada, se houver requisito de múltiplos bancos, se surgirem demandas de performance não resolvidas por modelagem e índices, ou se uma regra financeira exigir abordagem diferente de persistência.

## Impacto nas próximas SPECs

SPECs que alterem estrutura de dados devem prever migrations, tipos monetários seguros, transações para operações compostas, integridade referencial e testes de integração do banco. SQL direto deve ser justificado e controlado.

## Referências à pesquisa técnica

- `docs/research/TECHNICAL-ARCHITECTURE-EVALUATION.md`, especialmente as seções sobre persistência, banco relacional, Prisma, precisão monetária e transações.
