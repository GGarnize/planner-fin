# Matriz SPEC-012 CA-01..CA-78

## Diagnóstico pós-merge

| Achado | SPEC/CA | Estado atual | Severidade | Correção proposta | Exige físico? |
|---|---|---|---|---|---|
| IDs da matriz estavam deslocados semanticamente desde CA-02; por exemplo, CA-18 descrevia bootstrap em vez da origem Android. | CA-02..CA-78 | Evidências associadas a critérios errados e vários PASS indevidos. | Alta | Reconstruir toda a matriz com IDs e títulos literais da SPEC. | Não |
| Falha do refresh durante retry de GET/HEAD preservava usuário/token anteriores e propagava erro sem transição segura ao login. | CA-31, CA-34 | Estado autenticado podia permanecer obsoleto após 401 no refresh. | Alta | Limpar estado e devolver o 401 original sem repetir a operação; testar também o segundo 401. | Não |
| Cobertura do Back não exercitava raiz/dashboard. | CA-43 | Implementação existia, mas faltava evidência automatizada. | Média | Cobrir `/` e `/dashboard`, garantindo `exitApp` sem `router.back()`. | Não |
| Links externos não possuem código próprio do PlannerFin. | CA-39, CA-40 | O `BridgeWebViewClient` da versão fixada mantém mesma origem na WebView e delega origem externa a `ACTION_VIEW`; nenhum plugin extra é necessário. | Média | Registrar a garantia estática e manter validação física como PENDING. | Sim |
| Debug HTTP só autoriza localhost, 127.0.0.1 e 10.0.2.2. | CA-14, CA-16 | Emulador é coberto; aparelho físico com IP LAN não é coberto sem editar a allowlist. | Alta | Não abrir cleartext nem versionar IP pessoal; manter CA-14 BLOCKED até decisão/configuração local segura. | Sim |
| `FileProvider` gerado expunha caminhos externos/cache sem funcionalidade aprovada que o consumisse. | CA-10, CA-54 | Boilerplate sem plugin de filesystem/share e sem uso no código. | Média | Remover provider e `file_paths.xml`, sem adicionar permissão. | Não |
| APK, signing, instalação, upgrade, cookies WebView e demais gates físicos não foram executados. | CA-02, CA-05, CA-07..CA-08, CA-15, CA-17..CA-18, CA-24..CA-26, CA-28..CA-30, CA-32, CA-37..CA-40, CA-42..CA-43, CA-45..CA-46, CA-48..CA-52, CA-55..CA-59, CA-61, CA-63, CA-65..CA-66, CA-68..CA-69, CA-72..CA-75 | A matriz anterior convertia parte da inspeção estática em PASS. | Alta | Classificar como PENDING ou BLOCKED conforme o ambiente realmente necessário. | Sim |

## Estado auditado

Somente `PASS`, `PENDING` e `BLOCKED` são usados. `PASS` indica evidência suficiente já produzida; `PENDING` mantém aceite manual/físico futuro; `BLOCKED` indica que SDK, APK, keystore, Windows ou configuração externa indisponível impedem a execução neste ambiente Cloud.

| CA e título exatos | Status | Evidência/limitação |
|---|---|---|
| CA-01 — Arquitetura única | PASS | Árvore contém uma única SPA em `apps/web`. |
| CA-02 — Assets locais | BLOCKED | Assets estão configurados localmente, mas não houve APK nem abertura offline. |
| CA-03 — Local canônico | PASS | Configuração e projeto estão nos caminhos canônicos. |
| CA-04 — Application ID | PASS | Capacitor, namespace, Gradle e Manifest usam `com.plannerfin.app`. |
| CA-05 — Nome público | PENDING | Strings declaram `PlannerFin`; launcher exige aparelho. |
| CA-06 — Fonte de versão | PASS | Gradle lê a versão `0.1.0` do manifesto web; validação cobre SemVer. |
| CA-07 — Version code | PENDING | `versionCode` atual é 1; comparação de dois APKs atualizáveis não foi executada. |
| CA-08 — SDK compatível | BLOCKED | Versões estão fixadas, mas build Android exige JDK/SDK indisponíveis. |
| CA-09 — Dependências mínimas | PASS | Manifesto contém exatamente core, cli, android e app. |
| CA-10 — Sem plugins supérfluos | PASS | Validação e lockfile não contêm plugin Capacitor/Cordova extra. |
| CA-11 — API absoluta Android | PASS | Cliente e build internal validam URL absoluta terminada em `/api`. |
| CA-12 — API relativa web | PASS | Teste web preserva base relativa. |
| CA-13 — URL sem segredo | PASS | Configuração contém apenas URL pública; segredos locais são ignorados. |
| CA-14 — Endpoint de dispositivo | BLOCKED | Emulador possui host explícito; endpoint LAN físico exige configuração futura sem abrir cleartext. |
| CA-15 — HTTPS interno | BLOCKED | Script exige HTTPS, porém build/comunicação internal não foram executados. |
| CA-16 — HTTP somente debug | PASS | Network security de debug limita cleartext a três hosts explícitos. |
| CA-17 — Cleartext release | BLOCKED | Main não habilita cleartext global; tentativa real depende de APK. |
| CA-18 — Origem Android | PENDING | Configuração padrão implica `https://localhost`; origem efetiva requer WebView físico. |
| CA-19 — Allowlist CORS | PASS | Configuração/testes aceitam somente allowlist explícita e CORS usa credenciais. |
| CA-20 — Sem wildcard CORS | PASS | Configuração rejeita `*` e origens com wildcard. |
| CA-21 — Bootstrap CSRF | PASS | Teste cobre token/cookie, `no-store`, rate limit e ausência de sessão. |
| CA-22 — Double-submit | PASS | Guard usa cookie/header, tamanho e `timingSafeEqual`. |
| CA-23 — Origin CSRF | PASS | Guard exige Origin presente na allowlist. |
| CA-24 — Refresh HttpOnly | PENDING | Cookie é `HttpOnly` por código; leitura real deve ser auditada no WebView. |
| CA-25 — Cookie Secure | PENDING | Política Android define `Secure`; cookie real requer WebView. |
| CA-26 — Cookie SameSite | PENDING | Testes cobrem None Android e Lax web; comportamento real requer WebView. |
| CA-27 — Access token em memória | PASS | Access token permanece apenas no estado reativo em memória. |
| CA-28 — Sem token em storage | PENDING | Busca estática é negativa; auditoria de storages após uso requer aparelho. |
| CA-29 — Login | PENDING | Não há auth paralelo; login real Android permanece no gate físico. |
| CA-30 — Restauração fria | PENDING | Cliente executa bootstrap e restore; persistência de cookie requer aparelho. |
| CA-31 — Refresh expirado | PASS | Teste web confirma falha de restore e estado em memória limpo. |
| CA-32 — Logout | PENDING | Código limpa cookies/estado; fluxo real Android permanece pendente. |
| CA-33 — Rotação e reutilização | PASS | Rotação/reuse da SPEC-002 continua coberta pelos testes da API. |
| CA-34 — Resume | PASS | Testes cobrem GET/HEAD, single-flight, uma repetição e limpeza; mutações não repetem. |
| CA-35 — Sem refresh de fundo | PASS | Não existe serviço ou refresh periódico. |
| CA-36 — Rota dashboard | PASS | Router redireciona raiz autenticada para `/dashboard`. |
| CA-37 — Rotas de domínio | PENDING | Rotas são compartilhadas; smoke completo requer aparelho. |
| CA-38 — Reload SPA | PENDING | History mode/assets estão configurados; reload WebView requer aparelho. |
| CA-39 — Links internos | PENDING | Router links permanecem na SPA; validação WebView requer aparelho. |
| CA-40 — Links externos | PENDING | Bridge Capacitor abre origem HTTPS externa via navegador sem plugin; validação física pendente. |
| CA-41 — Sem deep links | PASS | Manifest contém somente intent filter de launcher. |
| CA-42 — Voltar com histórico | PENDING | Teste unitário cobre `router.back()`; botão físico permanece pendente. |
| CA-43 — Voltar na raiz | PENDING | Testes cobrem `/` e `/dashboard` com `exitApp`; botão físico permanece pendente. |
| CA-44 — Browser preservado | PASS | Teste confirma ausência do listener no browser. |
| CA-45 — Offline explícito | PENDING | Assets locais/erros existem; estado offline real requer aparelho. |
| CA-46 — Falha da API | PENDING | Sem fila/êxito falso por desenho; interrupção real da API requer aparelho. |
| CA-47 — Sem fila offline | PASS | Nenhuma persistência/fila offline foi adicionada. |
| CA-48 — Teclado | PENDING | Teclado e scroll exigem aparelho. |
| CA-49 — Safe area | PENDING | Insets/cutout exigem aparelho. |
| CA-50 — Orientação | PENDING | Manifest não bloqueia orientação; uso real exige aparelho. |
| CA-51 — Splash e ícone | PENDING | Assets versionados não foram alterados; launcher/splash exigem aparelho. |
| CA-52 — Status bar | PENDING | Contraste da status bar exige aparelho. |
| CA-53 — Permissão INTERNET | PASS | Manifest declara `INTERNET`. |
| CA-54 — Sem permissão sensível | PASS | Validação e busca não encontram permissão sensível. |
| CA-55 — Backup protegido | PENDING | `allowBackup=false` e exclusões existem; restore/backup exige aparelho/adb. |
| CA-56 — Screenshots permitidos | PENDING | `FLAG_SECURE` está ausente; screenshot exige aparelho. |
| CA-57 — Auditoria de storage | PENDING | Busca estática é negativa; auditoria WebView pós-smoke exige aparelho. |
| CA-58 — Assinatura debug | BLOCKED | Não há Android SDK para gerar e verificar assinatura debug. |
| CA-59 — Assinatura interna | BLOCKED | Keystore local e Android SDK não estão disponíveis. |
| CA-60 — Segredos de assinatura | PASS | Gitignore cobre keystore/propriedades; diff não contém segredo. |
| CA-61 — APK interno | BLOCKED | Keystore/SDK ausentes impedem produzir APK internal. |
| CA-62 — APK fora do Git | PASS | Gitignore cobre APK/AAB e nenhum artefato foi criado. |
| CA-63 — Sideload | PENDING | Sideload será executado pelo usuário no aparelho. |
| CA-64 — Sem loja | PASS | Runbook usa ferramentas locais e não inclui serviço/loja. |
| CA-65 — Atualização manual | PENDING | Upgrade requer dois APKs assinados e aparelho. |
| CA-66 — Version code no upgrade | PENDING | Monotonicidade está documentada; detecção em upgrade real permanece pendente. |
| CA-67 — Zero custo | PASS | Dependências e distribuição possuem caminho gratuito. |
| CA-68 — Windows nativo | BLOCKED | Runbook Windows existe; ambiente Windows/Android não está disponível no Cloud. |
| CA-69 — Build reproduzível | BLOCKED | Scripts são versionados; reconstrução de APK está bloqueada sem SDK. |
| CA-70 — Regressão web | PASS | Lint, typecheck, testes e build web passam nesta auditoria. |
| CA-71 — Testes compartilhados | PASS | Suítes Cloud aplicáveis passam; Playwright ficou limitado pela ausência de `libatk-1.0.so.0`, sem falha funcional observada. |
| CA-72 — Instalação física | PENDING | Gate de instalação física permanece aberto. |
| CA-73 — Smoke de domínios | PENDING | Smoke dos domínios permanece no checklist físico. |
| CA-74 — Dados sintéticos | PENDING | Checklist exige dados sintéticos; evidência física ainda não existe. |
| CA-75 — Logs sanitizados | PENDING | Auditoria de Logcat exige aparelho. |
| CA-76 — Sem analytics | PASS | Dependências não incluem analytics/crash reporting. |
| CA-77 — Sem migration | PASS | Diff não toca Prisma nem migrations. |
| CA-78 — Rollback sem dados | PASS | Rollback é `git revert`, sem transformação de dados. |
