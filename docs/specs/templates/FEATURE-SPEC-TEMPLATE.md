# SPEC de funcionalidade — `<ID> — <Título>`

> Preencha todas as seções. Quando uma seção não se aplicar, registre **“Não aplicável”** e a justificativa. Não exclua seções silenciosamente.

## 1. Identificação

| Campo | Valor |
|---|---|
| ID | `<SPEC-NNN>` |
| Título | `<título>` |
| Responsável | `<nome>` |
| Data de criação | `<AAAA-MM-DD>` |
| Última atualização | `<AAAA-MM-DD>` |
| Tarefa relacionada | `<link ou identificador>` |
| Documentos relacionados | `<AS-IS, ADRs, outras SPECs>` |

## 2. Status

`Rascunho | Em revisão | Aprovada | Em implementação | Em validação | Concluída | Substituída | Cancelada`

**Aprovada por:** `<nome e data, ou pendente>`

## 3. Contexto

Descreva o cenário, as evidências e as decisões anteriores necessárias para compreender a mudança.

## 4. Problema

Explique o problema verificável, quem é afetado e por que o estado atual é insuficiente. Não antecipe a solução sem necessidade.

## 5. Objetivo

Declare o resultado mensurável que esta SPEC pretende alcançar.

## 6. Fora do escopo

- `<comportamento, integração ou arquivo explicitamente excluído>`

## 7. Termos

| Termo | Definição adotada nesta SPEC |
|---|---|
| `<termo>` | `<definição>` |

## 8. Comportamento atual

Documente somente fatos confirmados. Referencie pesquisas AS-IS quando existirem e identifique hipóteses separadamente.

## 9. Comportamento desejado

Descreva o comportamento TO-BE de forma inequívoca, incluindo entradas, processamento, saídas e efeitos observáveis.

## 10. Personas ou atores

| Ator | Necessidade | Ações autorizadas |
|---|---|---|
| `<ator>` | `<necessidade>` | `<ações>` |

## 11. Fluxos

### 11.1 Fluxo principal

1. `<passo>`
2. `<passo>`

### 11.2 Fluxos alternativos e exceções

- `<condição>` → `<comportamento>`

## 12. Regras de negócio

| ID | Regra | Origem/decisão | Exemplo |
|---|---|---|---|
| `RN-01` | `<regra verificável>` | `<fonte>` | `<exemplo>` |

## 13. Modelo de dados

Descreva entidades, atributos, identificadores, relacionamentos, nulabilidade, unicidade, precisão monetária e retenção. Não escolha tecnologia sem ADR aprovado.

| Entidade | Campo | Tipo conceitual | Obrigatório | Regra |
|---|---|---|---|---|
| `<entidade>` | `<campo>` | `<texto, dinheiro, data...>` | `Sim/Não` | `<restrição>` |

## 14. Contratos de API

Para cada operação, informe intenção, entrada, saída, erros, autorização, idempotência e versionamento. Se não houver API, marque “Não aplicável” e justifique.

### `<operação>`

- Entrada: `<contrato>`
- Saída de sucesso: `<contrato>`
- Erros: `<códigos e condições>`
- Autorização: `<regra>`
- Idempotência: `<regra>`

## 15. Interface

Descreva estados, conteúdo, navegação, responsividade e evidências visuais aprovadas. Não escolha framework nesta seção.

## 16. Validações

| Campo ou ação | Validação | Mensagem/resultado esperado |
|---|---|---|
| `<campo>` | `<regra>` | `<resultado>` |

## 17. Permissões

| Ação | Ator autorizado | Condição | Comportamento quando negado |
|---|---|---|---|
| `<ação>` | `<ator>` | `<condição>` | `<resultado>` |

## 18. Segurança e privacidade

- Dados sensíveis ou pessoais envolvidos: `<lista ou Não aplicável>`
- Ameaças relevantes: `<lista>`
- Proteções exigidas: `<autorização, validação, criptografia, retenção...>`
- Dados proibidos em logs/evidências: `<lista>`

## 19. Erros e estados vazios

| Situação | Estado apresentado | Recuperação esperada |
|---|---|---|
| `<sem dados, erro, indisponibilidade...>` | `<comportamento>` | `<ação possível>` |

## 20. Observabilidade

Defina eventos, métricas, logs e alertas necessários, sem registrar credenciais, dados pessoais ou financeiros sensíveis.

## 21. Migração e compatibilidade

- Dados existentes: `<tratamento>`
- Compatibilidade retroativa: `<regra>`
- Migração necessária: `<sim/não e detalhes>`
- Implantação gradual: `<estratégia ou Não aplicável>`

## 22. Critérios de aceite

Escreva critérios objetivos no formato Dado/Quando/Então.

### `CA-01 — <título>`

**Dado** `<contexto inicial>`  
**Quando** `<ação ou evento>`  
**Então** `<resultado observável>`

### `CA-02 — <título>`

**Dado** `<contexto inicial>`  
**Quando** `<ação ou evento>`  
**Então** `<resultado observável>`

## 23. Testes obrigatórios

| Nível | Cenários mínimos | Critérios relacionados | Evidência esperada |
|---|---|---|---|
| Unitário | `<cenários>` | `<CA/RN>` | `<resultado>` |
| Integração | `<cenários>` | `<CA/RN>` | `<resultado>` |
| Contrato | `<cenários ou Não aplicável>` | `<CA/RN>` | `<resultado>` |
| E2E | `<cenários ou Não aplicável>` | `<CA>` | `<resultado>` |
| Aceitação manual | `<cenários>` | `<CA>` | `<evidência>` |

## 24. Arquivos permitidos

- `<caminho ou padrão autorizado>`

## 25. Arquivos proibidos

- `<caminho ou padrão que não pode ser alterado>`

## 26. Dependências

| Dependência | Motivo | Estado da aprovação | Impacto |
|---|---|---|---|
| `<dependência>` | `<justificativa>` | `<aprovada/pendente>` | `<impacto>` |

## 27. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| `<risco>` | `<baixa/média/alta>` | `<efeito>` | `<ação>` |

## 28. Rollback

Descreva gatilhos, passos, efeito sobre dados e forma de validar a reversão.

## 29. Dúvidas

| ID | Dúvida | Impacto | Responsável | Estado |
|---|---|---|---|---|
| `D-01` | `<pergunta>` | `<o que bloqueia>` | `<nome>` | `Aberta/Resolvida` |

Nenhuma dúvida que altere comportamento, escopo ou segurança pode permanecer aberta no momento da aprovação.

## 30. Decisões aprovadas

| Data | Decisão | Responsável pela aprovação | Consequência |
|---|---|---|---|
| `<AAAA-MM-DD>` | `<decisão>` | `<nome>` | `<efeito>` |

## 31. Definition of Done específica

Além da [Definition of Done do projeto](../../quality/DEFINITION-OF-DONE.md), esta SPEC exige:

- [ ] `<condição específica>`
- [ ] Todos os critérios de aceite foram atendidos.
- [ ] As evidências obrigatórias foram anexadas.

## 32. Histórico de alterações da SPEC

| Data | Alteração | Motivo | Autor | Aprovador, quando aplicável |
|---|---|---|---|---|
| `<AAAA-MM-DD>` | `<alteração>` | `<motivo>` | `<nome>` | `<nome ou pendente>` |


