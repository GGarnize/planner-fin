# SPEC de funcionalidade — `SPEC-012 — Android interno com Capacitor`

> Esta SPEC aprova uma implementação futura. Esta unidade é exclusivamente documental e não instala Capacitor, não gera Android nem produz APK.

## 1. Identificação

| Campo | Valor |
|---|---|
| ID | `SPEC-012` |
| Título | `Android interno com Capacitor` |
| Responsável | `Codex Cloud` |
| Data de criação | `2026-08-10` |
| Última atualização | `2026-08-10` |
| Tarefa relacionada | `PROMPT-SPEC-012-ANDROID-INTERNO-CAPACITOR.md` |
| Documentos relacionados | [SPEC-000](SPEC-000-SCAFFOLD-TECNICO.md), [SPEC-002](SPEC-002-AUTENTICACAO-E-ISOLAMENTO-POR-USUARIO.md), [SPEC-011](SPEC-011-DASHBOARD-FINANCEIRO.md), [ADR-001](../adr/ADR-001-ARQUITETURA-GERAL.md), [ADR-002](../adr/ADR-002-APLICACAO-CLIENTE.md), [fluxo Git](../process/GIT-WORKFLOW.md), [Definition of Done](../quality/DEFINITION-OF-DONE.md) e [estratégia de testes](../quality/TEST-STRATEGY.md) |

## 2. Status

`Aprovada`

**Aprovada por:** tarefa `PROMPT-SPEC-012-ANDROID-INTERNO-CAPACITOR.md`, em `2026-08-10`.

## 3. Contexto

O merge `22a8920`, do PR #45, está na base desta unidade e contém a correção da SPEC-011. O MVP possui uma SPA Vue 3/Quasar, API NestJS e contratos compartilhados. ADR-002 já escolhe base responsiva compartilhada e Capacitor para Android; SPEC-000 adiou apenas o empacotamento definitivo.

A inspeção confirmou monorepo pnpm, web em `apps/web`, Vite sem integração Quasar CLI, Vue Router com `createWebHistory`, API em `/api`, e ausência de Capacitor no manifesto, lockfile e arquivos. O frontend já usa `VITE_API_BASE_URL`, com fallback atual `http://localhost:3000/api`; a raiz e a web ainda declaram versão `0.0.0`.

A autenticação atual mantém access token no estado reativo em memória, usa `fetch` com `credentials: 'include'`, refresh `HttpOnly` em `/api/auth`, cookie CSRF legível por JavaScript em `/`, ambos `SameSite=Lax` e `Secure` configurável. O guard exige cookie/header double-submit e `Origin` exatamente igual à única origem CORS configurada. Portanto, o desenho browser atual não funciona sem extensão explícita em um WebView de origem distinta: `SameSite=Lax`, leitura de `document.cookie` e allowlist de uma origem são pontos críticos.

## 4. Problema

O MVP não possui shell Android, processo gratuito de APK interno nem contrato seguro para uma SPA local chamar API remota. Usar `/api` relativo apontaria para o host local do WebView; copiar a SPA criaria dois frontends; e adaptar cookies improvisadamente poderia violar a SPEC-002.

## 5. Objetivo

Definir uma única entrega Android interna, reproduzível e sem custo adicional obrigatório: assets da mesma SPA empacotados por Capacitor, API configurável, autenticação compatível com SPEC-002, APK assinado localmente e validação em dispositivo físico.

## 6. Fora do escopo

- Implementação, dependências, Gradle, projeto nativo, APK, assinatura, CI, deploy ou hosting nesta unidade documental.
- iOS, Play Store, AAB obrigatório, auto-update, deep/app links e frontend Android separado.
- Full offline, banco local, sincronização, fila, background service ou feature móvel exclusiva.
- Push, câmera, biometria, filesystem, SQLite, geolocalização, notificações, share, haptics e analytics.
- Appium, Maestro ou Detox obrigatórios; live reload é opcional.

## 7. Termos

| Termo | Definição adotada nesta SPEC |
|---|---|
| Shell local | WebView Capacitor que carrega assets compilados incluídos no APK. |
| Internal | Variante release assinada para sideload, não publicada em loja. |
| Origem Capacitor | Origem HTTPS local efetiva do runtime Android fixado; para a configuração padrão aprovada, `https://localhost`. |
| Bootstrap CSRF | Operação pública e não mutável que entrega token CSRF no corpo e cookie correspondente, protegida por CORS, antes do refresh. |
| Cleartext | HTTP sem TLS, permitido somente em debug e para hosts explicitamente declarados. |

## 8. Comportamento atual

- `apps/web` gera `dist/`, não possui Capacitor/Android e usa history mode.
- `VITE_API_BASE_URL` já é o mecanismo de API; `.env.example` aponta para localhost.
- A API aceita uma origem HTTP/HTTPS em `API_CORS_ORIGIN`, com credenciais.
- Login entrega refresh HttpOnly e CSRF; restore lê CSRF em `document.cookie` e chama refresh.
- Não foi encontrada persistência intencional em `localStorage`, `sessionStorage` ou IndexedDB.
- Scripts raiz cobrem web/API, qualidade e banco, mas não Android.

## 9. Comportamento desejado

### 9.1 Arquitetura, estrutura e ownership

A implementação usará Capacitor empacotado: `apps/web/dist` será copiado para o APK; não haverá site remoto como UI principal, iframe ou browser externo como shell. Vue, Quasar, router, contratos, API e regras de domínio permanecem únicos.

A configuração ficará em `apps/web/capacitor.config.ts` e o projeto nativo versionado em `apps/web/android/`. Código-fonte, Gradle wrapper, Manifest, recursos e configurações reproduzíveis serão versionados. `node_modules`, `dist`, caches Gradle, outputs `build/`, APK/AAB, propriedades locais, keystores e segredos serão ignorados. O time web é proprietário do shell e a API continua proprietária de CORS/auth.

### 9.2 Identidade, versão e SDK

- Nome: `PlannerFin`; applicationId imutável entre ambientes: `com.plannerfin.app`.
- A fonte canônica de `versionName` será a versão SemVer de `apps/web/package.json`, iniciada em `0.1.0` na implementação. Android consumirá/validará esse valor; duplicação inevitável deverá falhar em script local se divergir.
- `versionCode` é inteiro monotônico mantido na configuração Android e incrementado em todo APK atualizável. Release não será automatizada.
- A implementação fixará uma versão estável do Capacitor e registrará exatamente JDK, Gradle, compile/min/target SDK. Deve usar o mínimo suportado por essa versão e target/compile compatíveis com os requisitos Android vigentes na data da implementação, nunca números desta SPEC por memória.

### 9.3 Dependências e build

Dependências mínimas aprovadas: `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` e `@capacitor/app` somente para o evento de botão voltar/lifecycle. Nenhum outro plugin é aprovado sem revisão da SPEC e justificativa técnica. Cookies e HTTP devem usar APIs Web padrão primeiro; plugin oficial só poderá ser proposto por revisão se o teste de compatibilidade bloquear o contrato seguro.

Scripts em `apps/web` e atalhos raiz deverão construir a SPA, sincronizar assets, abrir Android Studio, gerar debug e gerar internal quando a configuração local de assinatura existir. Os nomes finais serão documentados na implementação, sem serviço externo.

### 9.4 API, HTTPS e desenvolvimento

Preserva-se `VITE_API_BASE_URL`. Web pode usar URL relativa ou a URL atual; Android exige URL absoluta, com `/api`, definida no build. URL de API é pública, não segredo, e nenhuma URL produtiva ficará hardcoded. Dispositivo usa IP LAN explícito; emulador pode usar o mapeamento de host documentado; não haverá descoberta automática.

Internal/release aceita somente HTTPS. HTTP local exige variante debug, host explícito em `networkSecurityConfig` de debug e allowlist de desenvolvimento; release bloqueia cleartext globalmente. O APK requer API alcançável, mas hosting não é escolhido por esta SPEC.

### 9.5 Autenticação, cookies, CORS e CSRF

A origem Android aprovada é `https://localhost`, padrão HTTPS/hostname do Capacitor Android a ser confirmado por teste automatizado/manual na versão fixada. Alterar scheme/hostname exige revisão de segurança. A API evoluirá de origem única para lista explícita contendo origens web autorizadas e, no ambiente Android, exatamente `https://localhost`; nunca `*` com credenciais.

Para compatibilizar cross-site sem persistir token:

1. login/cadastro responde como hoje, mantendo access token somente em memória;
2. refresh permanece em cookie HttpOnly, `Secure`, escopo mínimo `/api/auth` e `SameSite=None` somente no fluxo HTTPS Android; o browser web deve conservar comportamento seguro equivalente e regressão testada;
3. CSRF permanece double-submit e não é credencial de sessão;
4. no cold start, o cliente chama um endpoint futuro de bootstrap CSRF, sem mutação nem autenticação, com `credentials: include`; a resposta CORS permitida define cookie CSRF `Secure; SameSite=None; Path=/` e devolve o mesmo valor no corpo;
5. o token CSRF fica apenas em memória e segue no header `X-CSRF-Token`; refresh/logout exigem cookie, header e `Origin: https://localhost` na allowlist;
6. refresh gira a sessão/cookies como na SPEC-002; reuse detection, prazos, logout e erros permanecem iguais.

Na implementação, a origem só recebe `SameSite=None; Secure` quando está presente simultaneamente em `API_CORS_ORIGINS` e `API_CROSS_SITE_ORIGINS` (ver `apps/api/src/config/env.ts`); fora dessa interseção o cookie continua `SameSite=Lax`. `API_CROSS_SITE_ORIGINS` tem default `https://localhost` quando ausente, mas todo ambiente (local, PRD) deve declarar `https://localhost` explicitamente em ambas as variáveis para que a sessão do app Android sobreviva a `am force-stop`/reabertura — sem isso, o cookie de refresh não é enviado como cross-site e o usuário volta à tela de login.

O endpoint bootstrap não expõe sessão, não renova credenciais e deve ter resposta não cacheável e rate limit razoável. Um atacante cross-origin pode provocar a emissão, mas não ler o corpo por CORS e não satisfaz cookie/header/origem. A implementação é bloqueada antes do merge se Android WebView não aceitar/enviar os cookies neste fluxo; é proibido contornar com localStorage, desativar CSRF, remover HttpOnly/Secure ou abrir CORS. Nesse caso, revisão humana da SPEC deverá aprovar alternativa oficial segura.

No resume não há serviço nem refresh permanente: a SPA é reaproveitada; a primeira operação que receber 401 executa bootstrap/refresh uma vez e repete uma vez, ou volta ao login.

### 9.6 Navegação e lifecycle

Cold start carrega assets, obtém CSRF, tenta restore e segue para dashboard ou login. History mode deve funcionar em reload local, inclusive `/dashboard`, `/accounts`, `/transactions`, `/transfers`, `/recurrences`, `/cards`, `/debts` e `/budgets`. Links internos ficam no app; URL externa HTTPS validada abre navegador externo; não há app links.

Com `@capacitor/app`, voltar usa histórico útil da SPA; em dashboard/raiz sem histórico útil delega ao comportamento Android de sair/minimizar, sem confirmação obrigatória. O handler é instalado apenas no runtime nativo e não altera o botão do browser.

### 9.7 Offline e interface Android

Assets abrem offline, mas dados financeiros exigem API. Não criar, editar, enfileirar ou sincronizar offline; reutilizar estados claros de indisponibilidade e tentativa novamente.

Quasar/CSS é a primeira solução para teclado, scroll, viewport e safe areas. Inputs e ações não podem ficar cobertos; portrait e landscape são permitidos. Splash simples, ícone próprio/placeholder do projeto e status bar legível bastam; nenhuma imagem é criada nesta unidade. `FLAG_SECURE` não será usado: screenshots ficam permitidos, com dados sintéticos em evidências.

### 9.8 Permissões, backup, armazenamento e logs

Manifest terá apenas `INTERNET` e permissões técnicas não sensíveis estritamente geradas/justificadas. Câmera, localização, contatos, storage amplo, notificações e microfone são proibidos. Backup Android será desabilitado ou terá regras de exclusão comprovadas para cookies, WebView e dados sensíveis. Não haverá persistência nova de dados financeiros, access/refresh token, senha ou payload em localStorage, sessionStorage ou IndexedDB.

Logs são somente de desenvolvimento, sanitizados, sem token, cookie, senha, valor financeiro ou payload. Não haverá analytics/crash SDK.

### 9.9 Assinatura, artefato, distribuição e atualização

Debug usa chave padrão local. Internal usa keystore próprio local, nunca versionado; senha/caminho entram por ambiente ou propriedades locais ignoradas, com backup privado sob responsabilidade do mantenedor. O artefato será `planner-fin-<version>-internal.apk`, assinado e não versionado. Distribuição é transferência manual e sideload; a permissão temporária de fonte desconhecida é passo operacional do dispositivo, não política permanente. Play Store, Firebase, App Center, GitHub Releases e serviço pago não são requisitos.

Upgrade instala APK com mesmo applicationId/chave e `versionCode` maior. Dados permanecem no backend; o app tolera perda de sessão e novo login. Não há auto-update ou AAB obrigatório.

### 9.10 Ambiente Windows

Documentação futura deverá funcionar diretamente no Windows com Node/pnpm do projeto, JDK compatível, Android Studio ou SDK command-line tools, SDK/Build Tools, Gradle wrapper versionado e dispositivo USB debugging ou emulador. Docker/WSL não são requisitos Android. Live reload é opcional; build/sync é o fluxo canônico.

## 10. Personas ou atores

| Ator | Necessidade | Ações autorizadas |
|---|---|---|
| Mantenedor | Gerar e assinar APK sem custo. | Configurar ambiente local, build, assinatura e sideload. |
| Usuário de teste | Usar MVP em dispositivo próprio. | Instalar, atualizar, autenticar e usar os domínios existentes. |
| SPA compartilhada | Operar em browser e WebView. | Consumir a mesma API e contratos. |
| API | Proteger sessão e dados. | Validar origem, CORS, CSRF, Bearer e ownership. |

## 11. Fluxos

### 11.1 Fluxo principal

1. Mantenedor configura `VITE_API_BASE_URL` HTTPS e versão.
2. Scripts constroem a SPA, sincronizam Capacitor e geram APK internal assinado.
3. APK é transferido e instalado por sideload.
4. Shell abre assets locais, realiza bootstrap CSRF e restore.
5. Usuário entra e navega na mesma SPA; API aplica as mesmas regras.
6. Nova versão incrementa `versionCode` e é instalada sobre a anterior.

### 11.2 Fluxos alternativos e exceções

- API inacessível → UI local abre e informa indisponibilidade, sem escrita offline.
- Sessão inválida → limpar memória e exigir login.
- Cookie incompatível no WebView → bloquear implementação; não enfraquecer auth.
- Keystore ausente → debug continua possível; internal falha com instrução sanitizada.
- HTTP em internal/release → build ou comunicação falha de forma explícita.
- Link externo inseguro/não reconhecido → não navegar silenciosamente no WebView.

## 12. Regras de negócio

| ID | Regra | Origem/decisão | Exemplo |
|---|---|---|---|
| `RN-01` | Android é shell da mesma SPA. | ADR-002 e tarefa. | Não existe `apps/android` com Vue. |
| `RN-02` | API Android é absoluta e configurada no build. | Tarefa. | Endpoint LAN em debug. |
| `RN-03` | Internal/release usa HTTPS. | Segurança. | Cleartext bloqueado. |
| `RN-04` | Auth preserva refresh HttpOnly e access token em memória. | SPEC-002. | Nenhum token em storage JS. |
| `RN-05` | CORS e CSRF usam allowlist/origem explícita. | SPEC-002. | `https://localhost`. |
| `RN-06` | Não há operação financeira offline. | Online-first. | Falha de rede não enfileira lançamento. |
| `RN-07` | APK internal custa zero adicional obrigatório. | Tarefa. | Sideload local. |
| `RN-08` | Dispositivo físico é obrigatório para aceite futuro. | Tarefa. | Checklist registrado com dados fictícios. |

## 13. Modelo de dados

Não aplicável: o shell não cria entidade, banco local, migration ou transformação de dados. Preferências não sensíveis existentes poderão continuar no mecanismo web somente após auditoria; não foram encontradas no estado atual.

## 14. Contratos de API

Os contratos financeiros permanecem inalterados. A implementação futura poderá acrescentar somente o bootstrap CSRF descrito na seção 9.5 e generalizar configuração de allowlist, mediante testes de contrato. Entrada: nenhuma credencial/body. Sucesso: token CSRF efêmero no corpo e cookie correspondente. Erros: `403` origem não permitida, `429` limite e envelope existente. Autorização: pública, mas restrita por Origin/CORS. Idempotência: repetível, sem mutação de domínio.

## 15. Interface

A mesma interface responsiva será usada. Estados obrigatórios: restauração, login, conteúdo autenticado, API indisponível e sessão expirada. Teclado, safe area, portrait/landscape, scroll e contraste da status bar serão verificados em aparelho. Não há tela ou domínio Android exclusivo.

## 16. Validações

| Entrada/configuração | Validação | Falha esperada |
|---|---|---|
| `VITE_API_BASE_URL` Android | URL absoluta; HTTPS fora de debug; termina/resolve `/api`. | Build/startup falha claramente. |
| Origem | Lista exata de origens válidas. | API não inicia com wildcard/valor inválido. |
| Versão | SemVer igual à fonte canônica; versionCode positivo/monotônico. | Validação local falha. |
| Assinatura | Arquivo e variáveis locais presentes no internal. | Build falha sem revelar segredo. |
| Manifest | Sem permissão sensível não aprovada. | Auditoria bloqueia entrega. |

## 17. Permissões

| Ação | Ator autorizado | Condição | Comportamento quando negado |
|---|---|---|---|
| Consumir API | Usuário autenticado | Mesma autorização backend. | Erro existente, sem bypass nativo. |
| Instalar APK | Proprietário do dispositivo | Sideload conscientemente habilitado. | Android bloqueia instalação. |
| Assinar internal | Mantenedor | Keystore local disponível. | Build internal falha. |
| Usar sensores/dados do aparelho | Nenhum ator nesta SPEC. | Fora do escopo. | Permissão não existe. |

## 18. Segurança e privacidade

- WebView: assets locais e origem Android fixa `https://localhost`; navegação remota principal proibida.
- CORS: allowlist por ambiente, credenciais habilitadas somente para origens exatas; wildcard proibido.
- CSRF: bootstrap não cacheável, cookie/header double-submit e Origin validado; proteção nunca desativada.
- Cookies: refresh HttpOnly, Secure e path mínimo; cross-site usa SameSite=None sob HTTPS; CSRF não HttpOnly e permanece apenas em memória após bootstrap.
- Tokens: access token apenas em memória; refresh inacessível a JavaScript; nenhum token em storage.
- Transporte: HTTPS em internal/release; cleartext restrito a host/debug.
- Backup: excluir/desabilitar backup de WebView/cookies/dados sensíveis e testar restore/backup.
- Permissões: Manifest mínimo e auditado.
- Assinatura/segredos: keystore, senhas, propriedades e credenciais fora do Git; URL da API não é segredo.
- Logs/evidências: sem tokens, cookies, senhas, payloads, valores ou dados pessoais/financeiros reais.
- Screenshots: permitidos sem `FLAG_SECURE`; somente dados sintéticos.

## 19. Erros e estados vazios

| Situação | Estado apresentado | Recuperação esperada |
|---|---|---|
| Sem rede/API | API indisponível. | Tentar novamente após rede voltar. |
| Restore falha | Login. | Autenticar novamente. |
| Timeout | Mensagem técnica segura. | Repetição explícita; sem fila. |
| Configuração inválida | Falha técnica clara. | Corrigir build/configuração. |
| Sem keystore | Build internal indisponível. | Configurar segredo local; usar debug para desenvolvimento. |

## 20. Observabilidade

Somente Logcat de desenvolvimento e logs web sanitizados. Não instalar analytics, crash reporting, tracing ou serviço pago. Evidências registram versão/ambiente e resultado, nunca payload financeiro ou credencial.

## 21. Migração e compatibilidade

Não há migration. Web, cookies browser, rotas e API financeira devem permanecer compatíveis. O Android adiciona cliente da mesma API. Rollout é manual; uma atualização pode exigir novo login. SDKs exatos são fixados na implementação e revistos em atualização futura.

## 22. Critérios de aceite

### `CA-01 — Arquitetura única`

**Dado** a implementação Android final
**Quando** a árvore do repositório for inspecionada
**Então** deve existir uma única SPA Vue/Quasar em `apps/web`, compartilhada por web e Android, sem segundo frontend Vue/React em `apps/android` ou equivalente.

### `CA-02 — Assets locais`

**Dado** um APK instalado sem conexão com a API
**Quando** o aplicativo for aberto
**Então** a UI empacotada deve carregar localmente até o estado de indisponibilidade da API, sem baixar a aplicação web de um host remoto.

### `CA-03 — Local canônico`

**Dado** o shell Android gerado
**Quando** os arquivos versionados forem listados
**Então** a configuração Capacitor deve estar em `apps/web/capacitor.config.ts` e o projeto Android em `apps/web/android/`.

### `CA-04 — Application ID`

**Dado** qualquer variante Android
**Quando** o package/application id for inspecionado
**Então** deve ser exatamente `com.plannerfin.app`.

### `CA-05 — Nome público`

**Dado** o APK instalado
**Quando** o launcher exibir o app
**Então** o nome deve ser `PlannerFin`.

### `CA-06 — Fonte de versão`

**Dado** uma versão SemVer em `apps/web/package.json`
**Quando** o build Android for preparado
**Então** o `versionName` deve corresponder à fonte canônica e uma divergência detectável deve falhar a validação local.

### `CA-07 — Version code`

**Dado** dois APKs internal consecutivos atualizáveis
**Quando** seus metadados forem comparados
**Então** o segundo `versionCode` deve ser inteiro e maior que o primeiro.

### `CA-08 — SDK compatível`

**Dado** a versão fixada do Capacitor
**Quando** a configuração Android for inspecionada e o build executado
**Então** JDK/Gradle/min/compile/target SDK devem estar dentro da matriz suportada e documentada para essa versão, e o build deve concluir.

### `CA-09 — Dependências mínimas`

**Dado** o `apps/web/package.json`
**Quando** as dependências móveis forem auditadas
**Então** devem existir apenas as dependências Capacitor aprovadas necessárias: core, cli, android e app, salvo alteração futura formalmente aprovada.

### `CA-10 — Sem plugins supérfluos`

**Dado** o lockfile/package Android final
**Quando** plugins Capacitor/Cordova forem enumerados
**Então** não deve haver câmera, geolocalização, filesystem, SQLite, notificações, share, haptics ou outro plugin fora do escopo.

### `CA-11 — API absoluta Android`

**Dado** um build Android
**Quando** sua configuração de ambiente for validada
**Então** `VITE_API_BASE_URL` deve ser uma URL absoluta que alcance o backend e contenha ou resolva o prefixo `/api`.

### `CA-12 — API relativa web`

**Dado** o build web normal
**Quando** for usado no fluxo web existente
**Então** deve continuar aceitando a configuração web aprovada, inclusive base relativa quando esse for o ambiente, sem exigir a URL absoluta exclusiva do Android.

### `CA-13 — URL sem segredo`

**Dado** a URL da API no bundle
**Quando** secrets forem auditados
**Então** a URL pode estar visível, mas nenhum token, senha, segredo de keystore ou credencial deve estar embutido junto dela.

### `CA-14 — Endpoint de dispositivo`

**Dado** aparelho ou emulador apontando para backend de desenvolvimento
**Quando** a URL for configurada
**Então** deve ser um endereço explicitamente alcançável pelo dispositivo, sem autodiscovery.

### `CA-15 — HTTPS interno`

**Dado** build internal/release
**Quando** `VITE_API_BASE_URL` e a política de rede forem validadas
**Então** a API deve usar HTTPS e a variante não deve autorizar cleartext genérico.

### `CA-16 — HTTP somente debug`

**Dado** variante debug configurada para backend HTTP local
**Quando** a política de rede for inspecionada
**Então** cleartext deve ser permitido apenas para hosts de desenvolvimento explicitamente declarados.

### `CA-17 — Cleartext release`

**Dado** um build internal/release
**Quando** uma tentativa de acesso HTTP for feita
**Então** a comunicação deve ser bloqueada ou falhar; não pode existir `usesCleartextTraffic=true` global para release.

### `CA-18 — Origem Android`

**Dado** a versão Capacitor fixada e o app rodando em aparelho
**Quando** `window.location.origin` e o Origin efetivo forem verificados
**Então** ambos devem ser `https://localhost`; divergência bloqueia o merge e exige revisão da configuração ou da SPEC.

### `CA-19 — Allowlist CORS`

**Dado** a API configurada para web e Android
**Quando** CORS for testado
**Então** somente origens explicitamente aprovadas, incluindo `https://localhost` no ambiente Android, devem receber resposta CORS com credenciais.

### `CA-20 — Sem wildcard CORS`

**Dado** CORS com credenciais habilitadas
**Quando** a configuração e os headers forem auditados
**Então** `Access-Control-Allow-Origin: *` não pode ser usado.

### `CA-21 — Bootstrap CSRF`

**Dado** um cold start Android sem token CSRF em memória
**Quando** o bootstrap CSRF for chamado da origem aprovada
**Então** deve retornar token no corpo, emitir cookie CSRF correspondente, não autenticar nem renovar sessão e marcar a resposta como não cacheável.

### `CA-22 — Double-submit`

**Dado** um refresh ou logout mutável
**Quando** o cookie CSRF ou `X-CSRF-Token` estiver ausente ou divergente
**Então** a API deve rejeitar a operação; com ambos iguais e origem válida, a validação CSRF pode prosseguir.

### `CA-23 — Origin CSRF`

**Dado** cookie e header CSRF válidos
**Quando** a requisição vier de origem não permitida
**Então** a API deve rejeitá-la.

### `CA-24 — Refresh HttpOnly`

**Dado** um login ou refresh Android bem-sucedido
**Quando** JavaScript tentar ler o refresh token
**Então** ele não deve estar acessível por `document.cookie` nem por outra API JavaScript.

### `CA-25 — Cookie Secure`

**Dado** um cookie de refresh ou CSRF usado no fluxo Android internal
**Quando** os atributos forem inspecionados
**Então** o cookie deve usar `Secure`.

### `CA-26 — Cookie SameSite`

**Dado** o fluxo cross-site seguro do WebView Android
**Quando** os cookies necessários forem emitidos
**Então** devem possuir o atributo SameSite aprovado para esse fluxo (`None` sob HTTPS), enquanto regressões do browser web permanecem cobertas.

### `CA-27 — Access token em memória`

**Dado** uma sessão autenticada
**Quando** os stores web forem inspecionados
**Então** o access token deve existir apenas no estado em memória do processo da SPA.

### `CA-28 — Sem token em storage`

**Dado** login, refresh, reload e logout concluídos
**Quando** localStorage, sessionStorage e IndexedDB forem auditados
**Então** nenhum access token, refresh token ou senha deve estar persistido.

### `CA-29 — Login`

**Dado** um usuário válido e API alcançável
**Quando** fizer login no Android
**Então** deve receber sessão conforme a SPEC-002 e chegar à rota autenticada sem mecanismo nativo paralelo de autenticação.

### `CA-30 — Restauração fria`

**Dado** um refresh cookie válido e o app encerrado
**Quando** houver cold start
**Então** a SPA deve executar bootstrap CSRF e restore e recuperar a sessão sem exigir senha novamente.

### `CA-31 — Refresh expirado`

**Dado** um refresh expirado ou revogado
**Quando** o app tentar restaurar a sessão
**Então** deve limpar o estado autenticado em memória e apresentar o login.

### `CA-32 — Logout`

**Dado** uma sessão Android válida
**Quando** o usuário fizer logout
**Então** o refresh deve ser invalidado ou limpo conforme a SPEC-002 e o estado autenticado em memória deve ser removido.

### `CA-33 — Rotação e reutilização`

**Dado** um refresh token rotacionado
**Quando** o token antigo for reutilizado
**Então** deve aplicar a detecção e revogação já definidas na SPEC-002, sem exceção para Android.

### `CA-34 — Resume`

**Dado** o app em background por tempo suficiente para o access token expirar
**Quando** retornar e a primeira operação receber 401
**Então** o fluxo aprovado deve tentar bootstrap/refresh uma vez e repetir a operação uma vez, ou retornar ao login.

### `CA-35 — Sem refresh de fundo`

**Dado** o app em background
**Quando** não houver ação do usuário nem resume
**Então** não deve existir serviço periódico ou background refresh mantendo a sessão.

### `CA-36 — Rota dashboard`

**Dado** uma sessão restaurada ou login sem deep link
**Quando** o Android concluir a autenticação
**Então** deve abrir `/dashboard`.

### `CA-37 — Rotas de domínio`

**Dado** um usuário autenticado
**Quando** navegar para accounts, transactions, transfers, recurrences, cards, debts e budgets
**Então** as mesmas rotas e SPA web devem funcionar dentro do shell Android.

### `CA-38 — Reload SPA`

**Dado** uma rota interna ativa no shell
**Quando** a WebView ou SPA recarregar
**Então** o app deve voltar à SPA válida sem 404 ou arquivo inexistente e preservar o fluxo de autenticação e restauração esperado.

### `CA-39 — Links internos`

**Dado** um link para rota interna PlannerFin
**Quando** for acionado no Android
**Então** deve permanecer na SPA e na WebView.

### `CA-40 — Links externos`

**Dado** um link HTTPS externo permitido
**Quando** for acionado
**Então** deve abrir no navegador externo, sem substituir a SPA principal por navegação remota.

### `CA-41 — Sem deep links`

**Dado** a instalação MVP
**Quando** o Android consultar intent filters e app links
**Então** não deve haver deep link universal nem app link de domínio financeiro configurado nesta versão.

### `CA-42 — Voltar com histórico`

**Dado** um histórico interno útil, por exemplo dashboard para cards
**Quando** o usuário pressionar Back após navegar para cards
**Então** deve retornar à rota SPA anterior.

### `CA-43 — Voltar na raiz`

**Dado** o dashboard ou raiz sem histórico interno útil
**Quando** o usuário pressionar Back
**Então** deve delegar ao comportamento Android aprovado para sair ou minimizar, sem diálogo customizado obrigatório.

### `CA-44 — Browser preservado`

**Dado** a aplicação rodando no browser normal
**Quando** o usuário usar os botões Back ou Forward
**Então** o handler Android não deve interceptar nem alterar esse comportamento.

### `CA-45 — Offline explícito`

**Dado** um APK iniciado sem acesso à API
**Quando** os assets locais carregarem
**Então** a interface deve apresentar estado de indisponibilidade e não fingir dados financeiros atuais.

### `CA-46 — Falha da API`

**Dado** uma sessão aberta e a API ficar indisponível
**Quando** o usuário executar leitura ou escrita
**Então** a UI deve reutilizar o estado de erro e retry e não confirmar operação inexistente.

### `CA-47 — Sem fila offline`

**Dado** a API offline
**Quando** o usuário tentar criar ou editar dado financeiro
**Então** a operação não deve ser persistida em fila local para sincronização futura.

### `CA-48 — Teclado`

**Dado** um formulário com input próximo à parte inferior da tela
**Quando** o teclado virtual abrir
**Então** o campo focado e a ação principal devem continuar alcançáveis por resize ou scroll.

### `CA-49 — Safe area`

**Dado** um aparelho com recorte ou insets
**Quando** o app for exibido
**Então** o conteúdo e as ações principais não devem ficar sob status bar, navigation bar ou cutout.

### `CA-50 — Orientação`

**Dado** um aparelho em portrait ou landscape
**Quando** a orientação mudar
**Então** a SPA deve continuar utilizável sem bloqueio artificial de orientação.

### `CA-51 — Splash e ícone`

**Dado** um build Android com assets visuais configurados
**Quando** o app iniciar ou aparecer no launcher
**Então** deve usar assets próprios do PlannerFin ou placeholders próprios aprovados, sem marca de terceiros.

### `CA-52 — Status bar`

**Dado** os temas e telas principais
**Quando** a status bar estiver visível
**Então** ícones e texto devem manter contraste legível.

### `CA-53 — Permissão INTERNET`

**Dado** o Manifest final preparado para acesso à API
**Quando** as permissões forem listadas
**Então** deve conter a permissão de rede necessária para acessar a API.

### `CA-54 — Sem permissão sensível`

**Dado** o Manifest final
**Quando** as permissões forem auditadas
**Então** não deve solicitar câmera, localização, contatos, storage amplo, notificações nem microfone.

### `CA-55 — Backup protegido`

**Dado** a configuração Android internal
**Quando** as regras de backup forem inspecionadas e testadas
**Então** cookies, WebView, tokens e dados sensíveis não devem ser restauráveis por backup Android indevido.

### `CA-56 — Screenshots permitidos`

**Dado** um build internal
**Quando** o usuário tirar screenshot
**Então** o Android pode permitir a captura; `FLAG_SECURE` não é requisito desta versão.

### `CA-57 — Auditoria de storage`

**Dado** o uso dos principais domínios
**Quando** os storages JavaScript e WebView forem auditados após navegação e login
**Então** não deve existir persistência nova de payload financeiro sensível nem credenciais.

### `CA-58 — Assinatura debug`

**Dado** um ambiente de desenvolvimento sem keystore internal
**Quando** um debug APK for gerado
**Então** o build deve usar a assinatura debug padrão e concluir sem segredo de release.

### `CA-59 — Assinatura interna`

**Dado** keystore e propriedades locais válidos
**Quando** um internal APK for gerado
**Então** o APK deve sair assinado com a chave própria configurada.

### `CA-60 — Segredos de assinatura`

**Dado** o repositório e commit final
**Quando** o secret scan e o Git forem auditados
**Então** keystore, senha e propriedades secretas não devem estar versionados.

### `CA-61 — APK interno`

**Dado** um build internal concluído
**Quando** o artefato for coletado
**Então** deve existir APK assinado nomeado no padrão `planner-fin-<version>-internal.apk`.

### `CA-62 — APK fora do Git`

**Dado** um APK gerado
**Quando** `git status` e `.gitignore` forem verificados
**Então** o APK não deve ser rastreado nem versionado.

### `CA-63 — Sideload`

**Dado** um APK internal assinado e aparelho autorizado pelo usuário
**Quando** a instalação manual for executada
**Então** o app deve instalar sem depender de Play Store, Firebase ou App Center.

### `CA-64 — Sem loja`

**Dado** o processo completo de distribuição MVP
**Quando** seus pré-requisitos forem listados
**Então** nenhuma conta paga de loja nem serviço comercial deve ser necessária.

### `CA-65 — Atualização manual`

**Dado** um APK anterior instalado com a mesma chave e applicationId
**Quando** uma nova versão compatível for instalada
**Então** o Android deve atualizar o app sobre a instalação existente.

### `CA-66 — Version code no upgrade`

**Dado** um APK instalado
**Quando** houver tentativa de instalar um APK de atualização
**Então** o novo `versionCode` deve ser maior; o build ou processo deve impedir ou detectar regressão.

### `CA-67 — Zero custo`

**Dado** a implementação, build e distribuição interna
**Quando** as dependências e os serviços forem auditados
**Então** todas as ferramentas e requisitos obrigatórios devem possuir caminho gratuito, sem gasto adicional necessário.

### `CA-68 — Windows nativo`

**Dado** uma máquina Windows suportada
**Quando** a documentação Android for seguida
**Então** deve ser possível instalar e configurar JDK, Android SDK/Studio e pnpm e executar o build sem WSL ou Docker.

### `CA-69 — Build reproduzível`

**Dado** um checkout limpo com ferramentas e segredos locais documentados
**Quando** os scripts de build forem executados
**Então** deve ser possível reconstruir o debug ou internal APK sem editar manualmente arquivos versionados a cada build.

### `CA-70 — Regressão web`

**Dado** Capacitor e Android implementados
**Quando** o build e as suítes web existentes forem executados
**Então** o browser web deve manter as rotas, autenticação e consumo de API aprovados.

### `CA-71 — Testes compartilhados`

**Dado** a implementação pronta
**Quando** lint, typecheck, testes unitários/shared/API/web e Playwright aplicáveis forem executados
**Então** todos devem passar antes da aceitação Android, ressalvadas apenas limitações ambientais registradas que não escondam falha funcional.

### `CA-72 — Instalação física`

**Dado** um APK internal candidato
**Quando** for instalado em pelo menos um aparelho Android físico
**Então** a instalação e abertura devem funcionar, e a evidência deve registrar modelo, Android e versão do APK sem dados pessoais.

### `CA-73 — Smoke de domínios`

**Dado** um usuário sintético autenticado no aparelho físico
**Quando** percorrer dashboard, accounts, transactions, transfers, recurrences, cards, debts e budgets
**Então** todas as áreas devem carregar e permitir ao menos o fluxo principal aprovado correspondente.

### `CA-74 — Dados sintéticos`

**Dado** testes, screenshot ou gravação de evidência Android
**Quando** dados financeiros forem exibidos
**Então** devem ser exclusivamente fictícios ou sintéticos.

### `CA-75 — Logs sanitizados`

**Dado** o Logcat e console durante o smoke
**Quando** os logs forem inspecionados
**Então** não devem conter senha, access token, refresh token, cookie, payload financeiro nem valores sensíveis.

### `CA-76 — Sem analytics`

**Dado** o APK e as dependências finais
**Quando** SDKs e chamadas de rede forem auditados
**Então** não deve existir analytics, crash reporting nem telemetria de terceiros adicionada por esta SPEC.

### `CA-77 — Sem migration`

**Dado** a implementação Android concluída
**Quando** o diff de Prisma e migrations for inspecionado
**Então** nenhuma migration nem modelo de banco deve ter sido criado por causa do Android.

### `CA-78 — Rollback sem dados`

**Dado** a necessidade de desfazer a implementação Android
**Quando** o commit ou PR for revertido
**Então** Capacitor, shell e configurações relacionadas podem ser removidos sem transformação de dados financeiros nem rollback de migration.

## 23. Testes obrigatórios

| Nível | Critérios relacionados | Cenários mínimos | Evidência esperada |
|---|---|---|---|
| Unitário/shared | CA-06, CA-07, CA-11–CA-14 e CA-34–CA-44 | URL de API, runtime, versão e back handler quando houver helper. | Suites pnpm aprovadas. |
| Integração/contrato | CA-18–CA-35 | allowlist, Origin, CORS credentials, bootstrap/double-submit, cookies e regressão browser. | Testes API sem wildcard. |
| Web | CA-12, CA-27–CA-47 e CA-70–CA-71 | Toda suite atual, build e Playwright. | Comandos raiz aprovados. |
| Android manual | CA-01–CA-17, CA-29–CA-69 e CA-72 | debug/internal, cold start, login/restore/refresh/logout/restart/rede. | Checklist sanitizado. |
| Smoke de domínio | CA-36–CA-37 e CA-73–CA-75 | dashboard, accounts, transactions, transfers, recurrences, cards, debts e budgets. | Resultado por rota. |
| Formulários | CA-48–CA-52 | teclado, select, data, decimal e scroll. | Aparelho real. |
| Rede/segurança | CA-13–CA-28, CA-45–CA-47, CA-53–CA-60 e CA-75–CA-76 | HTTPS, timeout/offline, cleartext debug restrito, cookies, CSRF, CORS, Manifest, backup e keystore. | Checklist e auditorias. |
| Upgrade | CA-07 e CA-58–CA-69 | mesmo ID/chave e versionCode maior. | Instalação sobre versão anterior. |
| Escopo e rollback | CA-01–CA-10, CA-62–CA-64, CA-67 e CA-76–CA-78 | Diff de frontend, plugins, artefatos, serviços, Prisma e migrations. | Revisão do diff e rollback documental. |

Antes de considerar Android pronto, testar em pelo menos um aparelho físico e registrar fabricante/modelo, versão Android, versão APK e checklist, somente com usuário/dados fictícios. Playwright permanece E2E web; automação Android nativa é evolução futura.

## 24. Arquivos permitidos

Nesta unidade documental: somente `docs/specs/SPEC-012-ANDROID-INTERNO-CAPACITOR.md`.

Na implementação futura, conceitualmente: `apps/web/package.json`, lockfile, `apps/web/capacitor.config.ts`, `apps/web/android/**`, env example, configuração/helper de API/auth/router, CORS/CSRF/configuração Nest, documentação Android, `.gitignore`, scripts raiz e testes estritamente relacionados.

## 25. Arquivos proibidos

Nesta unidade: todo arquivo exceto esta SPEC. Na implementação: segundo frontend, `apps/android` com Vue, iOS, migrations, CI, deploy/hosting, APK/AAB/keystore/segredo versionado, plugins/features fora do escopo e alterações de domínio.

## 26. Dependências

| Dependência futura | Motivo | Estado | Impacto |
|---|---|---|---|
| `@capacitor/core` | Runtime do shell. | Aprovada. | Integra SPA e nativo. |
| `@capacitor/cli` | Inicialização/sync local. | Aprovada. | Ferramenta de desenvolvimento. |
| `@capacitor/android` | Plataforma Android. | Aprovada. | Gera projeto nativo. |
| `@capacitor/app` | Back/lifecycle básico. | Aprovada e indispensável. | Handler somente nativo. |

Nenhum plugin adicional ou serviço pago é aprovado. Versões exatas deverão ser compatíveis e fixadas no lockfile na implementação.

## 27. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| WebView rejeitar cookie cross-site. | Média | Bloqueia restore seguro. | Prova em aparelho antes do merge; revisar SPEC, nunca localStorage. |
| Origem efetiva divergir. | Baixa | CORS/CSRF falham. | Fixar Capacitor e testar `https://localhost`. |
| History reload falhar em assets locais. | Média | Navegação quebrada. | Testes de reload/back por rota e configuração Capacitor. |
| Cleartext escapar para release. | Baixa | Exposição de sessão. | Configuração por build e teste negativo. |
| Keystore perdido/vazado. | Baixa | Upgrade impossível/assinatura comprometida. | Backup privado e segredos ignorados. |
| SDK envelhecer. | Média | Build/segurança. | Fixar versões atuais na implementação e revisar upgrades. |
| Backup capturar WebView. | Média | Vazamento local. | Regras de exclusão/desabilitação e teste. |
| Regressão web. | Média | MVP existente quebra. | Suites completas web/API e API relativa preservada. |

Risco residual aceito: screenshots são permitidos no MVP interno para suporte; o usuário deve usar dados sintéticos em evidências. `FLAG_SECURE` pode ser objeto de SPEC futura.

## 28. Rollback

Reverter o commit/merge da futura implementação remove dependências, configuração e shell `apps/web/android`, sem migration ou transformação. Backend/domínio/dados permanecem. APK instalado pode ser desinstalado manualmente; rollback para APK antigo exige versionCode/chave compatíveis ou reinstalação, podendo exigir novo login.

## 29. Dúvidas

Não há dúvida funcional aberta. A compatibilidade de cookies é uma condição técnica de validação com solução aprovada (bootstrap + cookies seguros); falha da prova impede o merge e exige revisão humana, sem autorizar enfraquecimento.

## 30. Decisões aprovadas

| Data | Decisão | Responsável | Consequência |
|---|---|---|---|
| 2026-08-10 | Shell Capacitor com assets locais em `apps/web/android`. | Tarefa atual. | Uma SPA, sem frontend duplicado. |
| 2026-08-10 | `com.plannerfin.app`, `PlannerFin`, SemVer `0.1.0` e versionCode monotônico. | Tarefa atual. | Identidade/upgrade estáveis. |
| 2026-08-10 | API absoluta por `VITE_API_BASE_URL`, HTTPS em internal. | Tarefa atual. | Configuração sem hardcode. |
| 2026-08-10 | Origem Android `https://localhost`, allowlist e bootstrap CSRF. | Tarefa atual + SPEC-002. | Preserva cookies HttpOnly/double-submit. |
| 2026-08-10 | APK assinado localmente e sideload, sem custo/loja. | Tarefa atual. | Distribuição interna manual. |
| 2026-08-10 | Offline, permissões sensíveis, analytics e auto-update excluídos. | Tarefa atual. | Shell mínimo online-first. |

## 31. Definition of Done específica

### Para esta unidade documental

- [x] Somente esta SPEC foi criada; nenhum código/dependência/migration/CI foi alterado.
- [x] Estado atual, conflito de cookies e decisões seguras foram documentados.
- [x] Há 78 critérios Dado/Quando/Então, riscos, rollback, testes e arquivos futuros.
- [x] Nenhum requisito pago, loja, wildcard CORS, token em storage ou permissão sensível foi aprovado.
- [ ] Verificações documentais e evidências registradas no PR.

### Para a implementação futura

- [ ] Todos os 78 critérios concretos CA-01–CA-78 foram atendidos e possuem evidência aplicável.
- [ ] Versões oficiais atuais de Capacitor/Android/JDK/Gradle/SDK registradas.
- [ ] Prova de cookies seguros, CSRF e origem `https://localhost` aprovada em aparelho físico como gate de merge.
- [ ] Ausência da prova de funcionamento dos cookies seguros impede considerar a SPEC-012 implementada.
- [ ] Lint, format check, typecheck, unitários, integração, web E2E e build aprovados.
- [ ] Debug e internal APK instalados; upgrade aprovado.
- [ ] Smoke completo, teclado, safe area, back, lifecycle, rede e segurança aprovados.
- [ ] Manifest, backup, cleartext, storage, logs e assinatura auditados.
- [ ] Evidência usa dados sintéticos e registra aparelho/Android/APK.

## 32. Histórico de alterações da SPEC

| Data | Alteração | Motivo | Autor | Aprovador |
|---|---|---|---|---|
| 2026-08-10 | Criação aprovada da SPEC-012. | Fechar entrega Android interna do MVP com segurança e custo zero. | Codex Cloud | Tarefa atual |
| 2026-08-22 | Documenta que `https://localhost` deve constar em `API_CORS_ORIGINS` e `API_CROSS_SITE_ORIGINS` (ambas) em todo ambiente, incluindo local, para a sessão Android sobreviver a reinício do app. | Investigação de bug real de sessão não persistindo em aparelho físico; config já cobria o caso por default, mas ficava implícita. | Equipe PlannerFin | Solicitante da tarefa |
