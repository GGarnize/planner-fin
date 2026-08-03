# SPEC de correção — `<ID> — <Título>`

> Preencha todas as seções. Quando uma seção não se aplicar, registre **“Não aplicável”** e a justificativa. Hipótese e causa confirmada devem permanecer separadas.

## 1. Identificação e status

| Campo | Valor |
|---|---|
| ID | `<BUG-NNN>` |
| Título | `<título>` |
| Status | `Rascunho | Em investigação | Em revisão | Aprovada | Em correção | Em validação | Concluída` |
| Responsável | `<nome>` |
| Data | `<AAAA-MM-DD>` |
| Ambiente afetado | `<ambiente/versão>` |
| Tarefa relacionada | `<link ou identificador>` |

## 2. Comportamento observado

Descreva apenas o que foi reproduzido ou demonstrado por evidência.

## 3. Comportamento esperado

Descreva o resultado correto e sua fonte: SPEC aprovada, regra de negócio, decisão ou expectativa validada pelo proprietário.

## 4. Evidências

- Logs sanitizados: `<link ou Não aplicável>`
- Capturas: `<link ou Não aplicável>`
- Dados mínimos de exemplo: `<dados fictícios>`
- Comparação observada/esperada: `<resumo>`

Não incluir credenciais, dados pessoais ou informações financeiras reais.

## 5. Impacto

- Usuários/fluxos afetados: `<descrição>`
- Consequência financeira ou operacional: `<descrição>`
- Severidade: `<baixa/média/alta/crítica e justificativa>`

## 6. Frequência

`Sempre | Intermitente | Evento único | Desconhecida`

Detalhes: `<taxa observada, período ou condição>`

## 7. Ambiente

| Item | Valor |
|---|---|
| Versão/commit | `<valor>` |
| Sistema/navegador | `<valor>` |
| Configuração relevante | `<valor sanitizado>` |
| Data e fuso | `<valor>` |

## 8. Passos de reprodução

### Pré-condições

- `<condição>`

### Passos

1. `<passo>`
2. `<passo>`

### Resultado reproduzido

`<resultado>`

## 9. Causa confirmada ou hipóteses

### 9.1 Causa confirmada

`<causa demonstrada por evidência, ou “Ainda não confirmada”>`

Evidência que confirma a causa: `<referência>`

### 9.2 Hipóteses ainda não confirmadas

| Hipótese | Evidência favorável | Evidência contrária | Como confirmar ou refutar |
|---|---|---|---|
| `<hipótese>` | `<evidência>` | `<evidência>` | `<investigação>` |

Uma hipótese nunca deve ser apresentada como causa confirmada. Se a causa não estiver confirmada, a correção só pode prosseguir quando o escopo de investigação/mitigação estiver explicitamente autorizado.

## 10. Investigação necessária

- `<verificação, experimento ou dado necessário>`

## 11. Escopo autorizado

### Incluído

- `<alteração autorizada>`

### Excluído

- `<alteração não autorizada>`

### Arquivos permitidos

- `<caminho>`

### Arquivos proibidos

- `<caminho>`

## 12. Regressões a evitar

- `<comportamento que deve permanecer inalterado>`

## 13. Critérios de aceite

### `CA-01 — <título>`

**Dado** `<contexto>`  
**Quando** `<ação>`  
**Então** `<resultado corrigido>`

### `CA-02 — Não regressão`

**Dado** `<fluxo existente>`  
**Quando** `<ação>`  
**Então** `<comportamento preservado>`

## 14. Testes de regressão

| Nível | Cenário | Falhava antes? | Resultado esperado |
|---|---|---|---|
| Unitário | `<cenário>` | `Sim/Não` | `<resultado>` |
| Integração | `<cenário ou Não aplicável>` | `Sim/Não` | `<resultado>` |
| Contrato | `<cenário ou Não aplicável>` | `Sim/Não` | `<resultado>` |
| E2E | `<cenário ou Não aplicável>` | `Sim/Não` | `<resultado>` |
| Aceitação manual | `<cenário>` | `Sim/Não` | `<resultado>` |

## 15. Riscos e dependências

| Item | Impacto | Mitigação/estado |
|---|---|---|
| `<risco ou dependência>` | `<impacto>` | `<ação>` |

## 16. Rollback

- Gatilho: `<quando reverter>`
- Passos: `<como reverter>`
- Dados afetados: `<efeito e recuperação>`
- Validação: `<como confirmar o rollback>`

## 17. Dúvidas e decisões

| Data | Tipo | Registro | Responsável | Estado |
|---|---|---|---|---|
| `<AAAA-MM-DD>` | `Dúvida/Decisão` | `<conteúdo>` | `<nome>` | `<aberta/aprovada>` |


