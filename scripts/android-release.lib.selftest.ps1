<#
  Self-test das funcoes de scripts/android-release.lib.ps1 que sao sensiveis a
  Set-StrictMode -Version Latest (a mesma configuracao usada pelo entrypoint real
  scripts/android-release.ps1). Cobre especificamente o bug reproduzido: pipelines com
  Where-Object que retornam zero ou exatamente um resultado colapsam para $null/escalar
  em vez de colecao, e ".Count" sobre isso lanca PropertyNotFoundStrict.

  So dot-source o arquivo de funcoes (nunca o entrypoint) -- nao dispara nenhum comando
  real, nao toca em release-config.json/secrets.dat/keystore, nao builda nem publica.

  Uso:
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/android-release.lib.selftest.ps1
#>
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot 'android-release.lib.ps1')

$script:FailureCount = 0

function Assert-True {
  param([bool] $Condition, [string] $Message)
  if ($Condition) {
    Write-Host "[OK  ] $Message" -ForegroundColor Green
  } else {
    Write-Host "[FAIL] $Message" -ForegroundColor Red
    $script:FailureCount++
  }
}

function Test-DoesNotThrow {
  param([scriptblock] $Block)
  try { & $Block | Out-Null; return $true } catch { return $false }
}

function Test-ThrowsMatching {
  param([scriptblock] $Block, [string] $Pattern)
  try {
    & $Block | Out-Null
    return $false
  } catch {
    return $_.Exception.Message -match $Pattern
  }
}

Write-Host 'Self-test: scripts/android-release.lib.ps1 sob Set-StrictMode -Version Latest'
Write-Host ''

# --- Assert-SigningSecretsPresent / Assert-BucketSecretsPresent -----------------------
# Bug original: com 0 ou exatamente 1 item faltando, "$missing.Count" lancava
# PropertyNotFoundStrict porque Where-Object nao retorna uma colecao nesses casos.

Assert-True (Test-DoesNotThrow { Assert-SigningSecretsPresent -Secrets @{ KeystorePassword = 'a'; KeyPassword = 'b' } }) `
  'Assert-SigningSecretsPresent: zero segredos faltando -- nao lanca excecao'

Assert-True (Test-ThrowsMatching { Assert-SigningSecretsPresent -Secrets @{ KeystorePassword = 'a'; KeyPassword = $null } } 'KeyPassword') `
  'Assert-SigningSecretsPresent: exatamente um faltando -- lanca excecao mencionando o nome'

Assert-True (Test-ThrowsMatching { Assert-SigningSecretsPresent -Secrets @{ KeystorePassword = $null; KeyPassword = $null } } 'KeystorePassword.*KeyPassword') `
  'Assert-SigningSecretsPresent: dois faltando -- lanca excecao mencionando os dois'

Assert-True (Test-DoesNotThrow { Assert-BucketSecretsPresent -Secrets @{ RailwayBucketAccessKey = 'a'; RailwayBucketSecretKey = 'b' } }) `
  'Assert-BucketSecretsPresent: zero segredos faltando -- nao lanca excecao'

Assert-True (Test-ThrowsMatching { Assert-BucketSecretsPresent -Secrets @{ RailwayBucketAccessKey = $null; RailwayBucketSecretKey = 'b' } } 'RailwayBucketAccessKey') `
  'Assert-BucketSecretsPresent: exatamente um faltando -- lanca excecao mencionando o nome'

Assert-True (Test-ThrowsMatching { Assert-BucketSecretsPresent -Secrets @{ RailwayBucketAccessKey = $null; RailwayBucketSecretKey = $null } } 'RailwayBucketAccessKey.*RailwayBucketSecretKey') `
  'Assert-BucketSecretsPresent: dois faltando -- lanca excecao mencionando os dois'

# --- Get-ConnectedAdbDeviceCount -------------------------------------------------------
# Mesma classe de bug: contagem derivada de Select-String precisa sobreviver a zero/um
# resultado sob StrictMode. Usa linhas sinteticas -- nunca chama adb.exe de verdade.

Assert-True ((Get-ConnectedAdbDeviceCount -Lines @()) -eq 0) `
  'Get-ConnectedAdbDeviceCount: nenhuma linha -- retorna 0'

Assert-True ((Get-ConnectedAdbDeviceCount -Lines @('List of devices attached', '')) -eq 0) `
  'Get-ConnectedAdbDeviceCount: saida sem nenhum device -- retorna 0'

Assert-True ((Get-ConnectedAdbDeviceCount -Lines @('List of devices attached', "ABC123`tunauthorized", '')) -eq 0) `
  'Get-ConnectedAdbDeviceCount: device "unauthorized" nao conta -- retorna 0'

Assert-True ((Get-ConnectedAdbDeviceCount -Lines @('List of devices attached', "emulator-5554`tdevice", '')) -eq 1) `
  'Get-ConnectedAdbDeviceCount: exatamente um device pronto -- retorna 1'

Assert-True ((Get-ConnectedAdbDeviceCount -Lines @('List of devices attached', "emulator-5554`tdevice", "ABC123`tdevice", '')) -eq 2) `
  'Get-ConnectedAdbDeviceCount: dois devices prontos -- retorna 2'

Write-Host ''
if ($script:FailureCount -gt 0) {
  Write-Host "$script:FailureCount verificacao(oes) falharam." -ForegroundColor Red
  exit 1
}
Write-Host 'Todas as verificacoes passaram.' -ForegroundColor Green
