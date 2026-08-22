# Bootstrap do PlannerFin no Windows

Este runbook prepara uma máquina Windows nova para desenvolvimento Web/API, build Android, emulador e celular físico. Ele parte de uma instalação limpa, não usa produção como atalho e não pressupõe Docker, JDK, Android Studio ou SDK já configurados.

`pnpm doctor` é estritamente diagnóstico: lê versões, caminhos e arquivos locais, mas não instala software, não inicia o Docker Desktop, não cria AVD, não altera variáveis, não aceita licenças, não abre firewall e não exige execução como administrador.

## 1. Pré-requisitos

O repositório fixa ou exige:

| Item | Requisito do projeto | Fonte no repositório |
|---|---|---|
| Windows PowerShell | 5.1+; os scripts chamam `powershell` | `package.json`, `scripts/android/*.ps1` |
| Git | disponível no `PATH` | fluxo Git do projeto |
| Node.js | `>=22.0.0` | `package.json#engines` |
| pnpm | `10.28.1` | `package.json#packageManager` |
| Python | Python 3; usado por `android:apk:serve` | `scripts/android/serve-apk.ps1` |
| Docker | CLI, engine e Compose v2 | `docker-compose.yml`, scripts `db:*` |
| PostgreSQL | 16 Alpine via Docker Compose | `docker-compose.yml` |
| JDK | major 21 | `docs/runbooks/ANDROID-INTERNAL.md` |
| Android Gradle Plugin | 8.13.0 | `apps/web/android/build.gradle` |
| Gradle wrapper | 8.14.3 | `apps/web/android/gradle/wrapper/gradle-wrapper.properties` |
| Android SDK | compile/target 36; minSdk 24 | `apps/web/android/variables.gradle` |
| Build-tools | 35.0.0, completos com `aapt` e `apksigner` | automação local de release |
| AVD | `Pixel_7_Pro` | `scripts/android/dev-android.ps1` |
| System image | `system-images;android-36;google_apis;x86_64` | padrão deste bootstrap para Windows x64 |

Android Studio é o caminho mais simples, mas não é requisito conceitual: JDK 21 e Android SDK command-line tools completos são suficientes.

## 2. Quick start

1. Abra um PowerShell comum, sem elevação, e confirme se `winget` existe:

   ```powershell
   winget --version
   ```

2. Instale somente o que `pnpm doctor` indicar nas seções seguintes. Os IDs abaixo foram confirmados com `winget search -e --id <ID>` em 2026-08-21.
3. Feche e abra o terminal depois de instalações que alterem o `PATH`.
4. No repositório:

   ```powershell
   Copy-Item .env.example .env
   pnpm install --frozen-lockfile
   pnpm doctor
   pnpm db:up
   pnpm db:migrate
   pnpm dev:android
   ```

Não execute as etapas Android se o objetivo imediato for somente Web/API. O doctor apresenta readiness separado para cada trilha.

## 3. Git

Se `git --version` falhar:

```powershell
winget install -e --id Git.Git
```

Alternativa manual: [Git for Windows](https://git-scm.com/install/windows).

Valide:

```powershell
git --version
```

## 4. Node 22+ e pnpm 10.28.1

Se `node --version` faltar ou for menor que 22:

```powershell
winget install -e --id OpenJS.NodeJS.LTS
```

O canal LTS pode instalar uma major posterior; isso é compatível enquanto `node --version` for `>=22`. Alternativa manual: [downloads oficiais do Node.js](https://nodejs.org/en/download).

Ative a versão de pnpm fixada pelo projeto:

```powershell
corepack --version
corepack enable
corepack install --global pnpm@10.28.1
pnpm --version
```

Se a versão de Corepack não oferecer `install --global`, use a forma compatível:

```powershell
corepack prepare pnpm@10.28.1 --activate
```

Consulte também a [instalação oficial do pnpm](https://pnpm.io/installation). Não use uma versão global diferente da declarada em `packageManager`.

Python é necessário somente para servir o APK pela LAN. Se nenhum entre `python`, `py` ou `python3` funcionar:

```powershell
winget install -e --id Python.Python.3.14
```

Alternativa manual: [Python no Windows](https://www.python.org/downloads/windows/).

## 5. Docker Desktop

Instalação recomendada:

```powershell
winget install -e --id Docker.DockerDesktop
```

Alternativa manual e requisitos atuais: [Docker Desktop no Windows](https://docs.docker.com/desktop/setup/install/windows-install/).

Depois da instalação:

1. Abra o Docker Desktop manualmente.
2. Leia e aceite os termos apresentados pelo instalador/aplicativo somente se concordar.
3. Aguarde o engine ficar pronto.
4. Valide separadamente:

   ```powershell
   docker --version
   docker compose version
   docker info
   ```

O backend WSL 2 é o padrão mais comum. Antes de habilitar qualquer recurso do Windows, verifique:

```powershell
wsl --version
wsl --status
systeminfo | Select-String 'Virtualization|Hyper-V'
```

Se WSL 2, virtualização de firmware ou Hyper-V/WHPX estiverem indisponíveis, interrompa e peça autorização ao proprietário/administrador da máquina. Habilitar recursos pode exigir elevação e reboot; este projeto e `pnpm doctor` não fazem isso automaticamente.

O banco local usa `postgres:16-alpine` e o Compose vincula a porta somente a `127.0.0.1:5432`. Não crie regra de firewall para `5432` e não encaminhe essa porta no roteador. A aplicação deve usar `localhost:5432`; produção nunca deve ser usada para contornar a ausência do Docker local.

## 6. JDK 21

Instale o Eclipse Temurin 21:

```powershell
winget install -e --id EclipseAdoptium.Temurin.21.JDK
```

Alternativa manual: [instalação do Eclipse Temurin](https://adoptium.net/installation/). O JBR 21 incluído em uma versão compatível do Android Studio também pode ser usado, desde que `JAVA_HOME`, `java` e `javac` apontem para ele.

Após abrir um novo terminal:

```powershell
java -version
javac -version
```

Ambos devem informar major 21.

## 7. Android SDK

Componentes exatos usados por este bootstrap:

```text
cmdline-tools;latest
platform-tools
emulator
platforms;android-36
build-tools;35.0.0
system-images;android-36;google_apis;x86_64
```

O projeto compila e mira API 36. A automação de release procura build-tools completos e usa 35.0.0 porque inclui `aapt` e `apksigner`; uma instalação incompleta não é suficiente.

### Caminho A — Android Studio, recomendado pela facilidade

```powershell
winget install -e --id Google.AndroidStudio
```

Alternativa manual: [instalar Android Studio](https://developer.android.com/studio/install).

No primeiro início, abra **More Actions > SDK Manager** e instale:

- Android SDK Platform 36;
- Android SDK Build-Tools 35.0.0;
- Android SDK Platform-Tools;
- Android Emulator;
- Android SDK Command-line Tools (latest);
- Google APIs Intel x86_64 System Image da API 36.

Revise e aceite pessoalmente as licenças solicitadas pelo SDK Manager.

### Caminho B — somente command-line tools

1. Baixe o pacote Windows em [Android command-line tools](https://developer.android.com/studio#command-tools). Não fixe no script uma URL efêmera de ZIP.
2. Extraia o conteúdo para esta estrutura exata:

   ```text
   %LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat
   ```

3. Configure as variáveis da sessão atual antes da instalação:

   ```powershell
   $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
   $env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
   $env:Path = "$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
   ```

4. Instale os pacotes:

   ```powershell
   & "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" --install `
     "cmdline-tools;latest" `
     "platform-tools" `
     "emulator" `
     "platforms;android-36" `
     "build-tools;35.0.0" `
     "system-images;android-36;google_apis;x86_64"
   ```

5. Revise as licenças e, se concordar, aceite-as interativamente:

   ```powershell
   & "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" --licenses
   ```

O projeto não aceita licenças automaticamente.

## 8. Android Studio é opcional

O fluxo CLI consegue executar build, `adb`, emulator e `avdmanager` sem abrir a IDE. Android Studio continua recomendado para instalar componentes, inspecionar Gradle e criar o primeiro AVD visualmente. Não misture dois SDKs: confira o caminho em **SDK Manager > Android SDK Location** e use o mesmo em `ANDROID_HOME` e, se existir, `apps/web/android/local.properties`.

## 9. Variáveis de ambiente

Primeiro descubra os caminhos reais:

```powershell
Get-ChildItem 'C:\Program Files\Eclipse Adoptium' -Directory -Filter 'jdk-21*'
Test-Path "$env:LOCALAPPDATA\Android\Sdk"
```

Substitua `<PASTA-JDK-21>` pelo diretório encontrado e persista para o usuário atual:

```powershell
$jdk = 'C:\Program Files\Eclipse Adoptium\<PASTA-JDK-21>'
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
[Environment]::SetEnvironmentVariable('JAVA_HOME', $jdk, 'User')
[Environment]::SetEnvironmentVariable('ANDROID_HOME', $sdk, 'User')
[Environment]::SetEnvironmentVariable('ANDROID_SDK_ROOT', $sdk, 'User')

$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$requiredPath = @(
  "$jdk\bin",
  "$sdk\platform-tools",
  "$sdk\emulator",
  "$sdk\cmdline-tools\latest\bin"
)
$newPath = (($userPath -split ';') + $requiredPath | Where-Object { $_ } | Select-Object -Unique) -join ';'
[Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
```

Feche e abra o PowerShell. `ANDROID_HOME` é a variável preferida pelas ferramentas atuais; `ANDROID_SDK_ROOT` é mantida somente por compatibilidade e deve apontar para o mesmo diretório.

Valide:

```powershell
java -version
javac -version
adb version
emulator -version
sdkmanager --list_installed
```

## 10. Criar o AVD `Pixel_7_Pro`

### Pelo Android Studio

1. Abra **Device Manager > Create Virtual Device**.
2. Escolha o perfil **Pixel 7 Pro**.
3. Escolha API 36, Google APIs, ABI x86_64.
4. Defina exatamente o nome `Pixel_7_Pro`.
5. Conclua sem iniciar automaticamente se quiser apenas validar com o doctor.

### Pelo `avdmanager`

Confirme que o perfil existe:

```powershell
avdmanager list device | Select-String 'pixel_7_pro|Pixel 7 Pro'
```

Crie o AVD interativamente:

```powershell
avdmanager create avd `
  --name Pixel_7_Pro `
  --package "system-images;android-36;google_apis;x86_64" `
  --device "pixel_7_pro"
```

Valide sem iniciar:

```powershell
emulator -list-avds
emulator -accel-check
```

Se a virtualização não puder ser detectada, considere o estado `UNKNOWN` até `emulator -accel-check` ou o primeiro boot. No Windows x64, a recomendação oficial atual é Windows Hypervisor Platform; habilitá-la pode exigir administrador e reboot e deve ser uma decisão explícita do proprietário da máquina.

## 11. Clone e dependências Node

```powershell
New-Item -ItemType Directory -Force C:\Repos
Set-Location C:\Repos
git clone git@github.com:GGarnize/planner-fin.git
Set-Location C:\Repos\planner-fin
git switch main
git pull --ff-only
pnpm install --frozen-lockfile
```

`node_modules` ausente é um estado do projeto, não uma dependência externa ausente. O lockfile deve continuar versionado e não deve ser regenerado sem necessidade.

## 12. Configuração local

Crie o arquivo ignorado pelo Git:

```powershell
Copy-Item .env.example .env
```

O `.env.example` contém somente valores sintéticos para desenvolvimento local:

- `DATABASE_URL` aponta para PostgreSQL local;
- `API_PORT=3000` e Web em `9000`;
- CORS permite origens locais explícitas;
- os segredos de JWT/HMAC são exemplos exclusivamente locais e nunca devem ser reutilizados;
- `COOKIE_SECURE=false` vale somente para desenvolvimento Web local.

Não versione `.env`, keystore, senha, token, certificado privado, `rootCA-key.pem`, APK ou AAB. Não preencha variáveis de release/bucket para o primeiro start local.

## 13. Banco e migrations

Com Docker Desktop já aberto e `docker info` respondendo:

```powershell
pnpm db:up
pnpm db:migrate
```

O primeiro comando sobe apenas o serviço `postgres` do Compose, com bind de `5432` restrito ao loopback; o segundo aplica migrations versionadas. Para parar:

```powershell
pnpm db:down
```

Não edite migrations já aplicadas, não exponha a porta 5432 e não aponte `DATABASE_URL` para PRD.

## 14. `pnpm doctor`

```powershell
pnpm doctor
```

O relatório diferencia:

- `MISSING`: ferramenta, componente ou arquivo não encontrado;
- `WRONG VERSION`: encontrado, mas incompatível com o projeto;
- `INSTALLED_BUT_STOPPED`: Docker CLI existe, mas o engine não responde;
- `WARN`/`UNKNOWN`: estado parcial ou detecção inconclusiva;
- `OK`: requisito específico atendido.

Readiness de Web, API/banco, Android build, emulador e assinatura são independentes. Ausência de Android não impede Web quando Core e dependências Node estiverem prontos. Corrija os próximos passos e rode o doctor novamente.

## 15. Primeiro start

### Web e API

```powershell
pnpm db:up
pnpm db:migrate
pnpm dev
```

Web: `http://localhost:9000`. API: `http://localhost:3000/api`.

### Serviços Android sem emulador

Depois de preparar o certificado HTTPS local da seção 17:

```powershell
pnpm dev:android:services
```

### Ambiente Android completo

```powershell
pnpm dev:android
```

Esse comando sobe banco, migrations, API, proxy HTTPS e inicia/reutiliza o AVD `Pixel_7_Pro`. Ele **não** compila, instala ou atualiza o APK.

## 16. Primeiro APK

Gere o APK debug configurado para o emulador:

```powershell
pnpm android:apk
adb install -r apps\web\android\app\build\outputs\apk\debug\app-debug.apk
```

O build usa o Gradle wrapper versionado; não instale Gradle global. Para validar somente a configuração Android versionada:

```powershell
pnpm android:validate
```

Assinatura de release é opcional no bootstrap. Quando necessária, use o fluxo separado `pnpm android:release:setup` e nunca registre os valores secretos em shell history, docs ou Git.

## 17. Celular físico, TLS e LAN

O WebView usa HTTPS para preservar cookies e política de segurança. O proxy local exige certificado e chave em `.tools/certs`, diretório ignorado pelo Git. Uma opção é `mkcert`:

```powershell
winget install -e --id FiloSottile.mkcert
mkcert -install
New-Item -ItemType Directory -Force .tools\certs
mkcert `
  -cert-file .tools\certs\planner-fin-local.pem `
  -key-file .tools\certs\planner-fin-local-key.pem `
  localhost 127.0.0.1 ::1 10.0.2.2 <SEU-IP-LAN>
```

`mkcert -install` altera o trust store local: execute apenas após revisar e concordar. Importe manualmente o `rootCA.pem` público no emulador/celular de teste quando necessário; nunca copie ou versione `rootCA-key.pem`. O certificado deve incluir o IP LAN atual no SAN.

Com celular e notebook na mesma rede privada:

```powershell
pnpm dev:phone
pnpm android:apk:lan
```

Instale o APK gerado por cabo/ADB ou sirva o diretório:

```powershell
pnpm android:apk:serve
```

Se o Windows perguntar sobre firewall, não crie regra automaticamente. Avalie e, se autorizado, permita somente rede privada e somente a porta necessária do proxy/servidor temporário. Nunca abra `3000` ou `5432`, nunca desative TLS e nunca use `NODE_TLS_REJECT_UNAUTHORIZED=0`.

## 18. Troubleshooting

| Sintoma | Diagnóstico e próximo passo |
|---|---|
| `pnpm` não reconhecido | Abra novo terminal; rode `corepack enable` e ative `pnpm@10.28.1`. |
| Node 20 | Instale Node LTS compatível (`>=22`) e confira precedência no `PATH`. |
| Docker `INSTALLED_BUT_STOPPED` | Abra Docker Desktop manualmente e aguarde `docker info`. |
| Docker pede WSL/virtualização | Não habilite automaticamente; valide BIOS/UEFI, WSL 2 e possível reboot com o proprietário/administrador. |
| `JAVA_HOME` inválido | Aponte para a raiz do JDK 21 que contém `bin\java.exe` e `bin\javac.exe`. |
| SDK não encontrado | Alinhe `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `%LOCALAPPDATA%\Android\Sdk` e `local.properties`. |
| Platform 36 ausente | Instale `platforms;android-36`. |
| Build-tools ausentes/incompletos | Instale `build-tools;35.0.0` e confirme `aapt.exe`/`apksigner.bat`. |
| AVD ausente | Crie `Pixel_7_Pro` com API 36, Google APIs e x86_64. |
| Emulador lento/não inicia | Rode `emulator -accel-check`; valide virtualização e Windows Hypervisor Platform. |
| Proxy HTTPS falha | Gere os dois arquivos esperados em `.tools/certs` e confie a CA apenas nos dispositivos de teste. |
| APK LAN bloqueado | Reemita o certificado incluindo o IP LAN atual no SAN. |
| `node_modules` ausente | Rode `pnpm install --frozen-lockfile`; não confunda com ausência de ferramenta externa. |
| `.env` ausente | Copie `.env.example`; não use valores ou banco de PRD. |
| Porta ocupada | Identifique o processo; não encerre processo desconhecido nem abra firewall automaticamente. |

Depois de qualquer correção, rode novamente:

```powershell
pnpm doctor
```
