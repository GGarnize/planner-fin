# Desenvolvimento local Android e celular

> Primeira vez nesta máquina? Siga primeiro [Bootstrap do PlannerFin no Windows](WINDOWS-BOOTSTRAP.md).

## Comandos

| Comando | Uso |
|---|---|
| `pnpm dev:android` | Sobe Docker/PostgreSQL, migrations, API local, proxy HTTPS e AVD `Pixel_7_Pro`. |
| `pnpm dev:android:services` | Sobe os servicos locais sem iniciar Android virtual. |
| `pnpm dev:phone` | Alias operacional para celular fisico; mostra IP LAN e health HTTPS na LAN. |
| `pnpm android:apk` | Gera APK debug para emulador com `https://10.0.2.2:3443/api`. |
| `pnpm android:apk:lan` | Gera APK debug para celular na LAN com `https://<LAN_IP>:3443/api`, bloqueando se o certificado nao cobrir o IP. |
| `pnpm android:apk:remote` | Gera APK debug somente com `PLANNER_FIN_REMOTE_API_BASE_URL=https://host-ou-ip:porta/api`. |
| `pnpm android:apk:serve` | Serve o diretorio do APK debug mais recente via Python em foreground. |
| `pnpm dev:android:stop` | Para somente API/proxy/processos registrados pelos scripts PlannerFin. |
| `pnpm db:down` | Para explicitamente o banco via Docker Compose. |

## Proxy HTTPS 3443

Android WebView e celulares fisicos precisam consumir a API com TLS para preservar cookies `Secure`, CSRF, CORS com credenciais e o comportamento esperado do browser embarcado. Por isso os scripts sobem a API NestJS apenas em `127.0.0.1:3000` e expoem para Android/celular somente o proxy HTTPS em `0.0.0.0:3443`.

O proxy versionado em `scripts/android/https-proxy.mjs` encaminha `https://<host>:3443/api/*` para `http://127.0.0.1:3000/api/*`. Certificados e chaves ficam locais em `.tools/certs/` e continuam ignorados pelo Git. Para celular na LAN, o certificado precisa conter o IP LAN escolhido no SAN; se nao contiver, `pnpm android:apk:lan` bloqueia o build.

## Modo remoto explicito

`pnpm android:apk:remote` exige configuracao explicita:

```powershell
$env:PLANNER_FIN_REMOTE_API_BASE_URL="https://host-ou-ip:porta/api"
pnpm android:apk:remote
```

A URL deve ser absoluta, HTTPS, terminar exatamente em `/api`, nao conter credenciais, query string nem fragmento. O comando nao abre firewall, nao configura roteador, nao expoe `3000` nem `5432`, nao desativa TLS e nao usa `NODE_TLS_REJECT_UNAUTHORIZED=0`.

Para acesso remoto publico, exponha apenas a camada HTTPS/proxy. PostgreSQL `5432` e NestJS `3000` devem permanecer inacessiveis externamente. Uma VPN privada e preferivel a expor diretamente um ambiente de desenvolvimento.

## Seguranca local

Nunca versione `.env`, keystore, certificados privados, `rootCA-key.pem`, APK/AAB ou logs com segredo. Os scripts usam `.tools/runtime/` para PIDs e logs locais, reaproveitam processos PlannerFin ja registrados e falham se a porta estiver ocupada por processo desconhecido. `pnpm dev:android:stop` nao derruba Docker Desktop nem PostgreSQL por padrao.
