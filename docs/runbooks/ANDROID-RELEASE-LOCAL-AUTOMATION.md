# Automacao local de release Android (Windows)

## Escopo

Este runbook documenta `scripts/android-release.ps1`, uma automacao local (Windows) que
elimina o ritual manual de configurar variaveis de ambiente, fazer bump de versao,
buildar, instalar via adb e publicar uma release Android do PlannerFin. Complementa
`docs/runbooks/ANDROID-RELEASE-BUCKET.md` (que documenta o build/publish em si) — este
runbook cobre apenas a orquestracao local: descoberta de SDK/build-tools, persistencia de
config nao secreta, segredos no Windows Credential Manager e o fluxo interativo de release.

Nenhuma release real foi publicada, nenhuma keystore foi gerada/alterada e nenhuma
credencial do Railway Bucket foi criada/resetada pela implementacao desta automacao.

## Por que nao usar o Railway CLI para as credenciais do bucket

A spec original avaliou duas opcoes para evitar duplicar segredos localmente: (1) Railway
CLI autenticado buscando credenciais do bucket sob demanda, ou (2) Windows Credential
Manager. O Railway CLI nao esta instalado neste ambiente (`railway --version` falha) e
adotar essa dependencia exigiria login interativo adicional e manter um token amplo de
projeto Railway localmente — uma superficie de segredo maior do que as quatro credenciais
pontuais hoje necessarias. Por isso a automacao usa o Windows Credential Manager
diretamente, sem dependencia de CLI externo.

## Onde cada coisa mora

| Dado | Local | Versionado? |
|---|---|---|
| Logica pura (semver, versionCode, descoberta de build-tools, config nao secreta) | `scripts/android/release-helpers.mjs` (+ `.test.mjs`) | Sim |
| Wrapper do Credential Manager (P/Invoke, sem modulo externo) | `scripts/android/windows-credentials.ps1` | Sim |
| Orquestracao principal (setup/doctor/release/build/publish/commit) | `scripts/android-release.ps1` | Sim |
| Config nao secreta (URLs, caminhos, bucket/endpoint/region) | `C:\Users\<usuario>\.planner-fin\release-config.json` | Nao (fora do repo) |
| Keystore de release | `C:\Users\<usuario>\.planner-fin\signing\planner-fin-release.jks` | Nao (fora do repo, `.gitignore` ja cobre `*.jks`) |
| Senha da keystore / senha da key / credenciais do bucket | Windows Credential Manager (`PlannerFin/*`) | Nao (fora do repo, DPAPI local do usuario) |
| `sdk.dir` do Gradle | `apps/web/android/local.properties` | Nao (ja no `.gitignore`) |

Nenhum segredo e aceito por argumento de linha de comando nem impresso no console/log —
senhas usam `Read-Host -AsSecureString` (sem eco) e sao lidas do Credential Manager apenas
para exportacao como variavel de ambiente do processo filho `pnpm`/`gradlew`, nunca escritas
em arquivo ou stdout.

### Entradas no Windows Credential Manager

| Nome (`TargetName`) | Uso |
|---|---|
| `PlannerFin/KeystorePassword` | `PLANNER_FIN_KEYSTORE_PASSWORD` |
| `PlannerFin/KeyPassword` | `PLANNER_FIN_KEY_PASSWORD` |
| `PlannerFin/RailwayBucketAccessKey` | `ACCESS_KEY_ID` |
| `PlannerFin/RailwayBucketSecretKey` | `SECRET_ACCESS_KEY` |

## Comandos

```powershell
pnpm android:release:setup    # configura release-config.json + segredos (interativo)
pnpm android:release:doctor   # valida tudo sem alterar nada (SDK, build-tools, keystore, segredos, versao)
pnpm android:release          # fluxo completo: bump -> build -> instalar (opcional) -> publish (com confirmacao dupla)
```

`scripts/android-release.ps1` tambem aceita `-Command build`, `-Command publish` e
`-Command commit` para rodar so uma etapa (uteis depois de um bump manual ou para
reexecutar so o publish).

### Descoberta de build-tools

`local.properties` ja resolve `sdk.dir` para o Gradle — a automacao nao depende de
`ANDROID_HOME`. Para `apksigner`/`aapt` (usados na verificacao obrigatoria do APK release),
`Get-CompleteBuildToolsPath` varre `<sdkDir>/build-tools/*` da versao mais nova para a mais
antiga e usa a primeira que realmente contenha `apksigner.bat` e `aapt.exe` — nesta maquina
`36.0.0` esta instalado mas incompleto (sem apksigner/aapt) e `35.0.0` e escolhido
automaticamente. Essa logica esta coberta por teste em
`scripts/android/release-helpers.test.mjs`.

### Fluxo de `pnpm android:release`

1. Valida que o repo esta limpo (ou que as unicas alteracoes pendentes sao os dois
   arquivos de bump — permite retomar uma tentativa anterior que bumpou mas nao terminou).
2. Mostra versao/versionCode atuais e sugere o proximo patch semver e `versionCode + 1`.
3. Pede confirmacao antes de gravar o bump em `apps/web/package.json` e
   `apps/web/android/version.json`.
4. Roda `pnpm android:release:build` com `VITE_API_BASE_URL` e as quatro variaveis
   `PLANNER_FIN_KEY*` exportadas **somente para esse processo filho** (removidas do
   ambiente do PowerShell logo depois, sucesso ou falha).
5. Se houver device via `adb devices`, pergunta se deve instalar com `adb install -r`.
6. Pergunta se deve publicar. Se sim: roda o dry-run de
   `pnpm android:release:publish` (sem `--yes`), mostra um resumo nao secreto
   (versao, versionCode, bucket, endpoint, apiBaseUrl — nunca as credenciais), exige que o
   usuario digite exatamente `PUBLICAR` (confirmacao mais forte que sim/nao, pois a
   publicacao e imutavel) e so entao roda `pnpm android:release:publish -- --yes`.
7. Tenta confirmar `GET /api/releases/android/latest` (sem expor credenciais) e mostra o
   caminho do APK local e a versao publicada.
8. Oferece (opcional) criar um commit local `chore: release Android X.Y.Z` — nunca faz
   push nem merge.

## Testes

```powershell
node --test scripts/android/release-helpers.test.mjs
pnpm test        # inclui test:dx, que ja cobre scripts/android/*.test.mjs
pnpm lint
pnpm typecheck
git diff --check
```

## Troubleshooting

| Sintoma | Causa/acao |
|---|---|
| `doctor` reporta `FAIL` em segredo do Credential Manager | Rode `pnpm android:release:setup` novamente. |
| `doctor` reporta `FAIL` em build-tools | Instale uma versao de build-tools que contenha `apksigner.bat` e `aapt.exe` (`sdkmanager --install "build-tools;35.0.0"`). |
| `release` para em "Repositorio nao esta limpo" | Commite ou descarte alteracoes fora dos dois arquivos de bump antes de rodar de novo. |
| `release` para em "Segredo obrigatorio ausente" | Falha fechada intencional — nenhuma variavel de assinatura/bucket e exportada sem o segredo correspondente presente. |

## Rollback

Reverta o commit desta unidade com `git revert <commit>`. Nenhum segredo, keystore ou
release real foi criado por esta automacao; `release-config.json` e as entradas do
Credential Manager ficam fora do repositorio e nao sao afetados pelo revert do codigo.
