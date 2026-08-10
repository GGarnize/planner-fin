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

**Dado** a implementação futura da SPEC-012 e o requisito de arquitetura única
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-02 — Assets locais`

**Dado** a implementação futura da SPEC-012 e o requisito de assets locais
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-03 — Local canônico`

**Dado** a implementação futura da SPEC-012 e o requisito de local canônico
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-04 — Application ID`

**Dado** a implementação futura da SPEC-012 e o requisito de application id
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-05 — Nome público`

**Dado** a implementação futura da SPEC-012 e o requisito de nome público
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-06 — Fonte de versão`

**Dado** a implementação futura da SPEC-012 e o requisito de fonte de versão
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-07 — Version code`

**Dado** a implementação futura da SPEC-012 e o requisito de version code
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-08 — SDK compatível`

**Dado** a implementação futura da SPEC-012 e o requisito de sdk compatível
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-09 — Dependências mínimas`

**Dado** a implementação futura da SPEC-012 e o requisito de dependências mínimas
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-10 — Sem plugins supérfluos`

**Dado** a implementação futura da SPEC-012 e o requisito de sem plugins supérfluos
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-11 — API absoluta Android`

**Dado** a implementação futura da SPEC-012 e o requisito de api absoluta android
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-12 — API relativa web`

**Dado** a implementação futura da SPEC-012 e o requisito de api relativa web
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-13 — URL sem segredo`

**Dado** a implementação futura da SPEC-012 e o requisito de url sem segredo
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-14 — Endpoint de dispositivo`

**Dado** a implementação futura da SPEC-012 e o requisito de endpoint de dispositivo
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-15 — HTTPS interno`

**Dado** a implementação futura da SPEC-012 e o requisito de https interno
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-16 — HTTP somente debug`

**Dado** a implementação futura da SPEC-012 e o requisito de http somente debug
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-17 — Cleartext release`

**Dado** a implementação futura da SPEC-012 e o requisito de cleartext release
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-18 — Origem Android`

**Dado** a implementação futura da SPEC-012 e o requisito de origem android
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-19 — Allowlist CORS`

**Dado** a implementação futura da SPEC-012 e o requisito de allowlist cors
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-20 — Sem wildcard CORS`

**Dado** a implementação futura da SPEC-012 e o requisito de sem wildcard cors
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-21 — Bootstrap CSRF`

**Dado** a implementação futura da SPEC-012 e o requisito de bootstrap csrf
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-22 — Double-submit`

**Dado** a implementação futura da SPEC-012 e o requisito de double-submit
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-23 — Origin CSRF`

**Dado** a implementação futura da SPEC-012 e o requisito de origin csrf
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-24 — Refresh HttpOnly`

**Dado** a implementação futura da SPEC-012 e o requisito de refresh httponly
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-25 — Cookie Secure`

**Dado** a implementação futura da SPEC-012 e o requisito de cookie secure
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-26 — Cookie SameSite`

**Dado** a implementação futura da SPEC-012 e o requisito de cookie samesite
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-27 — Access token em memória`

**Dado** a implementação futura da SPEC-012 e o requisito de access token em memória
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-28 — Sem token em storage`

**Dado** a implementação futura da SPEC-012 e o requisito de sem token em storage
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-29 — Login`

**Dado** a implementação futura da SPEC-012 e o requisito de login
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-30 — Restauração fria`

**Dado** a implementação futura da SPEC-012 e o requisito de restauração fria
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-31 — Refresh expirado`

**Dado** a implementação futura da SPEC-012 e o requisito de refresh expirado
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-32 — Logout`

**Dado** a implementação futura da SPEC-012 e o requisito de logout
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-33 — Rotação e reutilização`

**Dado** a implementação futura da SPEC-012 e o requisito de rotação e reutilização
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-34 — Resume`

**Dado** a implementação futura da SPEC-012 e o requisito de resume
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-35 — Sem refresh de fundo`

**Dado** a implementação futura da SPEC-012 e o requisito de sem refresh de fundo
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-36 — Rota dashboard`

**Dado** a implementação futura da SPEC-012 e o requisito de rota dashboard
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-37 — Rotas de domínio`

**Dado** a implementação futura da SPEC-012 e o requisito de rotas de domínio
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-38 — Reload SPA`

**Dado** a implementação futura da SPEC-012 e o requisito de reload spa
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-39 — Links internos`

**Dado** a implementação futura da SPEC-012 e o requisito de links internos
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-40 — Links externos`

**Dado** a implementação futura da SPEC-012 e o requisito de links externos
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-41 — Sem deep links`

**Dado** a implementação futura da SPEC-012 e o requisito de sem deep links
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-42 — Voltar com histórico`

**Dado** a implementação futura da SPEC-012 e o requisito de voltar com histórico
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-43 — Voltar na raiz`

**Dado** a implementação futura da SPEC-012 e o requisito de voltar na raiz
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-44 — Browser preservado`

**Dado** a implementação futura da SPEC-012 e o requisito de browser preservado
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-45 — Offline explícito`

**Dado** a implementação futura da SPEC-012 e o requisito de offline explícito
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-46 — Falha da API`

**Dado** a implementação futura da SPEC-012 e o requisito de falha da api
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-47 — Sem fila offline`

**Dado** a implementação futura da SPEC-012 e o requisito de sem fila offline
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-48 — Teclado`

**Dado** a implementação futura da SPEC-012 e o requisito de teclado
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-49 — Safe area`

**Dado** a implementação futura da SPEC-012 e o requisito de safe area
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-50 — Orientação`

**Dado** a implementação futura da SPEC-012 e o requisito de orientação
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-51 — Splash e ícone`

**Dado** a implementação futura da SPEC-012 e o requisito de splash e ícone
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-52 — Status bar`

**Dado** a implementação futura da SPEC-012 e o requisito de status bar
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-53 — Permissão INTERNET`

**Dado** a implementação futura da SPEC-012 e o requisito de permissão internet
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-54 — Sem permissão sensível`

**Dado** a implementação futura da SPEC-012 e o requisito de sem permissão sensível
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-55 — Backup protegido`

**Dado** a implementação futura da SPEC-012 e o requisito de backup protegido
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-56 — Screenshots permitidos`

**Dado** a implementação futura da SPEC-012 e o requisito de screenshots permitidos
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-57 — Auditoria de storage`

**Dado** a implementação futura da SPEC-012 e o requisito de auditoria de storage
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-58 — Assinatura debug`

**Dado** a implementação futura da SPEC-012 e o requisito de assinatura debug
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-59 — Assinatura interna`

**Dado** a implementação futura da SPEC-012 e o requisito de assinatura interna
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-60 — Segredos de assinatura`

**Dado** a implementação futura da SPEC-012 e o requisito de segredos de assinatura
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-61 — APK interno`

**Dado** a implementação futura da SPEC-012 e o requisito de apk interno
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-62 — APK fora do Git`

**Dado** a implementação futura da SPEC-012 e o requisito de apk fora do git
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-63 — Sideload`

**Dado** a implementação futura da SPEC-012 e o requisito de sideload
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-64 — Sem loja`

**Dado** a implementação futura da SPEC-012 e o requisito de sem loja
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-65 — Atualização manual`

**Dado** a implementação futura da SPEC-012 e o requisito de atualização manual
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-66 — Version code no upgrade`

**Dado** a implementação futura da SPEC-012 e o requisito de version code no upgrade
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-67 — Zero custo`

**Dado** a implementação futura da SPEC-012 e o requisito de zero custo
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-68 — Windows nativo`

**Dado** a implementação futura da SPEC-012 e o requisito de windows nativo
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-69 — Build reproduzível`

**Dado** a implementação futura da SPEC-012 e o requisito de build reproduzível
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-70 — Regressão web`

**Dado** a implementação futura da SPEC-012 e o requisito de regressão web
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-71 — Testes compartilhados`

**Dado** a implementação futura da SPEC-012 e o requisito de testes compartilhados
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-72 — Instalação física`

**Dado** a implementação futura da SPEC-012 e o requisito de instalação física
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-73 — Smoke de domínios`

**Dado** a implementação futura da SPEC-012 e o requisito de smoke de domínios
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-74 — Dados sintéticos`

**Dado** a implementação futura da SPEC-012 e o requisito de dados sintéticos
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-75 — Logs sanitizados`

**Dado** a implementação futura da SPEC-012 e o requisito de logs sanitizados
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-76 — Sem analytics`

**Dado** a implementação futura da SPEC-012 e o requisito de sem analytics
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-77 — Sem migration`

**Dado** a implementação futura da SPEC-012 e o requisito de sem migration
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

### `CA-78 — Rollback sem dados`

**Dado** a implementação futura da SPEC-012 e o requisito de rollback sem dados
**Quando** a verificação correspondente for executada
**Então** deverá ser comprovado que o requisito nomeado neste cenário atende às regras específicas desta SPEC, com evidência sanitizada e sem ampliar o escopo.

## 23. Testes obrigatórios

| Nível | Cenários mínimos | Evidência esperada |
|---|---|---|
| Unitário/shared | URL de API, runtime, versão e back handler quando houver helper. | Suites pnpm aprovadas. |
| Integração/contrato | allowlist, Origin, CORS credentials, bootstrap/double-submit, cookies e regressão browser. | Testes API sem wildcard. |
| Web | Toda suite atual, build e Playwright. | Comandos raiz aprovados. |
| Android manual | debug/internal, cold start, login/restore/refresh/logout/restart/rede. | Checklist sanitizado. |
| Smoke de domínio | dashboard, accounts, transactions, transfers, recurrences, cards, debts e budgets. | Resultado por rota. |
| Formulários | teclado, select, data, decimal e scroll. | Aparelho real. |
| Rede/segurança | HTTPS, timeout/offline, cleartext debug restrito, cookies, CSRF, CORS, Manifest, backup e keystore. | Checklist e auditorias. |
| Upgrade | mesmo ID/chave e versionCode maior. | Instalação sobre versão anterior. |

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

- [ ] Versões oficiais atuais de Capacitor/Android/JDK/Gradle/SDK registradas.
- [ ] Prova de cookies/CSRF/origin aprovada em aparelho físico.
- [ ] Lint, format check, typecheck, unitários, integração, web E2E e build aprovados.
- [ ] Debug e internal APK instalados; upgrade aprovado.
- [ ] Smoke completo, teclado, safe area, back, lifecycle, rede e segurança aprovados.
- [ ] Manifest, backup, cleartext, storage, logs e assinatura auditados.
- [ ] Evidência usa dados sintéticos e registra aparelho/Android/APK.

## 32. Histórico de alterações da SPEC

| Data | Alteração | Motivo | Autor | Aprovador |
|---|---|---|---|---|
| 2026-08-10 | Criação aprovada da SPEC-012. | Fechar entrega Android interna do MVP com segurança e custo zero. | Codex Cloud | Tarefa atual |
