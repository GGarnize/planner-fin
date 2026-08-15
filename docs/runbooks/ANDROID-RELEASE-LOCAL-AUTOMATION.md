# Automacao local de release Android (Windows)

## Escopo

Este runbook documenta `scripts/android-release.ps1`, uma automacao local (Windows) que
elimina o ritual manual de configurar variaveis de ambiente, fazer bump de versao,
buildar, instalar via adb e publicar uma release Android do PlannerFin. Complementa
`docs/runbooks/ANDROID-RELEASE-BUCKET.md` (que documenta o build/publish em si) — este
runbook cobre apenas a orquestracao local: descoberta de SDK/build-tools, persistencia de
config nao secreta, segredos protegidos por DPAPI e o fluxo interativo de release.

Nenhuma release real foi publicada, nenhuma keystore foi gerada/alterada e nenhuma
credencial do Railway Bucket foi criada/resetada pela implementacao desta automacao.

## Por que nao usar o Railway CLI para as credenciais do bucket

A spec original avaliou duas opcoes para evitar duplicar segredos localmente: (1) Railway
CLI autenticado buscando credenciais do bucket sob demanda, ou (2) um backend local de
segredos. O Railway CLI nao esta instalado neste ambiente (`railway --version` falha) e
adotar essa dependencia exigiria login interativo adicional e manter um token amplo de
projeto Railway localmente — uma superficie de segredo maior do que as quatro credenciais
pontuais hoje necessarias. Por isso a automacao usa um backend local de segredos, sem
dependencia de CLI externo.

## Por que DPAPI e nao o Windows Credential Manager

A primeira versao desta automacao gravava os quatro segredos no Windows Credential Manager
via P/Invoke de `CredWriteW`. Isso quebrou na pratica: `CredWriteW` falha
deterministicamente com `ERROR_NOT_ENOUGH_MEMORY` (Win32 8) para blobs acima de
~120 caracteres neste ambiente — bem abaixo do limite documentado de 2560 bytes para
`CRED_TYPE_GENERIC`. O diagnostico (`scripts/android/windows-credentials.selftest.ps1`)
reproduziu a falha de forma isolada (targets novos, sem reuso) e confirmou que o limite e
por tamanho do blob, nao por target ou por numero de gravacoes; testar duas tecnicas de
marshaling diferentes (`AllocHGlobal`+`Marshal.Copy` e `byte[]` pinado via `GCHandle`)
reproduziu exatamente o mesmo limite, descartando um bug no nosso P/Invoke. Como uma
Railway access key/secret key realista fica bem acima de 120 caracteres, `CredWriteW` nao e
confiavel para este caso de uso.

A automacao agora usa **DPAPI** (`System.Security.Cryptography.ProtectedData`,
`DataProtectionScope.CurrentUser`) diretamente, sem essa limitacao — validado ate 300+
caracteres no self-test. Qualquer segredo que ja tivesse sido gravado com sucesso no
Credential Manager pela versao anterior (tipicamente as senhas de assinatura, mais curtas)
e migrado em silencio na primeira leitura: `Get-PlannerFinCredential` le do Credential
Manager legado, grava em `secrets.dat` e remove a entrada legada — sem nunca exibir o
valor. Nao ha necessidade de redigitar segredos que ja funcionavam.

## Onde cada coisa mora

| Dado | Local | Versionado? |
|---|---|---|
| Logica pura (semver, versionCode, descoberta de build-tools, config nao secreta) | `scripts/android/release-helpers.mjs` (+ `.test.mjs`) | Sim |
| Backend de segredos (DPAPI + migracao legada, sem modulo externo) | `scripts/android/windows-credentials.ps1` (+ `.selftest.ps1`) | Sim |
| Funcoes da automacao (setup/doctor/release/build/publish/commit) | `scripts/android-release.lib.ps1` (+ `.selftest.ps1`) | Sim |
| Entrypoint fino (param + dispatch) | `scripts/android-release.ps1` | Sim |
| Config nao secreta (URLs, caminhos, bucket/endpoint/region) | `C:\Users\<usuario>\.planner-fin\release-config.json` | Nao (fora do repo) |
| Keystore de release | `C:\Users\<usuario>\.planner-fin\signing\planner-fin-release.jks` | Nao (fora do repo, `.gitignore` ja cobre `*.jks`) |
| Senha da keystore / senha da key / credenciais do bucket | `C:\Users\<usuario>\.planner-fin\secrets.dat` (cada valor cifrado individualmente com DPAPI) | Nao (fora do repo; so contem ciphertext base64, nunca texto plano) |
| `sdk.dir` do Gradle | `apps/web/android/local.properties` (auto-sincronizado com `androidSdkDir`) | Nao (ja no `.gitignore`) |

Nenhum segredo e aceito por argumento de linha de comando nem impresso no console/log —
senhas usam `Read-Host -AsSecureString` (sem eco); `secrets.dat` so guarda ciphertext e so
pode ser decifrado pelo mesmo usuario Windows que gravou (DPAPI `CurrentUser`); a gravacao e
atomica (arquivo temporario + `Move-Item`, nunca truncamento no meio de uma escrita); os
valores em texto plano so existem em memoria pelo tempo minimo necessario para exportar como
variavel de ambiente do processo filho `pnpm`/`gradlew`.

### Nomes usados em `secrets.dat`

| Chave | Uso |
|---|---|
| `PlannerFin/KeystorePassword` | `PLANNER_FIN_KEYSTORE_PASSWORD` |
| `PlannerFin/KeyPassword` | `PLANNER_FIN_KEY_PASSWORD` |
| `PlannerFin/RailwayBucketAccessKey` | `ACCESS_KEY_ID` |
| `PlannerFin/RailwayBucketSecretKey` | `SECRET_ACCESS_KEY` |

## Comandos

```powershell
pnpm android:release:setup             # configura release-config.json + segredos (interativo)
pnpm android:release:doctor            # valida tudo sem alterar nada (SDK, build-tools, keystore, segredos, versao)
pnpm android:release                   # fluxo completo: bump -> build -> instalar (opcional) -> publish (com confirmacao dupla)
pnpm android:release:commit            # so cria o commit local do bump ja gravado (chore: release Android X.Y.Z), sem push
pnpm android:release:secrets:selftest  # diagnostico do backend de segredos com valores SINTETICOS (nunca reais)
```

`scripts/android-release.ps1` tambem aceita `-Command build` e `-Command publish` para
rodar so uma etapa (uteis depois de um bump manual ou para reexecutar so o publish).

### `setup` e reexecucao segura

`setup` pergunta por cada um dos quatro segredos individualmente, com o default da
pergunta ajustado ao estado atual: se o segredo ja esta configurado, pergunta se deve
**atualizar** (default nao — reexecutar o setup nao redigita nada sem necessidade); se
ainda nao esta, pergunta se deve **configurar** (default sim). Cada gravacao e feita uma de
cada vez e confirmada com um round-trip de presenca (nunca de valor) logo em seguida; se
uma gravacao falhar, o setup mostra claramente qual segredo nao foi salvo e continua com os
demais — os outros tres, ja salvos com sucesso, nunca sao apagados ou afetados por essa
falha (cada segredo e uma chave independente em `secrets.dat`).

### Descoberta de build-tools

`local.properties` ja resolve `sdk.dir` para o Gradle — a automacao nao depende de
`ANDROID_HOME`. Para `apksigner`/`aapt` (usados na verificacao obrigatoria do APK release),
`Get-CompleteBuildToolsPath` varre `<sdkDir>/build-tools/*` da versao mais nova para a mais
antiga e usa a primeira que realmente contenha `apksigner.bat` e `aapt.exe` — nesta maquina
`36.0.0` esta instalado mas incompleto (sem apksigner/aapt) e `35.0.0` e escolhido
automaticamente. Essa logica esta coberta por teste em
`scripts/android/release-helpers.test.mjs`.

### `local.properties` e o `androidSdkDir` configurado

`local.properties` nao e so criado quando falta — a automacao valida ativamente que o
`sdk.dir` gravado nele **corresponde de fato** ao `androidSdkDir` do `release-config.json`,
para nunca reproduzir o cenario "config/doctor apontam para um SDK valido, mas o Gradle le
um `local.properties` antigo/incorreto e o build falha":

- **`doctor`** so le e compara (nunca escreve): reporta `OK` se o `sdk.dir` bate com a
  config, `FAIL` se o arquivo nao existe, se existe mas nao tem a chave `sdk.dir`, ou se
  aponta para um SDK diferente (`stale`) — comparacao tolerante a maiuscula/minuscula e
  barra final, mas exige o mesmo caminho.
- **`build`/`release`** sincronizam automaticamente: criam o arquivo se faltar, ou
  atualizam so a linha `sdk.dir` (preservando qualquer outra propriedade ja presente) se
  ela estiver desatualizada, sempre mostrando uma mensagem clara de que o valor foi
  sincronizado. O valor e escrito no formato Windows esperado pelo Gradle
  (`C:\\Users\\...`, com barra dupla escapada).

Toda essa logica (parse/gravacao/comparacao) e pura e testada em
`scripts/android/release-helpers.test.mjs` (`parseSdkDirFromLocalProperties`,
`buildLocalPropertiesContent`, `checkLocalPropertiesSdkDir`).

### Fluxo de `pnpm android:release`

1. Detecta o estado do repositorio via `git status --porcelain` comparado ao `HEAD`
   (`detectReleaseResumeState`), para nunca bumpar a versao duas vezes numa retomada:
   - **limpo**: fluxo normal — sugere o proximo patch semver e `versionCode + 1` a partir
     da versao do HEAD.
   - **bump pendente** (somente `apps/web/package.json` e
     `apps/web/android/version.json` modificados, e a versao do working tree ja difere do
     HEAD — sinal de uma tentativa anterior que bumpou mas o build/publish falhou):
     mostra `Release pendente detectada: X.Y.Z (N)` e pergunta se deve **retomar** essa
     mesma versao (default sim) sem calcular um novo bump em cima dela. Só se o usuario
     recusar a retomada e confirmar explicitamente o descarte, o script roda
     `git checkout -- apps/web/package.json apps/web/android/version.json` e sugere um
     bump novo a partir do HEAD — nunca descarta automaticamente.
   - **bloqueado**: qualquer arquivo fora desses dois (ou os dois arquivos tocados sem
     mudanca real de versao/versionCode) interrompe a release com erro explicito.
2. Mostra o resumo do bump e pede confirmacao antes de gravar
   `apps/web/package.json`/`apps/web/android/version.json` (pulado quando retomando).
3. Roda `pnpm android:release:build` com `VITE_API_BASE_URL` e as quatro variaveis
   `PLANNER_FIN_KEY*` exportadas **somente para esse processo filho** (removidas do
   ambiente do PowerShell logo depois, sucesso ou falha).
4. Se houver device via `adb devices`, pergunta se deve instalar com `adb install -r`.
5. Pergunta se deve publicar. Se sim: roda o dry-run de
   `pnpm android:release:publish` (sem `--yes`), mostra um resumo nao secreto
   (versao, versionCode, bucket, endpoint, apiBaseUrl — nunca as credenciais), exige que o
   usuario digite exatamente `PUBLICAR` (confirmacao mais forte que sim/nao, pois a
   publicacao e imutavel) e so entao roda `pnpm android:release:publish -- --yes`.
6. Tenta confirmar `GET /api/releases/android/latest` (sem expor credenciais) e mostra o
   caminho do APK local e a versao publicada.
7. Oferece (opcional) criar um commit local `chore: release Android X.Y.Z` — nunca faz
   push nem merge.

## Testes

```powershell
node --test scripts/android/release-helpers.test.mjs
pnpm android:release:secrets:selftest   # backend de segredos, so valores sinteticos
pnpm android:release:lib:selftest       # funcoes de android-release.lib.ps1 sob StrictMode
pnpm test        # inclui test:dx, que ja cobre scripts/android/*.test.mjs
pnpm lint
pnpm typecheck
git diff --check
```

Nenhum dos dois `.selftest.ps1` esta no `test:dx` (e PowerShell, nao Node) — rode-os
manualmente sempre que mexer nos arquivos correspondentes.

`windows-credentials.selftest.ps1` **nunca grava, remove, ou le-para-restaurar** nenhum dos
quatro nomes reais (`PlannerFin/KeystorePassword`, `PlannerFin/KeyPassword`,
`PlannerFin/RailwayBucketAccessKey`, `PlannerFin/RailwayBucketSecretKey`) — todo round-trip
mutavel (curto, ~60 chars, ~128 chars, e o mesmo "formato" de uma Railway access key) roda
so em targets sinteticos dedicados com prefixo `_SelfTest*`, sempre limpos em `finally`
mesmo se uma asserção do meio falhar. Como garantia de regressão, o self-test tira um
snapshot (so leitura do ciphertext bruto, nunca decifrado) dos quatro targets reais antes
de rodar qualquer teste e outro depois — essa comparação roda em `finally`, então detecta
uma regressão futura mesmo que algo quebre no meio — e falha se qualquer um deles mudou.
(Uma versão anterior deste self-test escrevia temporariamente sobre o target real
`PlannerFin/RailwayBucketAccessKey`, salvando/restaurando o ciphertext ao redor de um
round-trip sintético; sem essa restauração estar em `finally`, isso apagou de fato um
segredo real de produção quando o processo foi interrompido no meio. Removido por completo
— nenhum teste aqui toca em nome real nenhum; se isso já tiver acontecido,
`pnpm android:release:setup` reconfigura só o segredo afetado.) O self-test também
verifica via transcript que nenhum valor sintético usado aparece na saída impressa.

`android-release.lib.selftest.ps1` dot-sourceia so `android-release.lib.ps1` (nunca o
entrypoint `android-release.ps1`, que dispararia um comando real) sob
`Set-StrictMode -Version Latest` — a mesma configuracao do entrypoint real — e cobre o bug
ja corrigido uma vez nesta automacao: `Assert-SigningSecretsPresent`/
`Assert-BucketSecretsPresent`/`Get-ConnectedAdbDeviceCount` derivam de
`... | Where-Object {...}`, e sob StrictMode um pipeline com zero ou exatamente um
resultado nao retorna uma colecao (retorna `$null` ou um escalar) — `.Count` nesses casos
lanca `PropertyNotFoundStrict`. O teste cobre explicitamente 0/1/2 segredos faltando e
0/1/2 dispositivos ADB conectados (com linhas sinteticas, sem precisar de device real).

## Troubleshooting

| Sintoma | Causa/acao |
|---|---|
| `doctor` reporta `FAIL` em segredo | Rode `pnpm android:release:setup` novamente (so precisa reconfigurar o que falhou). |
| `doctor` reporta `FAIL` "Backend local de segredos (DPAPI) nao esta funcional" | Rode `pnpm android:release:secrets:selftest` para diagnosticar; provavelmente um problema de permissao em `C:\Users\<usuario>\.planner-fin\`. |
| `setup` reporta "NAO foi salvo" para um segredo | O erro especifico aparece na linha `[FALHOU]`; os demais segredos ja salvos nao sao afetados — rode `setup` de novo para tentar so o que falhou. |
| `doctor` reporta `FAIL` em build-tools | Instale uma versao de build-tools que contenha `apksigner.bat` e `aapt.exe` (`sdkmanager --install "build-tools;35.0.0"`). |
| `doctor` reporta `FAIL` "local.properties aponta para X, mas a config aponta para Y" | Rode `pnpm android:release:build` (ou `android:release`) para sincronizar automaticamente, ou edite `sdk.dir` manualmente. |
| `release` para em "Repositorio nao esta limpo" | Commite ou descarte alteracoes fora dos dois arquivos de bump antes de rodar de novo. |
| `release` mostra "Release pendente detectada" | Uma tentativa anterior ja bumpou a versao mas o build/publish nao terminou — responda "sim" para retomar exatamente essa versao (nunca bumpa de novo), ou recuse e confirme o descarte para calcular um bump novo. |
| `release` para em "Segredo obrigatorio ausente" | Falha fechada intencional — nenhuma variavel de assinatura/bucket e exportada sem o segredo correspondente presente. |
| `release` falha logo no inicio com `A propriedade 'Count' nao foi encontrada` | Bug ja corrigido nesta automacao (`Assert-SigningSecretsPresent`/`Assert-BucketSecretsPresent` usavam `.Count` sobre um pipeline `Where-Object` que colapsa para `$null`/escalar com 0 ou 1 resultado sob `Set-StrictMode -Version Latest`). Se reaparecer, rode `pnpm android:release:lib:selftest` para localizar o ponto exato. |

## Rollback

Reverta o commit desta unidade com `git revert <commit>`. Nenhum segredo, keystore ou
release real foi criado por esta automacao; `release-config.json` e `secrets.dat` ficam
fora do repositorio e nao sao afetados pelo revert do codigo. Reverter o codigo NAO desfaz
uma migracao de segredo ja feita (Credential Manager -> `secrets.dat`); isso e esperado, ja
que a migracao so move um segredo que o usuario ja possuia entre dois locais igualmente
locais e privados.
