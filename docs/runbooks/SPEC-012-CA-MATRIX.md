# Matriz SPEC-012 CA-01..CA-78

| CA | Status | Evidência | Ambiente |
|---|---|---|---|
| CA-01 | PASS | `apps/web/capacitor.config.ts` e `apps/web/android/**` gerados; sem segundo frontend. | Estático |
| CA-02 | PASS | `appId`/Manifest/Gradle usam `com.plannerfin.app`. | Estático |
| CA-03 | PASS | `appName`/strings usam `PlannerFin`. | Estático |
| CA-04 | PASS | `webDir: 'dist'`; `server.url` ausente. | `pnpm android:validate` |
| CA-05 | PASS | Dependências limitadas a quatro pacotes Capacitor aprovados. | `pnpm android:validate` |
| CA-06 | PASS | `apps/web/package.json` versão `0.1.0`; Gradle deriva `versionName`. | Estático |
| CA-07 | PASS | `plannerFinVersionCode = 1` validado como inteiro positivo. | `pnpm android:validate` |
| CA-08 | PASS | `VITE_API_BASE_URL` preservado e validado no cliente. | Testes web |
| CA-09 | PASS | Browser aceita `/api` relativo quando env ausente. | Testes web |
| CA-10 | PASS | Android exige URL absoluta `/api`. | Testes web |
| CA-11 | PASS | Internal exige HTTPS no script de build. | Script |
| CA-12 | PASS | Debug cleartext restrito a hosts explícitos. | Manifest debug |
| CA-13 | PASS | Main/release sem `usesCleartextTraffic=true`. | `pnpm android:validate` |
| CA-14 | PASS | CORS multi-origin com trim/dedup. | Testes API |
| CA-15 | PASS | Wildcard/origem inválida rejeitados. | Testes API |
| CA-16 | PASS | Compatibilidade `API_CORS_ORIGIN` preservada. | Testes API |
| CA-17 | PASS | `https://localhost` documentado e configurável na allowlist. | `.env.example` |
| CA-18 | PASS | `GET /api/auth/csrf` público com no-store. | Testes API |
| CA-19 | PASS | Bootstrap emite cookie CSRF e body `{ csrfToken }`. | Testes API |
| CA-20 | PASS | Bootstrap não chama AuthService nem cria sessão. | Testes API |
| CA-21 | PASS | CSRF guard exige Origin allowlist e double-submit. | Código/testes API |
| CA-22 | PASS | Refresh cookie `HttpOnly`, path `/api/auth`. | Testes API |
| CA-23 | PASS | Android `https://localhost` usa `SameSite=None; Secure`. | Testes API |
| CA-24 | PASS | Browser preserva `SameSite=Lax`. | Testes API |
| CA-25 | PASS | Logout limpa cookies com política contextual. | Código API |
| CA-26 | PASS | Access e CSRF ficam somente em memória no cliente. | Código/testes web |
| CA-27 | PASS | Cold start executa bootstrap e refresh. | Testes web |
| CA-28 | PASS | Refresh usa `credentials: include` e `X-CSRF-Token`. | Testes web |
| CA-29 | PASS | Logout usa CSRF, cookie e limpa memória. | Código web |
| CA-30 | PENDING | Restore em aparelho após cold start requer prova de WebView/cookies. | Aparelho físico |
| CA-31 | PASS | Refresh expirado limpa estado e retorna login. | Fluxo existente + testes |
| CA-32 | PENDING | Logout físico precisa confirmar cookies WebView. | Aparelho físico |
| CA-33 | PASS | Rotação/reuse da SPEC-002 preservada. | Testes API existentes |
| CA-34 | PASS | Primeiro 401 em GET dispara restore/refresh uma vez. | Testes web |
| CA-35 | PASS | Sem background service ou refresh periódico. | Código Android/web |
| CA-36 | PASS | Rota raiz redireciona `/dashboard`. | Router |
| CA-37 | PENDING | Smoke de domínios precisa aparelho físico. | Aparelho físico |
| CA-38 | PENDING | Reload SPA em WebView precisa aparelho físico. | Aparelho físico |
| CA-39 | PENDING | Links internos precisam validação física. | Aparelho físico |
| CA-40 | PENDING | Links externos precisam validação física. | Aparelho físico |
| CA-41 | PASS | Sem intent filters de deep/app links além launcher. | Manifest |
| CA-42 | PASS | Back handler usa histórico SPA útil. | Testes web |
| CA-43 | PASS | Back na raiz chama `exitApp`. | Código/testes web |
| CA-44 | PASS | Browser não instala listener Android. | Testes web |
| CA-45 | PENDING | Offline visual precisa aparelho físico. | Aparelho físico |
| CA-46 | PENDING | Falha de API em uso real precisa aparelho físico. | Aparelho físico |
| CA-47 | PASS | Nenhuma fila offline/storage nativo implementado. | Código |
| CA-48 | PENDING | Teclado precisa aparelho físico. | Aparelho físico |
| CA-49 | PENDING | Safe area precisa aparelho físico. | Aparelho físico |
| CA-50 | PENDING | Portrait/landscape precisa aparelho físico. | Aparelho físico |
| CA-51 | PASS | Assets gerados pelo Capacitor versionados como placeholder. | Android |
| CA-52 | PENDING | Contraste status bar precisa aparelho físico. | Aparelho físico |
| CA-53 | PASS | Manifest contém INTERNET. | `pnpm android:validate` |
| CA-54 | PASS | Sem permissões sensíveis aprovadas. | `pnpm android:validate` |
| CA-55 | PENDING | Backup precisa teste físico/adb. | Aparelho físico |
| CA-56 | PASS | `FLAG_SECURE` não foi adicionado. | Código |
| CA-57 | PENDING | Auditoria WebView storage precisa aparelho físico. | Aparelho físico |
| CA-58 | BLOCKED | `assembleDebug` depende de Android SDK local. | Ambiente local |
| CA-59 | BLOCKED | Internal depende de keystore local não versionada. | Ambiente local |
| CA-60 | PASS | `.gitignore` bloqueia keystore/segredos; nenhum secret adicionado. | Estático |
| CA-61 | BLOCKED | APK internal depende de keystore e SDK. | Ambiente local |
| CA-62 | PASS | APK/AAB ignorados pelo Git. | `.gitignore` |
| CA-63 | PENDING | Sideload exige aparelho físico. | Aparelho físico |
| CA-64 | PASS | Sem Play Store/Firebase/App Center/serviço pago. | Diff |
| CA-65 | PENDING | Upgrade manual exige aparelho físico e APK anterior. | Aparelho físico |
| CA-66 | PASS | VersionCode positivo e versionado; monotonicidade futura documentada. | Script/docs |
| CA-67 | PASS | Caminho usa ferramentas gratuitas locais. | Runbook |
| CA-68 | PASS | Runbook Windows sem WSL/Docker. | Documentação |
| CA-69 | PASS | Scripts reproduzíveis `android:*`. | Package scripts |
| CA-70 | PASS | Browser preservado por testes web e URL relativa. | Testes |
| CA-71 | PENDING | Suite completa será registrada na entrega final. | Checks locais |
| CA-72 | PENDING | Instalação física é gate obrigatório. | Aparelho físico |
| CA-73 | PENDING | Smoke de domínios é gate obrigatório. | Aparelho físico |
| CA-74 | PENDING | Evidências físicas devem usar dados sintéticos. | Aparelho físico |
| CA-75 | PENDING | Logcat sanitizado exige aparelho físico. | Aparelho físico |
| CA-76 | PASS | Nenhum SDK de analytics/crash adicionado. | Diff/deps |
| CA-77 | PASS | Nenhuma migration/schema Prisma alterado. | Git diff |
| CA-78 | PASS | Rollback por revert sem dados/migrations. | Runbook |
