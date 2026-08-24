# Investigação de Orçamento mobile e erro “Dados inválidos”

## 1. Resumo executivo

Esta investigação é **AS-IS** e não autoriza correção funcional. A base analisada foi a `main` no commit `43e3e38`, após o merge da PR #112, em ambiente local Windows com PostgreSQL, API/Web, Playwright e AVD `Pixel_7_Pro`.

Conclusões objetivas:

- O erro observado em 20/08/2026 com a mensagem exata **“Dados inválidos.”** não foi reproduzido pelo fluxo atual da tela com valores válidos. O frontend atual enviou `"5000.50"` e a API respondeu `200`/`201` na Web e no WebView Android.
- A mensagem nasce na `ValidationPipe` global do Nest, em `apps/api/src/main.ts`, antes de `BudgetsService`, Prisma ou qualquer regra financeira.
- O erro é reproduzível por contrato quando `totalLimit` chega como string localizada (`"5.000,50"`) ou número JSON (`5000.50`). Ambos retornaram `400`, `VALIDATION_ERROR`, `Dados inválidos.` e detalhe no campo `totalLimit`.
- A causa histórica foi confirmada pelo Git: antes de `7c2726c` a tela enviava `form.totalLimit` sem normalização. O commit de 21/08/2026 passou a usar `normalizeMoney`, adicionou validação local e cobriu entradas pt-BR. A nota de 20/08 e a auditoria posterior descrevem, portanto, um sintoma anterior ao código atual.
- Não foi identificado bug de regra de negócio no salvamento válido. Create e PATCH canônicos funcionaram e preservaram o contrato monetário em string com duas casas.
- Há uma falha atual diferente no contrato de erro de categorias: validação aninhada retorna `details: []`, porque a fábrica global lê apenas `error.constraints` do primeiro nível e não percorre `error.children`. O frontend espera `field === 'categories'`, mas não recebe esse detalhe.
- O mobile não apresenta overflow horizontal nos quatro viewports pedidos, mas é desconfortável e excessivamente vertical. Em 360 px, a linha de categoria reserva 64 px à direita mesmo com o FAB oculto, reduzindo o conteúdo útil medido para aproximadamente 178 px.
- O FAB é ocultado por CSS específico de Orçamento. A exceção foi adicionada no mesmo commit de UX mobile, não aparece como decisão de produto e contradiz o CA-02 da SPEC-013. É um workaround/dívida técnica; removê-lo isoladamente pode reintroduzir sobreposição.
- Durante edição, a bottom navigation também é ocultada, mas o shell continua reservando 148 px de padding inferior no AVD. O CTA não é sticky. Em viewport browser reduzido a 360×480, começou abaixo da área visível, mas permaneceu alcançável por scroll.
- No AVD, o IME disponível em modo de teclado físico/acessório manteve o CTA visível por margem pequena. O primeiro Back fechou o IME e preservou a edição. Um Back sem IME aberto voltou ao Dashboard e descartou o rascunho sem confirmação.
- Não houve teste em aparelho físico nem com teclado virtual completo ocupando a metade inferior. Isso permanece não verificável nesta rodada.
- A correção não deve ser uma única implementação: contrato de erros, layout/formulário e decisão do shell/FAB têm causas, riscos e critérios de aceite distintos.

## 2. Sintomas investigados

| Sintoma | Estado atual | Camada principal |
|---|---|---|
| “Dados inválidos” ao salvar valor válido pela tela | Não reproduzido na `main` atual | Histórico de frontend/normalização |
| “Dados inválidos” com `"5.000,50"` enviado diretamente | Reproduzido | Contrato/DTO/API |
| “Dados inválidos” com `5000.50` como número JSON | Reproduzido | Contrato/DTO/API |
| Erro aninhado de categoria sem indicação de campo | Reproduzido | Formatação global de validação |
| Layout espremido em mobile | Reproduzido | CSS de Orçamento |
| Overflow horizontal | Não reproduzido | Layout |
| Cards/lista excessivamente altos | Reproduzido | UX/densidade |
| FAB ausente em Orçamento | Reproduzido por código e runtime | Acoplamento página/shell |
| Bottom nav ausente durante edição | Reproduzido por código e runtime | Acoplamento página/shell |
| CTA coberto por teclado virtual completo | Não verificável | WebView/IME |
| Back fecha teclado sem perder edição | Reproduzido no AVD | Android/WebView |
| Back sem teclado descarta edição | Reproduzido no AVD | Android/WebView/roteamento |

Os sintomas não compartilham uma única causa. A rejeição de payload é independente do espaçamento mobile; FAB/bottom nav são exceções de shell; Back e teclado dependem do runtime Android.

## 3. Passos de reprodução

### 3.1 Fluxo atual válido — Web/API local

Dados sintéticos:

- usuário criado por `pnpm dev:seed-test-user`;
- mês de criação isolado: `2035-12`;
- limite: `5000.00` na criação e `5000.50` no PATCH;
- notas: `null`;
- categorias: `[]`.

Passos:

1. Subir PostgreSQL, aplicar migrations e iniciar API/Web.
2. Fazer login real pela fixture local.
3. Enviar criação canônica:

```json
{"month":"2035-12","totalLimit":"5000.00","notes":null,"categories":[]}
```

4. Editar o recurso com:

```json
{"totalLimit":"5000.50","notes":null,"categories":[]}
```

Resultado: create `201`; PATCH `200`; nenhum “Dados inválidos”.

### 3.2 Payload localizado enviado diretamente

```json
{"totalLimit":"5.000,50","notes":null,"categories":[]}
```

Resposta observada:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos.",
    "details": [{ "field": "totalLimit", "message": "..." }]
  }
}
```

Status: `400`. O DTO exige string canônica `X.YY`; não houve entrada no serviço.

### 3.3 Número JSON enviado diretamente

```json
{"totalLimit":5000.50,"notes":null,"categories":[]}
```

Resultado: `400 VALIDATION_ERROR`, `Dados inválidos.`, campo `totalLimit`.

### 3.4 Categoria aninhada inválida

Payload sanitizado:

```json
{
  "totalLimit": "5000.50",
  "notes": null,
  "categories": [
    { "categoryId": "<uuid-v4-sintético>", "limitAmount": "1.200,00" }
  ]
}
```

Resultado observado:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos.",
    "details": []
  }
}
```

Status: `400`. A rejeição é correta; a ausência do caminho/campo aninhado é a falha.

### 3.5 Matriz Playwright

O teste `apps/web/e2e/budgets-mobile-reproduction.spec.ts` usa dados inteiramente sintéticos e mocks de fronteira. Em um único cenário diagnóstico ele cobre estado vazio, lista com categoria, payload de criação e viewport reduzido.

Passos principais:

1. Abrir `/budgets` em 360×800, 390×844, 768×1024 e 1440×900.
2. Medir `scrollWidth`, dimensões da linha/conteúdo, FAB e bottom nav.
3. Abrir criação em 360×800 e preencher `5.000,50`.
4. Reduzir o viewport para 360×480 como aproximação de teclado.
5. Rolar o CTA para a área visível e salvar.
6. Capturar o request.

Payload emitido:

```json
{"totalLimit":"5000.50","notes":null,"categories":[],"month":"2026-08"}
```

Resultado: teste aprovado; sem overflow horizontal; CTA alcançável por scroll; nenhuma conclusão física sobre teclado Android.

### 3.6 AVD Android

Ambiente:

- AVD `Pixel_7_Pro`;
- WebView CSS: aproximadamente 412×827, DPR 3,5;
- APK debug com API `https://10.0.2.2:3443/api`;
- usuário, orçamento e categoria sintéticos;
- bottom/system navigation reais do emulador.

Passos:

1. Instalar o APK debug e limpar apenas os dados locais do app para evitar sessão sintética antiga.
2. Fazer login real na SPA.
3. Navegar pelo link de Orçamento do shell.
4. Abrir edição, focar o limite e mostrar o IME disponível no AVD.
5. Pressionar Back uma vez.
6. Salvar `5.000,50` com uma categoria de `1200.00`.
7. Reabrir edição, alterar o valor sem salvar e pressionar Back sem IME.

Payload WebView observado:

```json
{
  "totalLimit": "5000.50",
  "notes": null,
  "categories": [
    { "categoryId": "<uuid-v4-sintético>", "limitAmount": "1200.00" }
  ]
}
```

Resposta final controlada: `200`; não apareceu “Dados inválidos”.

## 4. Mapa do fluxo frontend → API

```text
BudgetsPage.vue
  v-model (strings digitadas)
    -> validateForm()
       -> normalizeMoney(totalLimit)
       -> normalizeMoney(categories[].limitAmount)
       -> bloqueio local de vazio, zero, negativo ou formato ambíguo
    -> save()
       -> POST /api/budgets ou PATCH /api/budgets/:id
       -> authenticatedFetch()
          -> Authorization Bearer em memória
          -> JSON + cookies/CSRF existentes
    -> Nest ValidationPipe global
       -> whitelist + forbidNonWhitelisted
       -> CreateBudgetDto / UpdateBudgetDto / BudgetCategoryDto
    -> BudgetsController
    -> BudgetsService
       -> Decimal positivo
       -> categorias únicas, próprias, EXPENSE e regras de arquivamento
       -> transação Prisma serializável
       -> projeção planejado/realizado/comprometido
    -> HttpExceptionFilter
       -> envelope { error: { code, message, details? } }
    -> BudgetsPage.request()
       -> ApiRequestError
       -> applyApiDetails() + formError
```

Arquivos centrais:

- `apps/web/src/pages/BudgetsPage.vue` — estado, normalização, payload, erro e CSS;
- `apps/web/src/transaction-template.ts` — `normalizeMoney` compartilhado;
- `apps/web/src/auth.ts` — transporte autenticado;
- `apps/api/src/main.ts` — `ValidationPipe` e origem da frase;
- `apps/api/src/common/http-exception.filter.ts` — envelope público;
- `apps/api/src/budgets/dto.ts` — regex monetária e validação aninhada;
- `apps/api/src/budgets/budgets.controller.ts` — rotas;
- `apps/api/src/budgets/budgets.service.ts` — regra e persistência.

## 5. Origem do “Dados inválidos”

### 5.1 Origem exata

`apps/api/src/main.ts` configura uma `ValidationPipe` global com:

- `transform: true`;
- `whitelist: true`;
- `forbidNonWhitelisted: true`;
- `exceptionFactory` que gera `BadRequestException` com `code: VALIDATION_ERROR` e `message: Dados inválidos.`.

`HttpExceptionFilter` preserva essa mensagem no envelope. A tela lê `data.error.message` e a exibe sem traduzi-la.

Portanto:

- não nasce no Vue;
- não nasce em validação compartilhada;
- nasce no Nest/class-validator;
- ocorre antes do método do controller ser executado com DTO válido;
- não é mensagem do Prisma;
- não comprova bug de regra financeira.

### 5.2 Causa histórica confirmada

Na versão anterior a `7c2726c`, `save()` montava o body com `totalLimit: form.totalLimit` e `categories: form.categories`. Uma entrada localizada era enviada literalmente. O DTO já exigia `^(?:0|[1-9][0-9]{0,16})\.[0-9]{2}$`.

Em 21/08/2026, `7c2726c` passou a normalizar total e categorias, adicionou mensagens locais e testes para `100`, `100,00`, `1.000,00`, `1000.00`, `1000` e `1000,00`. A observação de 20/08 precede essa mudança.

### 5.3 Estado atual

O mesmo valor digitado como `5.000,50` foi enviado pela Web e pelo WebView como `5000.50`. O erro histórico não é atual na `main` analisada.

### 5.4 Lacuna atual independente

Erros em `categories[n].limitAmount` aparecem em `ValidationError.children`. A fábrica atual usa apenas `errors.flatMap(error.constraints)`. Por isso o detalhe fica vazio e `applyApiDetails`, que procura `field === 'categories'`, não consegue destacar as linhas.

## 6. Achados de layout mobile

### 6.1 Sem quebra horizontal

Nos quatro viewports Playwright, `document.documentElement.scrollWidth === innerWidth`. No AVD, ambos foram 412 px. Não houve scrollbar horizontal nem conteúdo cortado lateralmente.

### 6.2 Conteúdo espremido por reserva de 64 px

Em `max-width: 767px`, `.category-row` recebe `padding-right: 4rem`. O FAB é simultaneamente ocultado em qualquer `.budgets`.

Medições com uma categoria longa:

| Viewport | Largura da linha | Conteúdo útil | Padding direito |
|---|---:|---:|---:|
| 360×800 | 294 px | ~178 px | 64 px |
| 390×844 | 324 px | ~208 px | 64 px |
| AVD 412×827 | ~346 px | ~244 px | 64 px |
| 768×1024 | 702 px | ~650 px | 0 px |
| 1440×900 | 1054 px | ~1002 px | 0 px |

A reserva explica nomes, valores e metadados quebrando em mais linhas. Não há evidência de que ela proteja um elemento visível no estado atual.

### 6.3 Densidade vertical

Com apenas uma categoria sintética:

- lista em 360×800: `scrollHeight` ~1509 px;
- lista em 390×844: `scrollHeight` ~1509 px;
- AVD 412×827: `scrollHeight` ~1290 px;
- desktop 1440×900: `scrollHeight` ~981 px.

Resumo, categorias e outras despesas são painéis separados, com padding próprio e ainda recebem reservas inferiores do shell e da página. O fluxo funciona, mas exige rolagem extensa para pouca informação.

### 6.4 Estado vazio

O estado vazio coube integralmente nos viewports testados, sem overflow. A criação fica descoberta e acionável.

### 6.5 Formulário

O formulário empilha corretamente a linha de categoria e o input em mobile. O CTA é uma linha normal no fim do formulário, não sticky. Com uma categoria no AVD, seu topo ficou em ~767 px e o fim em ~815 px para viewport de ~827 px: acessível, porém no limite inferior antes de considerar um teclado virtual completo.

## 7. FAB / bottom nav / CTA

### 7.1 Regras atuais

`AuthenticatedShell.vue` renderiza o FAB global em todos os destinos principais. `BudgetsPage.vue` aplica duas regras globais por `:has()`:

```css
.authenticated-shell:has(.budgets) .global-fab { display: none; }
.authenticated-shell:has(.budgets--editing) .bottom-nav { display: none; }
```

Com isso:

- visualização de Orçamento: bottom nav visível, FAB oculto;
- criação/edição: bottom nav oculta, FAB oculto;
- desktop: header mantém “+ Novo lançamento”; o elemento FAB já seria oculto pelo breakpoint do shell.

### 7.2 Motivo provável e status da decisão

Fatos:

- as regras entraram no commit `7c2726c`, cujo objetivo incluía UX mobile de Orçamento;
- a nota anterior dizia “FAB pode sobrepor conteúdo”;
- o audit da SPEC-013 classificou a exceção como conflito com CA-02;
- não há decisão de produto formalizando que Orçamento não deve oferecer a ação global;
- a linha de categoria ainda reserva 4rem, padrão coerente com uma tentativa anterior de evitar a região do FAB.

Conclusão: a exceção é **workaround e dívida técnica**, não requisito confirmado. Ela é operacionalmente útil para impedir sobreposição no layout atual, mas não deve ser preservada ou removida sem uma decisão de produto e teste do shell. Remover somente o `display:none` é arriscado.

### 7.3 Bottom nav e padding

No AVD, `.shell-content` continuou com `padding-bottom: 148px` quando a bottom nav estava `display:none`. A página também mantém padding inferior próprio. Isso evita corte do fim, mas cria espaço redundante e não acompanha semanticamente a ausência da navegação.

### 7.4 CTA e teclado

- Browser 360×480: `.form-actions` começou em ~704 px, fora da área inicial, mas `scrollIntoViewIfNeeded()` tornou “Salvar” visível e acionável.
- AVD: o IME disponível foi o acessório para teclado físico, não o teclado virtual completo. O CTA permaneceu dentro do viewport por margem pequena.
- O CSS não fixa o CTA nem reage a `visualViewport`.

Conclusão: o CTA é alcançável por scroll nos cenários automatizados, mas a conformidade com teclado virtual completo não foi comprovada.

## 8. Validação monetária e payload

### 8.1 Frontend atual

`normalizeMoney` aceita:

- inteiro (`5000`);
- pt-BR (`5000,50`, `5.000,50`, `R$ 5.000,50`);
- canônico (`5000.50`);
- até 17 dígitos inteiros e no máximo duas casas.

Rejeita:

- vazio;
- zero quando `allowZero` não é usado;
- negativo para orçamento;
- exponencial (`1e3`);
- en-US ambíguo (`1,234.50`);
- três casas (`1.001`);
- excesso de tamanho.

O formulário bloqueia localmente total/categoria inválidos e não chama a API.

### 8.2 Contrato API

O DTO aceita somente strings `X.YY`. A API não deve aceitar vírgula, número JSON ou arredondar silenciosamente. O serviço converte para `Prisma.Decimal` e exige valor maior que zero.

Essa separação é coerente:

- UX local aceita formatos humanos e normaliza;
- contrato interno permanece exato e sem float;
- serviço aplica positividade/regra de negócio.

### 8.3 Defaults e edição/criação

- criação acrescenta `month` ao body;
- edição não envia `month`;
- `notes` vazia vira `null`;
- `categories` sempre é uma lista completa no formulário;
- edição inicial copia todas as categorias projetadas, inclusive arquivadas;
- categoria arquivada fica desabilitada e só pode ser preservada/removida conforme serviço.

### 8.4 Erros, loading e retry

- leitura diferencia `404` de indisponibilidade e oferece retry;
- salvamento preserva o formulário e mostra erro geral;
- detalhes do total viram erro no campo;
- detalhes aninhados de categorias não chegam atualmente;
- falha ao carregar categorias é engolida e convertida em lista vazia, sem mensagem nem retry. Isso pode parecer “não há categorias” quando a API falhou.

## 9. Resultados por viewport

| Viewport | Estado vazio | Lista | Formulário/CTA | Overflow | FAB / bottom nav |
|---|---|---|---|---|---|
| 360×800 | Cabe sem scroll adicional | 1509 px de altura; conteúdo de categoria ~178 px | Fluxo funciona; com altura simulada 480 o CTA exige scroll | Não | FAB oculto; nav visível fora da edição e oculta dentro |
| 390×844 | Cabe | 1509 px; conteúdo ~208 px | Empilhado, ainda extenso | Não | Igual a 360 |
| 768×1024 | Cabe | Conteúdo ~650 px, sem reserva de 64 px | Layout de desktop por estar acima do breakpoint 767 | Não | Bottom nav/FAB não exibidos; header desktop ativo |
| 1440×900 | Cabe | Conteúdo ~1002 px; página ~981 px | Confortável | Não | Header desktop; FAB/bottom nav não exibidos |

Observação: o salto em 768 px é abrupto. Tablets exatamente nessa largura recebem header desktop, não bottom navigation.

## 10. Resultados Android/WebView

### 10.1 Validado no AVD

- APK debug compilado e instalado;
- origem WebView e proxy HTTPS funcionais;
- login real com fixture sintética;
- navegação pelo shell até `/budgets`;
- `scrollWidth` igual ao viewport CSS (412 px);
- bottom nav acima da navigation bar, sem corte visual observado;
- FAB oculto em Orçamento;
- bottom nav oculta em edição;
- lista com uma categoria: linha ~346 px, conteúdo ~244 px e padding direito 64 px;
- payload canônico com total e categoria;
- PATCH final `200`;
- ausência de “Dados inválidos”;
- primeiro Back com IME visível: IME fechou e edição permaneceu;
- Back sem IME: retornou ao Dashboard e descartou edição não salva, sem confirmação.

### 10.2 Limitações

- o AVD estava com teclado físico e exibiu apenas o acessório/toolbar do IME; não houve teclado QWERTY completo ocupando a metade inferior;
- não houve portrait/landscape comparativo;
- safe area foi verificada visualmente no AVD, não em cutout/aparelho físico;
- não houve TalkBack;
- não houve validação física de gesto Back;
- não houve aparelho real.

### 10.3 Evento transitório

Uma tentativa Android durante preparação de massa/sessão retornou `Erro interno.`. O mesmo PATCH foi repetido de forma controlada e retornou `200`; a API direta também retornou `200`. Os logs atuais não registram a exceção filtrada. Não há evidência suficiente para atribuir causa ou tratá-lo como o erro original. Classificação: **NÃO REPRODUZIDO** no cenário final; manter como ponto inconclusivo, não como causa raiz.

## 11. Matriz de achados

| ID | Classificação | Sev. | Evidência | Causa provável/confirmada | Arquivos | Proposta | Risco de regressão |
|---|---|---:|---|---|---|---|---|
| A01 | `NÃO REPRODUZIDO` | P1 | Web, HTTP e AVD enviaram `5000.50` e salvaram | Confirmada historicamente: valor pt-BR era enviado cru antes de `7c2726c`; já corrigido | `BudgetsPage.vue`, `transaction-template.ts`, `dto.ts` | Manter normalização e ampliar E2E/contrato; não reabrir correção funcional já presente | Médio se parser/payload forem alterados |
| A02 | `BUG DE VALIDAÇÃO` | P2 | Categoria inválida retornou `details: []` | Confirmada: `exceptionFactory` ignora `ValidationError.children` | `main.ts`, `BudgetsPage.vue` | Definir paths recursivos seguros e mapear linha/campo no frontend em SPEC própria | Médio; envelope é transversal |
| A03 | `BUG DE UX/LAYOUT` | P2 | 64 px reservados e conteúdo útil ~178 px em 360 | Confirmada: `.category-row { padding-right: 4rem }` com FAB oculto | `BudgetsPage.vue` | Remover reserva obsoleta ou redesenhar ações/cards sob SPEC mobile | Médio; valores longos e FAB |
| A04 | `BUG DE UX/LAYOUT` | P2 | Lista com uma categoria chega a ~1509 px em 360/390 | Painéis e paddings aninhados; densidade baixa | `BudgetsPage.vue`, `AuthenticatedShell.vue` | Compactar resumo, categoria e outras despesas sem esconder informação | Médio; acessibilidade e legibilidade |
| A05 | `DÍVIDA TÉCNICA` | P2 | FAB oculto por seletor global `:has()` específico da página | Confirmada: workaround de sobreposição adicionado em `7c2726c` | ambos os componentes | Mover política de ação para contrato explícito do shell/rota | Alto; ação global e overlays |
| A06 | `DECISÃO DE PRODUTO` | P2 | SPEC-013 pede FAB nos destinos primários, runtime exclui Orçamento | Não formalizada: manter exceção ou restaurar ação global | SPEC-013, shell, página | Decidir antes da implementação; não remover CSS isoladamente | Alto; descoberta e consistência |
| A07 | `BUG DE UX/LAYOUT` | P2 | Nav oculta em edição, mas shell conserva 148 px inferiores; CTA não sticky | Confirmada por CSS e AVD | ambos os componentes | Definir superfície de edição e cálculo único de insets/nav/CTA | Alto com IME e safe area |
| A08 | `NÃO VERIFICÁVEL` | P2 | Browser reduzido exige scroll; AVD só mostrou toolbar do IME | Teclado virtual completo não testado | página, Manifest/runtime | Gate com teclado virtual completo e aparelho físico | Alto; CTA pode ficar coberto |
| A09 | `BUG FUNCIONAL` | P2 | Back sem IME saiu para Dashboard e perdeu alteração não salva | Confirmada: Budgets não trata `plannerfin:android-back` nem dirty state | `BudgetsPage.vue`, `mobile.ts` | SPEC deve decidir confirmação/preservação de rascunho | Médio; histórico e overlays |
| A10 | `BUG FUNCIONAL` | P2 | Falha de `/categories` vira `[]` silenciosamente | Confirmada pelo `catch` de `onMounted` | `BudgetsPage.vue` | Exibir indisponibilidade/retry separado de lista vazia | Baixo/médio |
| A11 | `DÍVIDA TÉCNICA` | P2 | Não havia E2E específico de Orçamento; cobertura era componente/API | Confirmada pela lista de E2E | testes Web/API | Manter reprodução e adicionar fluxo integrado após SPEC | Baixo |
| A12 | `NÃO REPRODUZIDO` | P2 | Um `500` Android transitório; repetição exata final `200` | Inconclusiva; logs não registram exceção filtrada | filtro/logs/serviço | Melhorar observabilidade sanitizada e tentar reproduzir isoladamente se reaparecer | Médio |

Escala usada: P0 perda/indisponibilidade crítica; P1 bloqueio amplo ou risco financeiro alto; P2 impacto relevante com contorno; P3 desconforto menor.

## 12. Causa raiz confirmada

### Erro histórico “Dados inválidos”

```text
entrada pt-BR (ex.: 5.000,50)
  -> frontend antigo envia string sem normalizar
  -> DTO exige X.YY
  -> ValidationPipe rejeita
  -> HttpExceptionFilter preserva “Dados inválidos.”
  -> tela mostra a mensagem geral
```

Essa causa foi confirmada por código histórico, commit corretivo, testes e reprodução de contrato. Não houve chamada ao serviço nem ao Prisma no payload rejeitado.

### Layout

A causa confirmada do aspecto espremido é a combinação de breakpoint mobile, painéis empilhados e reserva fixa de 4rem na linha de categoria, apesar de o FAB estar oculto. A exceção do shell evita sobreposição à custa de inconsistência e acoplamento global.

## 13. Pontos ainda inconclusivos

- motivo exato do `500` transitório observado em uma preparação Android; não repetiu;
- comportamento com teclado virtual completo, teclado numérico padrão e diferentes IMEs;
- alcance do CTA em aparelho físico com navigation bar gestual/três botões;
- landscape e rotação preservando foco/scroll/rascunho;
- cutouts/safe areas diferentes do Pixel 7 Pro emulado;
- decisão de produto sobre FAB em Orçamento;
- comportamento desejado do Back com edição suja;
- se edição deve ser inline, rota dedicada, sheet ou outra superfície;
- conforto com muitas categorias e nomes/valores extremos em aparelho físico.

## 14. Proposta de correção

Sem implementar nesta pesquisa:

1. **Contrato de erro** — percorrer validações aninhadas e devolver paths sanitizados (`categories[0].limitAmount` ou contrato equivalente aprovado); mapear campo/linha no frontend; preservar status e regex canônica.
2. **Layout de Orçamento** — eliminar a reserva de 64 px sem elemento visível, compactar cards, reduzir padding duplicado e medir 320–1440 com strings longas.
3. **Formulário/IME** — decidir CTA sticky ou scroll assistido; usar um único responsável por insets; validar teclado completo e último campo.
4. **Shell/FAB** — formalizar se a ação global existe em Orçamento. Se existir, reservar espaço real e testar sobreposição; se não existir, registrar exceção de produto em vez de escondê-la via CSS da página.
5. **Back/rascunho** — rastrear dirty state e confirmar descarte ou preservar rascunho segundo SPEC aprovada.
6. **Estados de dados** — separar falha de categorias de lista vazia e oferecer retry.
7. **Observabilidade** — registrar exceções internas com correlação sanitizada no backend, sem payload financeiro, token ou identidade.

Não é recomendado aceitar formatos localizados diretamente no DTO. O frontend é a fronteira de UX; a API deve continuar exata e livre de coerção ambígua.

## 15. Quebra sugerida em PRs

### PR 1 — contrato de validação aninhada

- SPEC de bug específica;
- recursão de detalhes de `class-validator`;
- testes HTTP de total e categorias;
- mapeamento seguro no formulário;
- sem mudança de regra financeira.

### PR 2 — Orçamento mobile e formulário

- SPEC mobile aprovada;
- compactação de resumo/cards;
- remoção da reserva obsoleta;
- CTA/scroll/IME;
- estados de carregamento de categorias;
- Back/dirty state, se aprovado no mesmo contrato de formulário.

### PR 3 — política de FAB e navegação do shell

- decisão explícita de produto sobre ação global em cada destino primário;
- remoção do acoplamento `:has()` da página;
- coordenação FAB, bottom nav, CTA, dialogs e safe area;
- regressão nas demais rotas primárias.

### PR 4 — cobertura Android/E2E

- pode acompanhar as implementações ou ser uma unidade de testes separada;
- matriz de viewports;
- teclado virtual completo;
- Back com/sem IME;
- aparelho físico como gate humano;
- payload/status sem registrar dados sensíveis.

Não agrupar contrato transversal, redesign de página e política do shell em uma única PR reduz risco e facilita rollback.

## 16. Testes a adicionar/atualizar

### Mantido nesta investigação

- `apps/web/e2e/budgets-mobile-reproduction.spec.ts` — reprodução sintética de estado vazio/lista, quatro viewports, ausência de overflow, viewport reduzido e payload canônico.

### Próximos testes

- API HTTP: total como string válida, pt-BR crua, número JSON, campo extra, zero e negativo;
- API HTTP: `categories[0].categoryId` e `limitAmount` inválidos com path recursivo;
- Web: falha ao carregar categorias não pode parecer lista vazia;
- Web: foco no primeiro campo inválido e anúncio de erro;
- Web: muitas categorias, nomes longos e valores de 17 dígitos;
- E2E: criação, edição, copy, conflito, erro, retry e lista real;
- E2E: 320×568, 360×800, 390×844, 768×1024 e 1440×900;
- Android: IME completo, scroll final, CTA, Back, rotação, safe area e navigation modes;
- Android: teste físico registrado, sem inferir conformidade a partir do AVD.

Não existia E2E específico de Orçamento antes desta investigação. Existiam testes de componente Web e testes unitários/serviço da API.

## 17. Riscos

- Remover apenas o `display:none` do FAB pode cobrir valores, menus ou CTA.
- Tornar CTA sticky sem recalcular bottom nav/IME pode criar nova sobreposição.
- Aceitar vírgula na API pode introduzir coerção dependente de locale e quebrar precisão/contrato.
- Alterar globalmente detalhes de validação afeta todos os DTOs; exige teste de compatibilidade e sanitização.
- Compactar cards pode reduzir legibilidade, alvos de toque ou clareza entre Realizado e Comprometido.
- Alterar Back pode interferir em dialogs, teclado e histórico; precisa respeitar a ordem IME → overlay → dirty state → rota.
- Teste apenas em AVD não cobre fabricantes, IMEs, cutouts e navigation bars reais.
- O `500` transitório não deve ser “corrigido por hipótese”; falta reprodução determinística e observabilidade.
- A massa sintética local não representa volume alto de categorias ou fatos financeiros.

## Validações e evidências executadas

| Comando/ação | Resultado |
|---|---|
| `pnpm env:doctor` | Core/Web ready; Android build/emulator ready; leitura inicial do Docker limitada pelo sandbox, confirmada fora dele |
| `docker info` | Engine disponível |
| `pnpm db:up` | PostgreSQL local iniciado |
| `pnpm db:migrate` | 19 migrations; nenhuma pendente |
| `pnpm dev:seed-test-user` | fixture sintética criada |
| testes focados Web | 3 arquivos, 42 testes aprovados |
| testes focados API | 2 arquivos, 11 testes aprovados |
| requests HTTP locais | create/PATCH válidos aprovados; inválidos documentados retornaram 400 |
| Playwright de reprodução | 1 teste aprovado nos quatro viewports |
| `pnpm android:apk` | build debug aprovado |
| AVD/WebView | login, layout, IME disponível, Back e PATCH 200 validados |
| `pnpm lint` | aprovado em todos os workspaces |
| `pnpm typecheck` | aprovado em todos os workspaces |
| `pnpm build` | aprovado em todos os workspaces |

Não foi executada a suíte completa porque ela não acrescentaria evidência específica à investigação. Foram executados novamente os testes focados de Orçamento, shell, normalização monetária, regras financeiras do backend e o E2E de reprodução.

## Fora do escopo confirmado

Nenhum arquivo funcional, DTO, API, serviço, banco, migration, dependência ou regra de negócio foi alterado. Esta branch contém somente este documento e o teste de reprodução autorizado.
