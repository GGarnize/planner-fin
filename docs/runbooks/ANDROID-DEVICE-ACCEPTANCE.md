# Aceite em aparelho Android físico

## Gate de merge

O PR da SPEC-012 não deve ser mesclado enquanto este checklist físico estiver pendente. Testes automatizados, build web e debug APK não substituem a prova em aparelho real.

## Ambiente

| Campo | Valor |
|---|---|
| Commit | PENDING |
| APK | PENDING |
| Fabricante/modelo | PENDING |
| Android | PENDING |
| WebView/Chrome | PENDING |
| API | PENDING |
| Dados | Somente sintéticos |

## Checklist obrigatório

| Item | Status | Evidência |
|---|---|---|
| Instalação por sideload | PENDING | Modelo, Android e APK. |
| UI local abre | PENDING | Tela inicial. |
| `window.location.origin === 'https://localhost'` | PENDING | Console remoto. |
| Cookie CSRF seguro | PENDING | Secure/SameSite correto. |
| Cookie refresh `HttpOnly; Secure` | PENDING | DevTools remoto ou proxy sanitizado. |
| `SameSite=None` no Android HTTPS | PENDING | Cabeçalho Set-Cookie sanitizado. |
| Cookies enviados em refresh/logout | PENDING | Log/proxy sem valores. |
| Bootstrap CSRF | PENDING | `GET /api/auth/csrf` no-store. |
| Double-submit | PENDING | Header e cookie aceitos. |
| Login | PENDING | Usuário sintético. |
| Cold start com restore | PENDING | App fechado e reaberto. |
| Refresh | PENDING | Access expirado/401 recuperado. |
| Logout | PENDING | Sessão limpa. |
| Novo cold start sem restore após logout | PENDING | Login exibido. |
| Dashboard | PENDING | Smoke. |
| Accounts | PENDING | Smoke. |
| Transactions | PENDING | Smoke. |
| Transfers | PENDING | Smoke. |
| Recurrences | PENDING | Smoke. |
| Cards | PENDING | Smoke. |
| Debts | PENDING | Smoke. |
| Budgets | PENDING | Smoke. |
| Teclado | PENDING | Campo e ação visíveis. |
| Data/decimal input | PENDING | Entrada sintética. |
| Scroll | PENDING | Sem conteúdo inacessível. |
| Portrait/landscape | PENDING | Sem bloqueio. |
| Safe area | PENDING | Conteúdo fora de recortes/barras. |
| Back com histórico | PENDING | Retorna rota anterior. |
| Back na raiz | PENDING | Sai/minimiza. |
| Offline/online | PENDING | Estado explícito e recuperação. |
| HTTPS internal | PENDING | API HTTPS. |
| HTTP release bloqueado | PENDING | Falha esperada. |
| Permissões | PENDING | Apenas INTERNET. |
| Storage JS/WebView | PENDING | Sem credenciais persistidas. |
| Logcat sanitizado | PENDING | Sem tokens/cookies/senha/payload. |
| Backup | PENDING | Sem restauração indevida. |
| Signing internal | PENDING | APK assinado pela keystore local. |

## Evidência proibida

Não anexar senhas, tokens, cookies, Authorization, dados financeiros reais, e-mail real, nome completo real, IP pessoal desnecessário ou keystore.
