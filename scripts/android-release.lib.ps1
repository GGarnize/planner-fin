<#
  Biblioteca de funcoes da automacao local de release Android (ver scripts/android-release.ps1
  para o entrypoint/dispatch). Separado num arquivo dot-sourceable proprio para poder ser
  testado em isolamento (scripts/android-release.lib.selftest.ps1) sem disparar nenhum
  comando real -- dot-source deste arquivo so define variaveis de caminho e funcoes, nunca
  executa build/publish/setup.
#>

$script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$script:WebDir = Join-Path $script:RepoRoot 'apps\web'
$script:ConfigDir = Join-Path $env:USERPROFILE '.planner-fin'
$script:ConfigPath = Join-Path $script:ConfigDir 'release-config.json'
$script:HelpersScript = Join-Path $PSScriptRoot 'android\release-helpers.mjs'

. (Join-Path $PSScriptRoot 'android\windows-credentials.ps1')

$script:SecretTargets = @{
  KeystorePassword       = 'PlannerFin/KeystorePassword'
  KeyPassword            = 'PlannerFin/KeyPassword'
  RailwayBucketAccessKey = 'PlannerFin/RailwayBucketAccessKey'
  RailwayBucketSecretKey = 'PlannerFin/RailwayBucketSecretKey'
}

# ---------------------------------------------------------------------------
# Helpers genericos
# ---------------------------------------------------------------------------

function ConvertTo-Base64Json {
  param($Value)
  $json = $Value | ConvertTo-Json -Compress -Depth 5
  return [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($json))
}

function Invoke-ReleaseHelper {
  param([string[]] $HelperArgs, [string] $StdIn)
  Push-Location $script:RepoRoot
  try {
    if ($null -ne $StdIn) {
      $output = $StdIn | & node $script:HelpersScript @HelperArgs 2>&1
    } else {
      $output = & node $script:HelpersScript @HelperArgs 2>&1
    }
    if ($LASTEXITCODE -ne 0) { throw ($output -join "`n") }
    return ($output -join "`n")
  } finally {
    Pop-Location
  }
}

function Confirm-YesNo {
  param([Parameter(Mandatory = $true)][string] $Message, [switch] $DefaultYes)
  $suffix = if ($DefaultYes) { '[S/n]' } else { '[s/N]' }
  $answer = Read-Host "$Message $suffix"
  if ([string]::IsNullOrWhiteSpace($answer)) { return [bool]$DefaultYes }
  return $answer.Trim().ToLowerInvariant() -in @('s', 'sim', 'y', 'yes')
}

function Read-WithDefault {
  param([Parameter(Mandatory = $true)][string] $Message, [string] $Default)
  $display = if ($Default) { "$Message [$Default]" } else { $Message }
  $answer = Read-Host $display
  if ([string]::IsNullOrWhiteSpace($answer)) { return $Default }
  return $answer
}

function Invoke-ScopedEnv {
  <# Define variaveis de ambiente apenas para a duracao do ScriptBlock (que tipicamente
     spawna um processo filho pnpm/node/gradle). Sempre restaura o valor anterior depois,
     mesmo em caso de erro - as variaveis nunca ficam "vazando" na sessao depois do comando. #>
  param([Parameter(Mandatory = $true)][hashtable] $EnvMap, [Parameter(Mandatory = $true)][scriptblock] $ScriptBlock)
  $previous = @{}
  foreach ($key in $EnvMap.Keys) {
    $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
    [Environment]::SetEnvironmentVariable($key, [string]$EnvMap[$key], 'Process')
  }
  try {
    & $ScriptBlock
  } finally {
    foreach ($key in $EnvMap.Keys) {
      [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process')
    }
  }
}

function Get-ConnectedAdbDeviceCount {
  <#
    Conta quantas linhas de "adb devices" terminam em "device" (dispositivo pronto -- nao
    conta "unauthorized"/"offline"/o cabecalho "List of devices attached"). Recebe as
    linhas como parametro (em vez de rodar adb.exe internamente) para ser testavel com
    saida sintetica, sem precisar de um adb/dispositivo real. Sempre embrulha o resultado
    do pipeline com @(...) antes de usar .Count -- com Set-StrictMode -Version Latest,
    Where-Object com zero ou exatamente um resultado nao retorna uma colecao (retorna
    $null ou um escalar), e .Count nesses casos lanca PropertyNotFoundStrict.
  #>
  param([string[]] $Lines)
  return @($Lines | Select-String -Pattern '\bdevice$').Count
}

# ---------------------------------------------------------------------------
# Config nao secreto
# ---------------------------------------------------------------------------

function Get-DefaultReleaseConfig {
  return [ordered]@{
    apiBaseUrlProd = ''
    keystoreFile   = Join-Path $env:USERPROFILE '.planner-fin\signing\planner-fin-release.jks'
    keyAlias       = ''
    androidSdkDir  = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
    bucket         = ''
    endpoint       = ''
    region         = ''
  }
}

function Get-ReleaseConfigOrTemplate {
  $defaultsB64 = ConvertTo-Base64Json (Get-DefaultReleaseConfig)
  $result = Invoke-ReleaseHelper @('init-config', $script:ConfigPath, $defaultsB64) | ConvertFrom-Json
  if ($result.created) {
    Write-Host "Template criado em $script:ConfigPath - rode 'pnpm android:release:setup' para preenche-lo." -ForegroundColor Yellow
  }
  return $result.config
}

function Save-ReleaseConfig {
  param([Parameter(Mandatory = $true)] $Config)
  $configB64 = ConvertTo-Base64Json $Config
  Invoke-ReleaseHelper @('write-config', $script:ConfigPath, $configB64) | Out-Null
}

function Assert-ReleaseConfigComplete {
  Invoke-ReleaseHelper @('assert-config-complete', $script:ConfigPath) | Out-Null
}

# ---------------------------------------------------------------------------
# Segredos
# ---------------------------------------------------------------------------

function Get-ResolvedSecrets {
  return @{
    KeystorePassword       = Get-PlannerFinCredential -Name $script:SecretTargets.KeystorePassword
    KeyPassword            = Get-PlannerFinCredential -Name $script:SecretTargets.KeyPassword
    RailwayBucketAccessKey = Get-PlannerFinCredential -Name $script:SecretTargets.RailwayBucketAccessKey
    RailwayBucketSecretKey = Get-PlannerFinCredential -Name $script:SecretTargets.RailwayBucketSecretKey
  }
}

function Assert-SigningSecretsPresent {
  param($Secrets)
  $missing = @(@('KeystorePassword', 'KeyPassword') | Where-Object { -not $Secrets[$_] })
  if ($missing.Count -gt 0) {
    throw "Segredo(s) de assinatura ausente(s) no armazenamento local: $($missing -join ', '). Rode 'pnpm android:release:setup'."
  }
}

function Assert-BucketSecretsPresent {
  param($Secrets)
  $missing = @(@('RailwayBucketAccessKey', 'RailwayBucketSecretKey') | Where-Object { -not $Secrets[$_] })
  if ($missing.Count -gt 0) {
    throw "Credencial(is) do Railway Bucket ausente(s) no armazenamento local: $($missing -join ', '). Rode 'pnpm android:release:setup'."
  }
}

# ---------------------------------------------------------------------------
# SDK / build-tools / PATH
# ---------------------------------------------------------------------------

function Get-CompleteBuildToolsPath {
  param([Parameter(Mandatory = $true)][string] $SdkDir)
  $json = Invoke-ReleaseHelper @('find-build-tools', $SdkDir) | ConvertFrom-Json
  return $json.path
}

function Get-ToolPathAdditions {
  param([Parameter(Mandatory = $true)][string] $SdkDir)
  $buildTools = Get-CompleteBuildToolsPath -SdkDir $SdkDir
  $platformTools = Join-Path $SdkDir 'platform-tools'
  return @($buildTools, $platformTools) | Where-Object { $_ -and (Test-Path $_) }
}

function Get-LocalPropertiesPath {
  return Join-Path $script:WebDir 'android\local.properties'
}

function Read-LocalPropertiesContentOrNull {
  $path = Get-LocalPropertiesPath
  if (-not (Test-Path $path)) { return $null }
  return (Get-Content $path -Raw)
}

function Test-LocalPropertiesSdkDir {
  <# So le e compara - nunca altera o arquivo. Usado pelo doctor. #>
  param([Parameter(Mandatory = $true)][string] $SdkDir)
  $content = Read-LocalPropertiesContentOrNull
  if ($null -eq $content) {
    return (Invoke-ReleaseHelper @('check-local-properties', $SdkDir, '--absent') | ConvertFrom-Json)
  }
  return (Invoke-ReleaseHelper @('check-local-properties', $SdkDir) -StdIn $content | ConvertFrom-Json)
}

function Sync-LocalPropertiesSdkDir {
  <# Cria o arquivo se faltar, ou atualiza sdk.dir se estiver desatualizado em relacao a
     $SdkDir - preservando qualquer outra linha existente. So escreve quando necessario. #>
  param([Parameter(Mandatory = $true)][string] $SdkDir)
  $content = Read-LocalPropertiesContentOrNull
  $result = if ($null -eq $content) {
    Invoke-ReleaseHelper @('sync-local-properties', $SdkDir, '--absent') | ConvertFrom-Json
  } else {
    Invoke-ReleaseHelper @('sync-local-properties', $SdkDir) -StdIn $content | ConvertFrom-Json
  }
  if ($result.changed) {
    [System.IO.File]::WriteAllText((Get-LocalPropertiesPath), $result.content, (New-Object System.Text.UTF8Encoding($false)))
    if ($null -eq $content) {
      Write-Host "local.properties criado com sdk.dir=$SdkDir"
    } else {
      Write-Host "local.properties estava desatualizado - sdk.dir atualizado para $SdkDir." -ForegroundColor Yellow
    }
  }
}

# ---------------------------------------------------------------------------
# Versao / versionCode
# ---------------------------------------------------------------------------

function Get-CurrentVersionInfo {
  $pkgPath = Join-Path $script:WebDir 'package.json'
  $verPath = Join-Path $script:WebDir 'android\version.json'
  $version = (Get-Content $pkgPath -Raw | ConvertFrom-Json).version
  $versionCode = (Get-Content $verPath -Raw | ConvertFrom-Json).versionCode
  return [pscustomobject]@{
    Version         = $version
    VersionCode     = [int]$versionCode
    PackageJsonPath = $pkgPath
    VersionJsonPath = $verPath
  }
}

function Set-ReleaseVersionFiles {
  param([Parameter(Mandatory = $true)][string] $NewVersion, [Parameter(Mandatory = $true)][int] $NewVersionCode)
  $info = Get-CurrentVersionInfo
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)

  $pkgContent = Get-Content $info.PackageJsonPath -Raw
  $pkgRegex = [regex]'"version":\s*"[^"]+"'
  $pkgContent = $pkgRegex.Replace($pkgContent, "`"version`": `"$NewVersion`"", 1)
  [System.IO.File]::WriteAllText($info.PackageJsonPath, $pkgContent, $utf8NoBom)

  $verContent = Get-Content $info.VersionJsonPath -Raw
  $verRegex = [regex]'"versionCode":\s*\d+'
  $verContent = $verRegex.Replace($verContent, "`"versionCode`": $NewVersionCode", 1)
  [System.IO.File]::WriteAllText($info.VersionJsonPath, $verContent, $utf8NoBom)
}

function Get-HeadVersionInfo {
  <# Le versao/versionCode do ultimo commit (HEAD), nao do working tree - usado para saber
     se o working tree ja tem um bump pendente de uma tentativa anterior. #>
  Push-Location $script:RepoRoot
  try {
    $pkgJson = (& git show 'HEAD:apps/web/package.json') 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $pkgJson) { throw 'Nao foi possivel ler apps/web/package.json do HEAD git.' }
    $verJson = (& git show 'HEAD:apps/web/android/version.json') 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $verJson) { throw 'Nao foi possivel ler apps/web/android/version.json do HEAD git.' }
  } finally {
    Pop-Location
  }
  $pkg = $pkgJson -join "`n" | ConvertFrom-Json
  $ver = $verJson -join "`n" | ConvertFrom-Json
  return [pscustomobject]@{ Version = $pkg.version; VersionCode = [int]$ver.versionCode }
}

function Get-ReleaseResumeState {
  <# Distingue repo limpo / bump pendente retomavel / bloqueado - nunca deixa o chamador
     sugerir um novo next-patch em cima de um bump que uma tentativa anterior ja fez. #>
  Push-Location $script:RepoRoot
  try {
    $status = (& git status --porcelain) -join "`n"
  } finally {
    Pop-Location
  }
  $head = Get-HeadVersionInfo
  $working = Get-CurrentVersionInfo
  $payload = [ordered]@{
    porcelainOutput    = $status
    headVersion        = $head.Version
    headVersionCode    = $head.VersionCode
    workingVersion     = $working.Version
    workingVersionCode = $working.VersionCode
  }
  $json = $payload | ConvertTo-Json -Compress
  return (Invoke-ReleaseHelper @('detect-resume-state') -StdIn $json | ConvertFrom-Json)
}

function Invoke-VersionBumpPrompt {
  <# Sugere next-patch/versionCode+1 a partir de $Current, pede confirmacao e grava os
     arquivos de bump. Retorna $null se o usuario cancelar (nenhum arquivo e alterado). #>
  param([Parameter(Mandatory = $true)] $Current)
  Write-Host "Versao atual: $($Current.Version) (versionCode $($Current.VersionCode))"
  $suggestedVersion = Invoke-ReleaseHelper @('next-patch', $Current.Version)
  $suggestedVersionCode = [int](Invoke-ReleaseHelper @('next-version-code', "$($Current.VersionCode)"))

  $newVersion = Read-WithDefault 'Nova versao (SemVer 0.x.y)' $suggestedVersion
  $newVersionCode = [int](Read-WithDefault 'Novo versionCode' "$suggestedVersionCode")

  Write-Host ''
  Write-Host "Resumo do bump: $($Current.Version) -> $newVersion | versionCode $($Current.VersionCode) -> $newVersionCode"
  if (-not (Confirm-YesNo 'Confirma o bump de versao acima?' -DefaultYes)) {
    Write-Host 'Cancelado pelo usuario. Nenhum arquivo foi alterado.'
    return $null
  }

  Set-ReleaseVersionFiles -NewVersion $newVersion -NewVersionCode $newVersionCode
  Write-Host "apps/web/package.json e apps/web/android/version.json atualizados para $newVersion / $newVersionCode." -ForegroundColor Green
  return [pscustomobject]@{ Version = $newVersion; VersionCode = $newVersionCode }
}

# ---------------------------------------------------------------------------
# Comandos
# ---------------------------------------------------------------------------

function Invoke-SetupCommand {
  Write-Host 'PlannerFin - setup de release Android'
  Write-Host "Config nao secreta: $script:ConfigPath"
  Write-Host ''

  $config = Get-ReleaseConfigOrTemplate
  $configHash = [ordered]@{}
  foreach ($prop in $config.PSObject.Properties) { $configHash[$prop.Name] = $prop.Value }

  $configHash.apiBaseUrlProd = Read-WithDefault 'VITE_API_BASE_URL de producao (https://.../api)' $configHash.apiBaseUrlProd
  $configHash.keystoreFile = Read-WithDefault 'Caminho da keystore de release (PLANNER_FIN_KEYSTORE_FILE)' $configHash.keystoreFile
  $configHash.keyAlias = Read-WithDefault 'Key alias (PLANNER_FIN_KEY_ALIAS)' $configHash.keyAlias
  $configHash.androidSdkDir = Read-WithDefault 'Diretorio do Android SDK' $configHash.androidSdkDir
  $configHash.bucket = Read-WithDefault 'Railway Bucket - nome (BUCKET)' $configHash.bucket
  $configHash.endpoint = Read-WithDefault 'Railway Bucket - endpoint (ENDPOINT)' $configHash.endpoint
  $configHash.region = Read-WithDefault 'Railway Bucket - regiao (REGION)' $configHash.region

  Save-ReleaseConfig $configHash
  Write-Host "Config nao secreta salva em $script:ConfigPath"
  Write-Host ''

  $outcomes = [ordered]@{}
  $outcomes['Senha da keystore'] = Set-PlannerFinSecretIfRequested -Target $script:SecretTargets.KeystorePassword -Label 'senha da keystore' -PromptText 'Senha da keystore'
  $outcomes['Senha da key'] = Set-PlannerFinSecretIfRequested -Target $script:SecretTargets.KeyPassword -Label 'senha da key' -PromptText 'Senha da key'
  $outcomes['ACCESS_KEY_ID do bucket'] = Set-PlannerFinSecretIfRequested -Target $script:SecretTargets.RailwayBucketAccessKey -Label 'ACCESS_KEY_ID do bucket' -PromptText 'ACCESS_KEY_ID do bucket'
  $outcomes['SECRET_ACCESS_KEY do bucket'] = Set-PlannerFinSecretIfRequested -Target $script:SecretTargets.RailwayBucketSecretKey -Label 'SECRET_ACCESS_KEY do bucket' -PromptText 'SECRET_ACCESS_KEY do bucket'

  Write-Host ''
  $failedLabels = $outcomes.GetEnumerator() | Where-Object { $_.Value -eq 'failed' } | ForEach-Object { $_.Key }
  if ($failedLabels) {
    Write-Host "Atencao: NAO foram salvos: $($failedLabels -join ', '). Os demais segredos ja salvos nao foram afetados. Rode 'pnpm android:release:setup' novamente para tentar de novo so esses." -ForegroundColor Yellow
  }
  Write-Host "Setup concluido. Rode 'pnpm android:release:doctor' para validar." -ForegroundColor Green
}

function Set-PlannerFinSecretIfRequested {
  <#
    Pergunta antes de mexer em cada segredo individualmente. O default da pergunta muda
    conforme o estado atual: 'configurar' (default sim) se ainda nao existe, 'atualizar'
    (default nao) se ja existe - para reexecucoes do setup pularem, por padrao, o que ja
    esta configurado sem exigir redigitar tudo de novo. Grava um segredo por vez: uma falha
    aqui nunca apaga nem afeta os outros tres, ja que cada Set-PlannerFinCredential so
    atualiza a propria chave no arquivo de segredos. Depois de gravar, faz um round-trip de
    presenca (nunca de valor) para confirmar que a gravacao realmente "pegou" antes de
    reportar sucesso. Retorna 'saved' | 'skipped' | 'failed'.
  #>
  param(
    [Parameter(Mandatory = $true)][string] $Target,
    [Parameter(Mandatory = $true)][string] $Label,
    [Parameter(Mandatory = $true)][string] $PromptText
  )
  $alreadyConfigured = Test-PlannerFinCredential -Name $Target
  $question = if ($alreadyConfigured) { "$Label ja esta configurada. Atualizar agora?" } else { "Configurar $Label agora?" }
  if (-not (Confirm-YesNo $question -DefaultYes:(-not $alreadyConfigured))) {
    return 'skipped'
  }
  try {
    Set-PlannerFinCredential -Name $Target -SecureValue (Read-Host -Prompt $PromptText -AsSecureString)
    if (-not (Test-PlannerFinCredential -Name $Target)) {
      throw 'gravado, mas a releitura de presenca falhou logo em seguida.'
    }
    Write-Host "  [OK] $Label salva e confirmada." -ForegroundColor Green
    return 'saved'
  } catch {
    Write-Host "  [FALHOU] $Label NAO foi salva: $($_.Exception.Message)" -ForegroundColor Red
    return 'failed'
  }
}

function Write-DoctorLine {
  param([string] $Status, [string] $Message)
  $color = switch ($Status) { 'OK' { 'Green' } 'WARN' { 'Yellow' } default { 'Red' } }
  Write-Host ("[{0,-4}] {1}" -f $Status, $Message) -ForegroundColor $color
}

function Invoke-DoctorCommand {
  $failed = $false
  $config = $null
  try {
    $config = Get-ReleaseConfigOrTemplate
    Write-DoctorLine 'OK' "release-config.json legivel ($script:ConfigPath)"
  } catch {
    Write-DoctorLine 'FAIL' "release-config.json invalido: $($_.Exception.Message)"
    $failed = $true
  }

  if ($config) {
    if ($config.androidSdkDir -and (Test-Path $config.androidSdkDir)) {
      Write-DoctorLine 'OK' "Android SDK encontrado em $($config.androidSdkDir)"
    } else {
      Write-DoctorLine 'FAIL' "Android SDK nao encontrado em $($config.androidSdkDir)"
      $failed = $true
    }

    try {
      $buildTools = Get-CompleteBuildToolsPath -SdkDir $config.androidSdkDir
      Write-DoctorLine 'OK' "build-tools completo encontrado: $buildTools"
    } catch {
      Write-DoctorLine 'FAIL' $_.Exception.Message
      $failed = $true
    }

    $localProps = Test-LocalPropertiesSdkDir -SdkDir $config.androidSdkDir
    switch ($localProps.status) {
      'ok' { Write-DoctorLine 'OK' "apps/web/android/local.properties aponta para sdk.dir=$($localProps.currentSdkDir)" }
      'missing' { Write-DoctorLine 'FAIL' 'apps/web/android/local.properties nao existe (rode "pnpm android:release:build" para gerar).'; $failed = $true }
      'missing_key' { Write-DoctorLine 'FAIL' 'apps/web/android/local.properties existe mas nao contem sdk.dir.'; $failed = $true }
      'stale' { Write-DoctorLine 'FAIL' "apps/web/android/local.properties aponta para $($localProps.currentSdkDir), mas a config aponta para $($config.androidSdkDir) - rode 'pnpm android:release:build' para sincronizar."; $failed = $true }
    }

    $platformTools = Join-Path $config.androidSdkDir 'platform-tools'
    if (Test-Path (Join-Path $platformTools 'adb.exe')) {
      Write-DoctorLine 'OK' 'adb.exe encontrado em platform-tools'
      $deviceCount = Get-ConnectedAdbDeviceCount -Lines ((& (Join-Path $platformTools 'adb.exe') devices) 2>$null)
      if ($deviceCount -gt 0) {
        Write-DoctorLine 'OK' "$deviceCount dispositivo(s) Android conectado(s)"
      } else {
        Write-DoctorLine 'WARN' 'Nenhum dispositivo Android conectado (adb devices).'
      }
    } else {
      Write-DoctorLine 'FAIL' 'adb.exe nao encontrado em platform-tools.'
      $failed = $true
    }

    if ($config.keystoreFile -and (Test-Path $config.keystoreFile)) {
      Write-DoctorLine 'OK' "Keystore encontrada em $($config.keystoreFile)"
    } else {
      Write-DoctorLine 'FAIL' "Keystore nao encontrada em $($config.keystoreFile)"
      $failed = $true
    }

    if ($config.apiBaseUrlProd) {
      $probe = Invoke-ScopedEnv @{ VITE_API_BASE_URL = $config.apiBaseUrlProd } {
        Push-Location $script:WebDir
        try { & node 'scripts\validate-prod-web-env.mjs' 2>&1; $LASTEXITCODE } finally { Pop-Location }
      }
      if ($probe[-1] -eq 0) {
        Write-DoctorLine 'OK' "VITE_API_BASE_URL valida ($($config.apiBaseUrlProd))"
      } else {
        Write-DoctorLine 'FAIL' "VITE_API_BASE_URL invalida: $($probe -join ' ')"
        $failed = $true
      }
    } else {
      Write-DoctorLine 'FAIL' 'apiBaseUrlProd nao configurada.'
      $failed = $true
    }

    $bucketFieldsOk = $config.bucket -and $config.endpoint -and $config.region
    if ($bucketFieldsOk) {
      Write-DoctorLine 'OK' 'Campos nao secretos do Railway Bucket configurados (bucket/endpoint/region).'
    } else {
      Write-DoctorLine 'WARN' 'Campos do Railway Bucket incompletos - publish ficara indisponivel ate configurar.'
    }
  }

  if (Test-PlannerFinSecretsBackend) {
    Write-DoctorLine 'OK' 'Backend local de segredos (DPAPI) funcional (round-trip sintetico interno).'
  } else {
    Write-DoctorLine 'FAIL' 'Backend local de segredos (DPAPI) nao esta funcional neste ambiente.'
    $failed = $true
  }

  $secrets = Get-ResolvedSecrets
  foreach ($name in @('KeystorePassword', 'KeyPassword')) {
    if ($secrets[$name]) { Write-DoctorLine 'OK' "Segredo '$name': presente." }
    else { Write-DoctorLine 'FAIL' "Segredo '$name': ausente."; $failed = $true }
  }
  foreach ($name in @('RailwayBucketAccessKey', 'RailwayBucketSecretKey')) {
    if ($secrets[$name]) { Write-DoctorLine 'OK' "Segredo '$name': presente." }
    else { Write-DoctorLine 'WARN' "Segredo '$name': ausente (publish ficara indisponivel)." }
  }

  try {
    $info = Get-CurrentVersionInfo
    Write-DoctorLine 'OK' "Versao atual: $($info.Version) (versionCode $($info.VersionCode))"
  } catch {
    Write-DoctorLine 'FAIL' "Nao foi possivel ler versao/versionCode: $($_.Exception.Message)"
    $failed = $true
  }

  Write-Host ''
  if ($failed) {
    Write-Host 'Doctor encontrou pendencias FAIL acima.' -ForegroundColor Red
    exit 1
  }
  Write-Host 'Doctor: tudo OK (avisos WARN nao bloqueiam).' -ForegroundColor Green
}

function Invoke-BuildCommand {
  param([Parameter(Mandatory = $true)] $Config, [Parameter(Mandatory = $true)] $Secrets)
  Assert-SigningSecretsPresent $Secrets
  Sync-LocalPropertiesSdkDir -SdkDir $Config.androidSdkDir
  $pathAdditions = Get-ToolPathAdditions -SdkDir $Config.androidSdkDir

  $envMap = @{
    VITE_API_BASE_URL          = $Config.apiBaseUrlProd
    PLANNER_FIN_KEYSTORE_FILE  = $Config.keystoreFile
    PLANNER_FIN_KEY_ALIAS      = $Config.keyAlias
    PLANNER_FIN_KEYSTORE_PASSWORD = $Secrets.KeystorePassword
    PLANNER_FIN_KEY_PASSWORD      = $Secrets.KeyPassword
    PATH                        = (($pathAdditions + $env:PATH) -join ';')
  }

  Write-Host "Build release: VITE_API_BASE_URL=$($Config.apiBaseUrlProd) keystoreFile=$($Config.keystoreFile) keyAlias=$($Config.keyAlias)"
  Invoke-ScopedEnv $envMap {
    Push-Location $script:RepoRoot
    try {
      & pnpm android:release:build
      if ($LASTEXITCODE -ne 0) { throw 'pnpm android:release:build falhou.' }
    } finally {
      Pop-Location
    }
  }
}

function Invoke-PublishCommand {
  param([Parameter(Mandatory = $true)] $Config, [Parameter(Mandatory = $true)] $Secrets, [switch] $Confirmed)
  Assert-BucketSecretsPresent $Secrets

  $envMap = @{
    BUCKET            = $Config.bucket
    ENDPOINT          = $Config.endpoint
    REGION            = $Config.region
    ACCESS_KEY_ID     = $Secrets.RailwayBucketAccessKey
    SECRET_ACCESS_KEY = $Secrets.RailwayBucketSecretKey
  }

  $publishArgs = @('android:release:publish')
  if ($Confirmed) { $publishArgs += @('--', '--yes') }

  Invoke-ScopedEnv $envMap {
    Push-Location $script:RepoRoot
    try {
      & pnpm @publishArgs
      $script:LastPublishExit = $LASTEXITCODE
    } finally {
      Pop-Location
    }
  }
  return $script:LastPublishExit
}

function Invoke-CommitCommand {
  $info = Get-CurrentVersionInfo
  Push-Location $script:RepoRoot
  try {
    & git add $info.PackageJsonPath $info.VersionJsonPath
    & git commit -m "chore: release Android $($info.Version)"
    if ($LASTEXITCODE -ne 0) { throw 'git commit falhou.' }
  } finally {
    Pop-Location
  }
  Write-Host "Commit local criado: chore: release Android $($info.Version) (sem push)." -ForegroundColor Green
}

function Invoke-ReleaseCommand {
  $config = Get-ReleaseConfigOrTemplate
  Assert-ReleaseConfigComplete
  $secrets = Get-ResolvedSecrets
  Assert-SigningSecretsPresent $secrets

  $resumeState = Get-ReleaseResumeState
  if ($resumeState.state -eq 'blocked') {
    $files = if ($resumeState.unexpectedFiles) { $resumeState.unexpectedFiles -join ', ' } else { 'desconhecido' }
    $reasonSuffix = if ($resumeState.reason) { " ($($resumeState.reason))" } else { '' }
    throw "Repositorio nao esta limpo para release automatizada$reasonSuffix. Arquivos: $files"
  }

  $bumped = $null
  if ($resumeState.state -eq 'pending-bump') {
    Write-Host "Release pendente detectada: $($resumeState.pendingVersion) (versionCode $($resumeState.pendingVersionCode)), a partir de $($resumeState.baseVersion) (versionCode $($resumeState.baseVersionCode))." -ForegroundColor Yellow
    if (Confirm-YesNo 'Retomar essa release sem novo bump?' -DefaultYes) {
      $bumped = [pscustomobject]@{ Version = $resumeState.pendingVersion; VersionCode = $resumeState.pendingVersionCode }
      Write-Host "Retomando release $($bumped.Version) (versionCode $($bumped.VersionCode)) sem alterar os arquivos de bump."
    } elseif (Confirm-YesNo "Descartar o bump pendente ($($resumeState.pendingVersion)) e calcular um novo a partir de $($resumeState.baseVersion)?") {
      Push-Location $script:RepoRoot
      try {
        & git checkout -- 'apps/web/package.json' 'apps/web/android/version.json'
        if ($LASTEXITCODE -ne 0) { throw 'git checkout -- falhou ao descartar o bump pendente.' }
      } finally {
        Pop-Location
      }
      $bumped = Invoke-VersionBumpPrompt -Current (Get-CurrentVersionInfo)
    } else {
      Write-Host 'Cancelado. Nenhuma alteracao foi feita.'
      return
    }
  } else {
    $bumped = Invoke-VersionBumpPrompt -Current (Get-CurrentVersionInfo)
  }
  if ($null -eq $bumped) { return }
  $newVersion = $bumped.Version
  $newVersionCode = $bumped.VersionCode

  Invoke-BuildCommand -Config $config -Secrets $secrets

  $artifactDir = Join-Path $script:RepoRoot "artifacts\android-releases\$newVersion"
  $apkPath = Join-Path $artifactDir "planner-fin-$newVersion.apk"
  if (-not (Test-Path $apkPath)) { throw "Artefato esperado nao encontrado: $apkPath" }
  Write-Host "Artefato gerado: $apkPath" -ForegroundColor Green

  $adb = Join-Path (Join-Path $config.androidSdkDir 'platform-tools') 'adb.exe'
  if (Test-Path $adb) {
    $deviceCount = Get-ConnectedAdbDeviceCount -Lines ((& $adb devices) 2>$null)
    if ($deviceCount -gt 0 -and (Confirm-YesNo "Instalar $newVersion no dispositivo conectado via adb install -r?")) {
      & $adb install -r $apkPath
      if ($LASTEXITCODE -ne 0) { Write-Host 'adb install -r falhou - release local permanece intacta.' -ForegroundColor Yellow }
      else { Write-Host 'Instalado no dispositivo.' -ForegroundColor Green }
    }
  }

  if (-not (Confirm-YesNo 'Deseja publicar esta release agora no Railway Bucket?')) {
    Write-Host 'Publicacao adiada. Bump de versao permanece nos arquivos (nao commitado).'
    OfferCommit -Version $newVersion
    return
  }

  Assert-BucketSecretsPresent $secrets
  Write-Host ''
  Write-Host '--- Dry-run de publicacao ---'
  Invoke-PublishCommand -Config $config -Secrets $secrets | Out-Null

  Write-Host ''
  Write-Host "Resumo final: versao=$newVersion versionCode=$newVersionCode bucket=$($config.bucket) endpoint=$($config.endpoint) apiBaseUrl=$($config.apiBaseUrlProd)"
  Write-Host 'Publicacao no bucket e imutavel: uma vez publicada, esta versao nao pode ser sobrescrita.' -ForegroundColor Yellow
  $confirmation = Read-Host 'Digite exatamente PUBLICAR para confirmar a publicacao real'
  if ($confirmation -cne 'PUBLICAR') {
    Write-Host 'Publicacao cancelada pelo usuario.'
    OfferCommit -Version $newVersion
    return
  }

  $exitCode = Invoke-PublishCommand -Config $config -Secrets $secrets -Confirmed
  if ($exitCode -ne 0) { throw 'pnpm android:release:publish -- --yes falhou.' }

  if ($config.apiBaseUrlProd) {
    try {
      $latestUrl = "$($config.apiBaseUrlProd.TrimEnd('/'))/releases/android/latest"
      $response = Invoke-WebRequest -Uri $latestUrl -MaximumRedirection 0 -ErrorAction Stop
      Write-DoctorLine 'OK' "$latestUrl respondeu $($response.StatusCode)."
    } catch {
      $statusCode = $_.Exception.Response.StatusCode.value__
      if ($statusCode -eq 302) { Write-DoctorLine 'OK' "$latestUrl respondeu 302 (redirect para o APK)." }
      else { Write-DoctorLine 'WARN' "Nao foi possivel confirmar $latestUrl automaticamente ($($_.Exception.Message)). Verifique manualmente." }
    }
  }

  Write-Host ''
  Write-Host "Release Android $newVersion publicada. APK local: $apkPath" -ForegroundColor Green
  OfferCommit -Version $newVersion
}

function OfferCommit {
  param([Parameter(Mandatory = $true)][string] $Version)
  if (Confirm-YesNo "Criar commit local 'chore: release Android $Version' (sem push)?") {
    Invoke-CommitCommand
  } else {
    Write-Host 'Bump de versao deixado sem commit - crie manualmente quando quiser.'
  }
}
