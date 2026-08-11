# Android interno no Windows

## Escopo

Este runbook gera APK debug e internal do PlannerFin com Capacitor, sem WSL, Docker, loja pública, CI ou serviço pago obrigatório.

## Versões fixadas

| Item | Versão |
|---|---|
| Node | 22+ |
| pnpm | 10.28.1 |
| Capacitor core/cli/android | 8.5.0 |
| Capacitor App | 8.1.1 |
| JDK | JDK do Android Studio 2025.2.1+ ou JDK 21 compatível com AGP |
| Android Gradle Plugin | 8.13.0 |
| Gradle wrapper | 8.14.3 |
| minSdk | 24 |
| compileSdk/targetSdk | 36 |

Fontes consultadas: documentação oficial Capacitor v8, documentação oficial Android Gradle Plugin e documentação oficial Android sobre JDK em builds.

## Preparação

1. Instale Node 22+ e habilite pnpm:

```powershell
corepack enable
corepack prepare pnpm@10.28.1 --activate
pnpm --version
```

2. Instale Android Studio 2025.2.1+ no Windows.
3. Pelo SDK Manager, instale Android SDK Platform API 36, Build Tools e Platform Tools.
4. Confirme JDK:

```powershell
java -version
```

## API e CORS

Configure a API com allowlist explícita:

```powershell
$env:API_CORS_ORIGINS="http://localhost:9000,https://localhost"
```

Para Android internal, `VITE_API_BASE_URL` deve ser absoluta, HTTPS e terminar em `/api`:

```powershell
$env:VITE_API_BASE_URL="https://api.exemplo.test/api"
```

Debug aceita HTTP somente para hosts explicitamente autorizados no projeto Android: `localhost`, `127.0.0.1` e `10.0.2.2`.

## Build debug

```powershell
pnpm install --frozen-lockfile
pnpm android:validate
pnpm android:sync
pnpm android:build:debug
```

O debug usa a assinatura padrão local do Android.

## Keystore internal

Crie e guarde a keystore fora do repositório:

```powershell
keytool -genkeypair -v `
  -keystore C:\seguro\planner-fin.jks `
  -alias planner-fin `
  -keyalg RSA `
  -keysize 4096 `
  -validity 10000
```

Configure apenas no shell local:

```powershell
$env:PLANNER_FIN_KEYSTORE_FILE="C:\seguro\planner-fin.jks"
$env:PLANNER_FIN_KEYSTORE_PASSWORD="<senha-local>"
$env:PLANNER_FIN_KEY_ALIAS="planner-fin"
$env:PLANNER_FIN_KEY_PASSWORD="<senha-local>"
$env:VITE_API_BASE_URL="https://api.exemplo.test/api"
```

## Build internal

```powershell
pnpm android:build:internal
```

Artefato esperado:

```text
artifacts/android/planner-fin-0.1.0-internal.apk
```

`artifacts/`, APK/AAB, keystores e propriedades locais são ignorados pelo Git.

## Sideload e upgrade

1. Ative USB debugging no aparelho.
2. Instale via Android Studio ou:

```powershell
adb install -r artifacts/android/planner-fin-0.1.0-internal.apk
```

Upgrade exige mesmo `applicationId`, mesma chave e `versionCode` maior que o APK instalado.

## Logcat

Use dados sintéticos:

```powershell
adb logcat | Select-String -Pattern "PlannerFin|Capacitor|chromium"
```

Não registre senha, cookie, token, payload financeiro ou dado real nas evidências.

## Troubleshooting

| Sintoma | Verificação |
|---|---|
| CORS bloqueado | Confirme `API_CORS_ORIGINS` com `https://localhost`. |
| Refresh falha | Confirme cookie refresh `HttpOnly; Secure; SameSite=None` no fluxo Android HTTPS. |
| CSRF falha | Execute bootstrap `/api/auth/csrf` e valide header `X-CSRF-Token`. |
| HTTP falha no internal | Esperado: internal/release exige HTTPS. |
| Build internal falha por assinatura | Configure as quatro variáveis `PLANNER_FIN_KEY*`. |
| App abre sem dados | API inacessível; o app não tem offline financeiro. |

## Rollback

Reverta o commit da SPEC-012 com `git revert <commit>`. Não há migration nem transformação de dados. APK instalado pode ser removido manualmente ou substituído por build anterior compatível.
