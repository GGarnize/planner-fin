# SPEC de funcionalidade — `SPEC-018 — Personalização visual por usuário`

> Esta unidade aprova exclusivamente o comportamento de uma implementação futura. Ela não cria código, endpoint, migration, tela, dependência nem setup inicial.

## 1. Identificação

| Campo | Valor |
|---|---|
| ID | `SPEC-018` |
| Título | `Personalização visual por usuário` |
| Responsável | `Codex Cloud` |
| Data de criação | `2026-08-12` |
| Última atualização | `2026-08-12` |
| Tarefa relacionada | `PROMPT-SPEC-018-PERSONALIZACAO-VISUAL.md` |
| Documentos relacionados | `SPEC-002`; `SPEC-012`; `SPEC-013`; `SPEC-016`; `ADR-002`; `docs/specs/README.md`; `docs/quality/DEFINITION-OF-DONE.md`; `docs/quality/TEST-STRATEGY.md` |

## 2. Status

`Aprovada`

**Aprovada por:** autorização rastreável em `PROMPT-SPEC-018-PERSONALIZACAO-VISUAL.md`, em 2026-08-12, que solicita criar e aprovar a SPEC e fecha as decisões obrigatórias.

## 3. Contexto

A UX mobile-first da SPEC-013 e a Fase B de Lançamentos da SPEC-016 preservaram personalização e setup para unidades próprias. A mesma SPA Vue/Quasar é distribuída na web e no Android/Capacitor, e a SPEC-002 exige que a identidade venha da sessão e que credenciais não sejam gravadas em Web Storage.

### 3.1 Auditoria do estado atual

- `SPEC-002` define `GET /api/users/me`, projeção pública `{ id, name, email, createdAt }`, isolamento pelo usuário autenticado, DTOs estritos e access token somente em memória.
- `SPEC-013` define shell mobile-first, área mínima acionável de 44 × 44 CSS px, foco visível, contraste AA, texto a 200%, safe areas e comportamento Android Back.
- `SPEC-016` exclui expressamente Minha Conta e personalização; nenhuma regra dessa SPEC é alterada.
- O shell atual está em `AuthenticatedShell.vue`; Minha Conta está na rota `/conta`, acessível por Mais, e contém somente dados da conta, atalhos e logout.
- `App.vue` concentra alguns estilos globais, mas páginas e shell ainda contêm muitas cores hexadecimais locais. Não existe camada completa de tokens claro/escuro nem configuração de dark mode do Quasar.
- O bootstrap em `auth.ts` obtém CSRF, tenta refresh e mantém usuário/access token em memória. Logout limpa estado em memória. A SPA é compartilhada com o Android e o adaptador móvel apenas trata cookies e Back.
- `User` já possui `updatedAt`, mas não possui preferência visual nem relação de preferências. Não há migration ou JSON de preferências existente.
- `GET /api/users/me` retorna somente a projeção pública; não há `PATCH /users/me` nem endpoint de preferências.
- Não foi encontrada persistência intencional de preferências em `localStorage`, `sessionStorage` ou IndexedDB.

Esses fatos são AS-IS e não autorizam alteração fora da futura implementação desta SPEC.

## 4. Problema

O usuário não consegue escolher aparência ou destaque, e as cores atuais não formam um contrato capaz de alternar entre claro e escuro com consistência. Uma solução somente local divergiria entre dispositivos; estender cores hardcoded aumentaria risco de contraste insuficiente; e aplicar cache sem vínculo com o ciclo de autenticação poderia mostrar a escolha do usuário anterior.

## 5. Objetivo

Definir uma preferência visual canônica por usuário, sincronizada entre web e Android, composta por aparência `SYSTEM | LIGHT | DARK` e um accent de conjunto fechado acessível, com aplicação por tokens, cache local não sensível apenas para evitar flash, fallback compatível e contratos verificáveis de leitura e atualização.

## 6. Fora do escopo

- Setup inicial, onboarding, categorias padrão ou qualquer mudança no cadastro.
- Importações, fontes, wallpaper, temas compartilhados ou editor de tema.
- Personalização financeira, aconselhamento, analytics ou nova autenticação.
- Alteração de regras financeiras, rotas de domínio ou armazenamento offline de dados financeiros.
- Implementar código, migration, frontend, backend, dependência ou evidência visual nesta unidade documental.

## 7. Termos

| Termo | Definição adotada nesta SPEC |
|---|---|
| Appearance | Preferência persistida `SYSTEM`, `LIGHT` ou `DARK`. |
| Tema resolvido | Resultado visual efetivo `LIGHT` ou `DARK`; em `SYSTEM`, deriva de `prefers-color-scheme`. |
| Accent | Identificador de uma paleta aprovada, nunca uma cor livre enviada pelo cliente. |
| Tokens personalizáveis | Variáveis derivadas de appearance/accent que podem variar sem mudar significado funcional. |
| Tokens semânticos | Variáveis de sucesso, alerta, erro e informação cujo significado não depende do accent. |
| Cache visual | Cópia local somente de `appearance` e `accent`, sem token, usuário ou dado financeiro, usada antes da resposta canônica. |
| Preferência canônica | Registro vigente no backend para o usuário autenticado. |

## 8. Comportamento atual

A aplicação usa uma aparência predominantemente clara e accent azul `#155eef`, sem seletor. Fundo, texto, bordas, foco e estados são frequentemente hardcoded por componente. O login e o shell são renderizados durante o fluxo de restore; `/users/me` não é usado para preferências e `PublicUser` não as contém. Web e Android executam os mesmos assets, mas não sincronizam tema.

## 9. Comportamento desejado

### 9.1 Appearance

- `SYSTEM`: acompanha o esquema do sistema em tempo real por `prefers-color-scheme`; é o default persistido.
- `LIGHT`: força tokens claros, independentemente do sistema.
- `DARK`: força tokens escuros, independentemente do sistema.
- O atributo/classe raiz e o modo dark do Quasar, se utilizado, devem ser atualizados pela mesma função atômica. Componentes não podem manter um segundo estado de tema.

### 9.2 Accent fechado

O accent será um enum fechado, e não hex livre, para permitir auditoria de contraste, evolução compatível e payload seguro:

| Valor | Referência visual inicial | Intenção |
|---|---|---|
| `BLUE` | azul atual `#155EEF` | default e continuidade visual |
| `TEAL` | verde-azulado | alternativa fria |
| `PURPLE` | violeta | alternativa expressiva |
| `ORANGE` | laranja escuro | alternativa quente |

As referências não autorizam usar uma única tonalidade em todos os fundos. A implementação definirá para cada accent, em claro e escuro, pares aprovados de `accent`, `on-accent`, `accent-container`, `on-accent-container` e `focus-ring`. Todos os pares de texto/fundo devem atingir WCAG 2.2 AA: 4,5:1 para texto normal e 3:1 para texto grande; componentes gráficos, limites essenciais e foco devem atingir 3:1 contra cores adjacentes. Uma paleta que falhar é ajustada antes do merge, sem ampliar o enum.

### 9.3 Persistência e sincronização

- O backend é a fonte canônica. Cada usuário possui no máximo um `UserPreferences` 1:1.
- Web e Android usam o mesmo endpoint e os mesmos enums; não existe preferência exclusiva por plataforma ou dispositivo.
- O cache visual é otimização, não fonte de verdade. Após restore/login, a resposta do servidor sempre prevalece e substitui cache e tema, mesmo se o cache for mais recente pelo relógio local.
- Uma alteração bem-sucedida aplica a resposta canônica e atualiza o cache. Reload, reinício e force-stop podem reaplicar o cache antes da rede e devem convergir para o servidor.

### 9.4 Antes do login, cold start, restore e logout

1. O HTML/bootstrap define sincronamente o default `SYSTEM + BLUE` antes da primeira pintura.
2. Em cold start com possível sessão restaurável, pode ler somente `{ appearance, accent }` do cache e aplicá-lo antes de montar a SPA, reduzindo flash.
3. Enquanto o restore está pendente, não se exibe Minha Conta nem conteúdo autenticado. Ao restaurar sessão, o cliente busca preferências canônicas antes de liberar o shell; timeout/erro mantém provisoriamente o cache e expõe recuperação sem gravar default no servidor.
4. Se o restore falhar, o cache é apagado e o login é apresentado em `SYSTEM + BLUE`.
5. Login e cadastro são sempre apresentados em `SYSTEM + BLUE`; eles não oferecem personalização. Após autenticação, a preferência canônica é obtida/aplicada antes do shell. Para novo usuário, é `SYSTEM + BLUE`.
6. Logout explícito limpa cache visual e aplica `SYSTEM + BLUE` antes de navegar ao login. Falha de revogação não impede essa limpeza local.
7. Em troca de usuário, nunca se mantém no shell a preferência do anterior: usa-se o default durante a transição e, então, a resposta canônica do novo usuário.
8. Mudança de `prefers-color-scheme` altera imediatamente o tema resolvido somente quando appearance é `SYSTEM`; listeners devem ser removidos no ciclo de vida aplicável.

O pequeno intervalo em que o cache visual aparece durante um restore é aceito somente porque contém aparência não sensível e a tela autenticada continua bloqueada. Não se grava `userId`, nome, e-mail, token, cookie, payload ou dado financeiro junto ao cache.

### 9.5 Aplicação e falha de persistência

- Na seção Aparência, a seleção aplica preview imediato na SPA para feedback.
- Cada seleção válida dispara um PATCH debounced/serializado; enquanto pendente, o controle comunica progresso e evita ordem de respostas invertida.
- Sucesso mantém o preview, anuncia “Preferências de aparência salvas.” e usa integralmente a resposta do servidor.
- Falha restaura a última preferência canônica, não atualiza cache, preserva a seção aberta, mostra erro anunciado e oferece “Tentar novamente”. Não existe estado visual silenciosamente salvo só no dispositivo.
- Repetir o mesmo PATCH é seguro e retorna o estado canônico, sem criar registros duplicados.

## 10. Personas ou atores

| Ator | Necessidade | Ações autorizadas |
|---|---|---|
| Visitante | login legível e previsível | usar somente default público |
| Usuário autenticado | escolher e sincronizar aparência | ler e alterar apenas as próprias preferências |
| Cliente web/Android | evitar flash e convergir | aplicar cache visual e substituí-lo pelo servidor |
| API | proteger e validar preferência | derivar owner da sessão e aceitar enums fechados |

## 11. Fluxos

### 11.1 Fluxo principal

1. Usuário abre Minha Conta > Aparência.
2. Escolhe Sistema, Claro ou Escuro e uma opção de accent com nome e amostra.
3. O cliente mostra preview, envia PATCH autenticado e serializado.
4. A API valida, atualiza o registro do owner e retorna a preferência com `updatedAt` do servidor.
5. O cliente aplica a resposta, atualiza cache e anuncia sucesso.
6. Outro dispositivo obtém a mesma preferência no próximo bootstrap, refetch ou retorno à seção.

### 11.2 Fluxos alternativos e exceções

- Sem registro legado → GET materializa/retorna defaults; comportamento nunca depende de `null`.
- Rede indisponível no bootstrap → cache provisório ou default; shell informa falha e permite retry.
- PATCH inválido → `400`, sem mutação e sem preview persistente.
- Respostas concorrentes locais → somente uma gravação ativa; resposta antiga não sobrescreve intenção nova.
- Dois dispositivos → última transação confirmada no servidor vence; o outro converge no próximo refetch.
- Android Back na seção → fecha seletor/preview pendente antes de sair; não descarta gravação confirmada.

## 12. Regras de negócio

| ID | Regra | Origem/decisão | Exemplo |
|---|---|---|---|
| `RN-01` | Appearance aceita somente `SYSTEM`, `LIGHT`, `DARK`. | tarefa | `AUTO` é recusado. |
| `RN-02` | Accent aceita somente `BLUE`, `TEAL`, `PURPLE`, `ORANGE`. | conjunto acessível fechado | `#ff00ff` é recusado. |
| `RN-03` | Defaults são `SYSTEM + BLUE` para novos e antigos. | compatibilidade | usuário sem linha vê o visual atual adaptado ao SO. |
| `RN-04` | Servidor prevalece sobre cache. | sincronização | cache DARK, servidor LIGHT → LIGHT. |
| `RN-05` | Preferência pertence exclusivamente ao usuário da sessão. | SPEC-002 | body não aceita `userId`. |
| `RN-06` | Last-write-wins segue ordem de commit/`updatedAt` do servidor. | tarefa | segundo PATCH confirmado vence. |
| `RN-07` | Accent não altera tokens semânticos. | acessibilidade | erro permanece erro, não violeta. |
| `RN-08` | Cor nunca é o único indicador. | WCAG | selecionado tem texto/ícone/estado, além da cor. |
| `RN-09` | Cache contém exclusivamente os dois enums. | segurança | sem ID ou token. |

## 13. Modelo de dados

A implementação futura deve usar entidade explícita, não JSON genérico:

| Entidade | Campo | Tipo conceitual | Obrigatório | Regra |
|---|---|---|---|---|
| `UserPreferences` | `userId` | UUID | Sim | PK/FK única para `User`, owner 1:1 |
| `UserPreferences` | `appearance` | enum `Appearance` | Sim | default `SYSTEM` |
| `UserPreferences` | `accent` | enum `Accent` | Sim | default `BLUE` |
| `UserPreferences` | `createdAt` | timestamp com timezone | Sim | definido pelo servidor |
| `UserPreferences` | `updatedAt` | timestamp com timezone | Sim | atualizado pelo servidor em cada mudança efetiva |

Nenhum campo é nullable. `User.updatedAt` não será usado para concorrência de preferências, pois outras alterações de conta o tornariam ambíguo. A relação usa exclusão coerente com a política vigente de `User`; esta SPEC não autoriza exclusão de usuário. Cadastro futuro cria a linha na mesma transação quando tecnicamente possível; GET continua tolerante a linha ausente.

## 14. Contratos de API

Endpoints dedicados são escolhidos para não ampliar silenciosamente `PublicUser`, `AuthResponse` ou o contrato estável de `GET /api/users/me`.

### `GET /api/users/me/preferences`

- Entrada: sem body/query.
- Saída `200`:

```json
{
  "appearance": "SYSTEM",
  "accent": "BLUE",
  "updatedAt": "2026-08-12T18:00:00.000Z"
}
```

- Registro ausente: criar de forma idempotente com defaults, tratando corrida por unicidade, e retornar `200`. Não retornar `404`.
- Erros: `401` sessão inválida; `500/503` indisponibilidade no envelope existente, sem detalhes internos.
- Autorização: `AuthGuard`; owner derivado exclusivamente de `context.userId`.
- Idempotência: leitura/materialização repetida mantém uma única linha e o mesmo estado.
- Cache HTTP: `Cache-Control: no-store`; o cache visual é controlado pelo cliente.

### `PATCH /api/users/me/preferences`

- Entrada: objeto JSON estrito com ao menos um e no máximo os dois campos opcionais `appearance` e `accent`; campos desconhecidos, `null`, string vazia, caixa divergente, número ou enum desconhecido são recusados. `userId`, `updatedAt` e tokens são proibidos.

```json
{ "appearance": "DARK", "accent": "TEAL" }
```

- Saída `200`: representação canônica completa no mesmo formato do GET.
- Semântica parcial: campo omitido preserva o valor vigente. Linha ausente é criada com defaults e recebe os campos enviados atomicamente.
- Erros: `400 VALIDATION_ERROR` com detalhes de campo seguros; `401` sessão inválida; `500/503` sem mutação parcial ou detalhe interno.
- Autorização: `AuthGuard` e predicado/unique key do usuário autenticado; nenhum ID de outro usuário é aceito.
- Idempotência: repetir o mesmo payload é seguro. Para não gerar falsa concorrência, payload que não altera valores retorna o registro sem avançar `updatedAt`.
- Concorrência: LWW pela ordem de confirmação de transações no banco; `updatedAt` é relógio do servidor e não é pré-condição do PATCH.
- Respostas usam `Cache-Control: no-store`.

## 15. Interface

Minha Conta receberá uma seção futura **Aparência**, antes da zona de saída:

- controle rotulado “Tema” com opções Sistema, Claro e Escuro, estado selecionado programático e descrição curta para Sistema;
- grupo “Cor de destaque” com quatro opções nomeadas, amostra, preview e estado selecionado que não dependa apenas da cor;
- status de salvamento, mensagem de sucesso e erro com retry, anunciados por região viva adequada;
- alvos interativos mínimos de 44 × 44 CSS px, ordem de foco lógica, teclado completo e foco restaurado após fechar overlay;
- não usar modal integral no mobile; se um seletor/overlay for necessário, Escape e Android Back o fecham antes de navegar;
- texto e controles refluem a 200%, sem overflow horizontal; preview não reduz legibilidade;
- salvar é automático conforme seção 9.5; não haverá botão ambíguo “Aplicar” separado.

## 16. Design tokens e validações

### 16.1 Tokens personalizáveis mínimos

`--color-accent`, `--color-on-accent`, `--color-accent-container`, `--color-on-accent-container`, `--color-focus-ring`, além das variáveis Quasar equivalentes estritamente mapeadas.

### 16.2 Tokens de superfície por tema

`--color-background`, `--color-surface`, `--color-surface-muted`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-overlay` e estados de interação. Light/dark devem trocar o conjunto na raiz, não componente a componente.

### 16.3 Tokens semânticos fixos

`--color-success*`, `--color-warning*`, `--color-error*` e `--color-info*`, cada qual com foreground/container/border quando aplicável. Seus significados e distinções permanecem fixos em todos os accents e temas. Cores hardcoded existentes deverão ser migradas somente quando necessário para aderir à futura implementação, sem refatoração alheia.

| Campo ou ação | Validação | Resultado esperado |
|---|---|---|
| `appearance` | enum exato | `400` por valor desconhecido |
| `accent` | enum exato | `400` por hex/nome desconhecido |
| PATCH | 1–2 campos conhecidos | `{}` e campo extra recebem `400` |
| contraste | WCAG 2.2 AA nos pares e estados | paleta bloqueada até corrigir |
| foco | visível em todos os fundos/accents | 3:1 e não cortado |

## 17. Permissões

| Ação | Ator autorizado | Condição | Comportamento quando negado |
|---|---|---|---|
| Ler preferências | usuário autenticado | própria sessão | `401`, sem dados |
| Alterar preferências | usuário autenticado | própria sessão e payload válido | `401/400`, sem mutação |
| Ler/alterar outro usuário | ninguém por esta API | não aplicável | rota não aceita ID; nenhum metadado vaza |

## 18. Segurança e privacidade

- Preferência visual não é dado financeiro nem credencial, mas é dado associado à conta e recebe owner isolation.
- DTO estrito, enum fechado e rejeição de propriedades desconhecidas impedem mass assignment e injeção de CSS.
- Nunca aceitar CSS, URL, hex, nome de variável, `userId` ou HTML do cliente.
- Cache visual contém somente dois enums allowlisted e é validado novamente antes de aplicação; valores corrompidos caem no default.
- Proibido cachear token, cookie, nome, e-mail, ID, payload financeiro ou resposta completa de usuário.
- Logs/evidências não incluem token, cookie, identificador pessoal ou dados financeiros reais; podem registrar somente código de erro e enums sanitizados quando necessário.
- CSP e demais decisões de autenticação permanecem inalteradas.

## 19. Erros e estados vazios

| Situação | Estado apresentado | Recuperação esperada |
|---|---|---|
| usuário antigo sem linha | defaults, sem empty state | materialização transparente |
| GET falha com cache | tema provisório e aviso no shell/conta | tentar novamente |
| GET falha sem cache | default e aviso | tentar novamente |
| PATCH falha | rollback visual + erro anunciado | retry preserva intenção selecionável |
| cache inválido | default, sem crash | remover cache inválido |
| sessão inválida | default público e login | autenticar novamente |

## 20. Observabilidade

Logs estruturados e sanitizados podem contar sucesso/falha de GET/PATCH, latência e códigos de validação, sem `userId`, IP em evidência, token ou valores pessoais. Analytics de comportamento é fora do escopo. Alertas usam a política operacional existente; não se adiciona serviço.

## 21. Migração, rollout e compatibilidade

- Migration futura **aditiva**, nunca edição de migration aplicada: criar enums, tabela `UserPreferences`, relação/índice único e timestamps.
- Backfill transacional ou em lotes cria `SYSTEM + BLUE` para usuários existentes. GET tolerante cobre janela de rollout e eventual ausência residual.
- Usuários novos recebem a mesma preferência default; criação de conta não ganha tela nem novos campos de entrada.
- Aplicativo antigo continua usando `/users/me` e ignora a nova tabela/endpoints. Aplicativo novo tolera endpoint temporariamente indisponível/campos locais ausentes com defaults.
- Ordem sugerida: (1) migration/backend retrocompatível; (2) cliente com fallback; (3) monitorar erros; sem feature flag paga.
- Rollback do cliente/backend não apaga a tabela nem preferências. A tabela aditiva pode permanecer inerte para reaplicação futura; removê-la exige outra migration aprovada, não rollback destrutivo imediato.

## 22. Critérios de aceite

### `CA-01 — Usuário existente sem preferência`
**Dado** usuário legado sem `UserPreferences` **Quando** consulta preferências **Então** recebe `SYSTEM + BLUE`, uma única linha é materializada e nenhum erro/estado vazio aparece.

### `CA-02 — Novo usuário`
**Dado** cadastro concluído **Quando** o shell autenticado inicia **Então** a preferência canônica é `SYSTEM + BLUE`, sem etapa de setup.

### `CA-03 — Light, dark e system`
**Dado** cada valor de appearance **Quando** aplicado **Então** LIGHT força claro, DARK força escuro e SYSTEM resolve pelo sistema usando os mesmos tokens web/Android.

### `CA-04 — SYSTEM segue o SO`
**Dado** appearance SYSTEM **Quando** `prefers-color-scheme` muda **Então** o tema resolvido muda sem reload; em LIGHT/DARK a mudança do SO não altera o tema.

### `CA-05 — Alterar accent`
**Dado** a seção Aparência **Quando** cada accent aprovado é escolhido **Então** o preview usa tokens, estado selecionado tem texto/indicador e sucesso depende do PATCH.

### `CA-06 — Persistência após reload`
**Dado** PATCH confirmado **Quando** a web recarrega **Então** cache evita flash e servidor confirma a mesma preferência.

### `CA-07 — Persistência após force-stop`
**Dado** sessão Android e preferência confirmadas **Quando** o app sofre force-stop e cold start **Então** aplica cache não sensível e converge ao servidor antes de liberar o shell.

### `CA-08 — Outro dispositivo`
**Dado** preferência salva na web **Quando** o mesmo usuário restaura sessão no Android **Então** recebe e aplica a preferência canônica sem configuração local manual.

### `CA-09 — Logout e troca sem vazamento`
**Dado** usuário A com DARK/PURPLE **Quando** sai e usuário B entra **Então** login usa SYSTEM/BLUE, cache de A é apagado e o shell de B só abre com a preferência canônica de B.

### `CA-10 — Restore correto`
**Dado** sessão válida e cache ausente **Quando** restore conclui **Então** o shell aguarda GET e abre com a preferência do usuário, sem pintura autenticada no tema errado.

### `CA-11 — Cache visual sem token`
**Dado** cache inspecionado após uso web/Android **Quando** storages são auditados **Então** há no máximo appearance/accent válidos, sem token, cookie, usuário, ID ou dado financeiro.

### `CA-12 — Servidor prevalece sobre cache stale`
**Dado** cache DARK/TEAL e servidor LIGHT/BLUE **Quando** restore conclui **Então** LIGHT/BLUE substitui tema e cache.

### `CA-13 — Erro PATCH`
**Dado** preferência canônica LIGHT/BLUE **Quando** preview DARK falha ao salvar **Então** a UI volta a LIGHT/BLUE, anuncia erro, não altera cache e permite retry.

### `CA-14 — Valores inválidos recusados`
**Dado** PATCH com enum, hex, `null`, `{}` ou campo extra inválido **Quando** chega à API **Então** retorna `400 VALIDATION_ERROR` e não altera a linha.

### `CA-15 — Owner isolation`
**Dado** usuários A e B **Quando** A usa os endpoints **Então** só lê/altera A, não envia ID de owner e nenhuma preferência/metadado de B é revelado.

### `CA-16 — Contraste light`
**Dado** LIGHT e cada accent **Quando** pares, componentes e estados são medidos **Então** todos atendem WCAG 2.2 AA e 3:1 não textual aplicável.

### `CA-17 — Contraste dark`
**Dado** DARK e cada accent **Quando** pares, componentes e estados são medidos **Então** todos atendem WCAG 2.2 AA e dark mode permanece legível.

### `CA-18 — Foco com cada accent`
**Dado** teclado e cada tema/accent **Quando** o foco percorre shell, Minha Conta e controles **Então** indicador é visível, não cortado e tem contraste mínimo 3:1 adjacente.

### `CA-19 — Cores semânticas preservadas`
**Dado** sucesso, alerta, erro e informação **Quando** tema/accent muda **Então** significado, rótulo/ícone e contraste permanecem; accent não os substitui.

### `CA-20 — Back Android`
**Dado** Aparência com seletor aberto ou preview pendente **Quando** Back é pressionado **Então** fecha primeiro o nível transitório, restaura foco e só depois navega conforme a pilha da SPEC-013.

### `CA-21 — Zoom/text scale 200%`
**Dado** 200% e largura mobile **Quando** a seção é percorrida **Então** texto reflui, opções têm 44 × 44, e nenhum conteúdo/feedback fica cortado ou exige scroll horizontal.

### `CA-22 — Concorrência entre dispositivos`
**Dado** dois dispositivos com a mesma versão inicial **Quando** PATCHes diferentes confirmam em sequência **Então** o último commit vence, `updatedAt` reflete servidor e o outro converge no próximo refetch.

### `CA-23 — App antigo compatível`
**Dado** backend/migration novos e cliente antigo **Quando** usa autenticação e `/users/me` existentes **Então** contratos continuam iguais e o app opera com aparência antiga.

### `CA-24 — Rollback seguro`
**Dado** preferências já gravadas **Quando** cliente/backend da feature é revertido **Então** app anterior funciona, dados permanecem inertes e nenhuma coluna/tabela é apagada.

## 23. Testes obrigatórios

| Nível | Cenários mínimos | Critérios relacionados | Evidência esperada |
|---|---|---|---|
| Unitário backend | defaults, projeção, validação, no-op, LWW | CA-01, CA-02, CA-14, CA-22 | Vitest aprovado |
| Integração PostgreSQL | migration, unicidade, materialização concorrente, ownership, rollback transacional | CA-01, CA-15, CA-22–24 | suíte com banco aprovado |
| Contrato | GET/PATCH, enums, campos extras, 401, no-store e regressão `/users/me` | CA-12–15, CA-23 | testes de controller/HTTP |
| Componente/frontend | tokens, preview/rollback, serialização, SYSTEM listener, cache allowlist, Back | CA-03–05, CA-09–14, CA-19–20 | Vitest/Vue Test Utils |
| E2E web | login, restore, reload, dois usuários, outro contexto/browser e 200% | CA-06, CA-08–10, CA-21 | Playwright e screenshots sanitizados |
| Android | cold start, force-stop, restore, Back, troca de usuário, SO claro/escuro | CA-03–04, CA-07–10, CA-20 | emulador + aparelho físico |
| Acessibilidade | contraste automatizado/manual, axe, teclado, TalkBack, foco e 200% em 8 combinações tema/accent | CA-16–21 | relatório sem violações críticas/sérias |
| Regressão | lint, typecheck, unitários, integrações, E2E e builds web/Android | todos | comandos/resultados no PR futuro |

## 24. Arquivos permitidos

Para esta unidade documental:

- `docs/specs/SPEC-018-PERSONALIZACAO-VISUAL-USUARIO.md`
- `docs/specs/README.md`

Para futura implementação, em outra branch/PR após esta aprovação:

- `apps/api/prisma/schema.prisma` e uma migration nova específica;
- `apps/api/src/users/**` e testes relacionados;
- `packages/shared/src/**` somente para contratos/enums desta SPEC;
- `apps/web/src/**` e testes diretamente necessários;
- configuração Android existente somente se indispensável para aplicação de tema/status bar e comprovada no PR;
- documentação/evidências sanitizadas desta SPEC.

## 25. Arquivos proibidos

Nesta unidade documental, todos exceto os dois arquivos listados acima. Na futura implementação: migrations aplicadas, regras/DTOs financeiros, setup/onboarding, auth/CSRF/cookies, plugins móveis, analytics, lockfile/manifests para novas dependências e SPECs/ADRs aprovadas, salvo revisão humana explícita.

## 26. Dependências

| Dependência | Motivo | Estado da aprovação | Impacto |
|---|---|---|---|
| Vue, Quasar e Capacitor existentes | mesma SPA e tema | já aprovados | reutilizar APIs atuais |
| Prisma/PostgreSQL existentes | fonte canônica | já aprovados | migration aditiva futura |
| Nova dependência | desnecessária | não aprovada | usar CSS, media query e testes existentes |

## 27. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| flash de tema incorreto | média | desconforto/identidade cruzada | bootstrap síncrono, bloquear shell, cache limpo no logout |
| hardcodes escaparem dos tokens | alta | dark ilegível | inventário visual, lint/revisão e matriz por rota |
| accent falhar contraste | média | barreira de acesso | pares por tema e gate AA antes do merge |
| respostas PATCH fora de ordem | média | preferência errada | fila/serialização e resposta canônica |
| linha ausente/race de backfill | baixa | erro de bootstrap | upsert + unicidade + fallback |
| app antigo quebrar | baixa | indisponibilidade | endpoints dedicados e migration aditiva |
| cache capturado por backup | baixa | exposição de escolha visual | apenas enums não sensíveis; nenhuma identidade/token |

## 28. Rollback

Nesta unidade, `git revert <SHA>` remove somente a documentação. Na implementação futura, reverter cliente e backend restaura o visual anterior e deixa tabela/valores inertes. Não apagar preferências no rollback. Migration reversa destrutiva não é autorizada; eventual remoção definitiva exige nova decisão e backup. Validar rollback com cliente antigo contra backend novo e cliente revertido com banco contendo linhas.

## 29. Dúvidas

Não há dúvida bloqueante. O accent fechado, endpoints dedicados, entidade 1:1, defaults, cache, LWW e aplicação automática foram decididos pela tarefa atual.

## 30. Decisões aprovadas

| Data | Decisão | Responsável pela aprovação | Consequência |
|---|---|---|---|
| 2026-08-12 | Appearance `SYSTEM/LIGHT/DARK`, default SYSTEM. | tarefa atual | sistema é respeitado sem setup |
| 2026-08-12 | Accent fechado `BLUE/TEAL/PURPLE/ORANGE`, default BLUE. | tarefa atual | sem CSS/hex arbitrário |
| 2026-08-12 | `UserPreferences` explícito, não nullable, backend canônico. | tarefa atual | migration aditiva futura |
| 2026-08-12 | GET/PATCH dedicados em `/users/me/preferences`. | tarefa atual | `/users/me` e app antigo preservados |
| 2026-08-12 | Cache somente dos enums; servidor prevalece; limpar no logout. | tarefa atual | cold start sem credenciais/vazamento entre usuários |
| 2026-08-12 | Preview imediato, persistência automática e rollback visual em erro. | tarefa atual | interação inequívoca |
| 2026-08-12 | LWW pela confirmação/`updatedAt` do servidor. | tarefa atual | concorrência simples e observável |

## 31. Definition of Done específica

### Para esta unidade documental

- [x] Auditoria obrigatória e distinção AS-IS/TO-BE registradas.
- [x] Appearance, accent, persistência, API, cache/cold start e concorrência fechados.
- [x] Acessibilidade, tokens, migration, rollout/rollback e 24 GWT definidos.
- [x] Escopo restrito aos dois documentos autorizados, sem dependência ou runtime.
- [ ] Verificações documentais e evidências registradas no PR.

### Para a futura implementação

- [ ] Todos os CA-01 a CA-24 atendidos.
- [ ] Migration nova testada sem editar migration aplicada.
- [ ] Matriz LIGHT/DARK × quatro accents aprovada em contraste, foco, semântica e 200%.
- [ ] Web e Android físico validados em cold start, restore, force-stop, logout e Back.
- [ ] Lint, format, typecheck, testes unitários/integração/contrato/E2E e builds web/Android aprovados.
- [ ] Evidências sanitizadas e auditoria de storage confirmam ausência de tokens e dados pessoais/financeiros.

## 32. Histórico de alterações da SPEC

| Data | Alteração | Motivo | Autor | Aprovador, quando aplicável |
|---|---|---|---|---|
| 2026-08-12 | Criação e aprovação da SPEC-018; inclusão no índice. | definir personalização visual sincronizada | Codex Cloud | tarefa `PROMPT-SPEC-018-PERSONALIZACAO-VISUAL.md` |
