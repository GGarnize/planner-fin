<#
  Self-test das funcoes de scripts/android-release.lib.ps1 que sao sensiveis a
  Set-StrictMode -Version Latest (a mesma configuracao usada pelo entrypoint real
  scripts/android-release.ps1). Cobre dois bugs reproduzidos:
    1) pipelines com Where-Object que retornam zero ou exatamente um resultado colapsam
       para $null/escalar em vez de colecao, e ".Count" sobre isso lanca
       PropertyNotFoundStrict.
    2) Invoke-PublishCommand: stdout do processo filho escapando pelo pipeline da funcao e
       se misturando com o exit code retornado, transformando um inteiro escalar numa
       colecao e causando falso erro mesmo com exit code real 0 (testado contra um pnpm
       falso injetado via PATH, nunca o pnpm/Railway/publisher reais).

  So dot-source o arquivo de funcoes (nunca o entrypoint) -- nao dispara nenhum comando
  real, nao toca em release-config.json/secrets.dat/keystore, nao builda nem publica de
  verdade (o pnpm usado nos testes de publish e um shim falso local, nunca a rede).

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

# --- Invoke-PublishCommand -------------------------------------------------------------
# Bug original: "& pnpm @publishArgs" sem redirecionamento emitia cada linha de stdout do
# pnpm como parte do stream de saida da funcao. Ao ser capturado pelo chamador
# ($exitCode = Invoke-PublishCommand ...), essas linhas de texto ficavam presas junto com
# o LASTEXITCODE dentro de um array; "$exitCode -ne 0" filtra elemento a elemento e, como
# texto normalmente nao e igual a "0", o array resultante quase sempre ficava nao-vazio
# (portanto $true num contexto booleano) -- disparando falso erro mesmo com exit code
# real 0. Testado aqui contra um "pnpm" FALSO injetado via PATH (nunca o pnpm real, nunca
# Railway, nunca o publisher real) para poder controlar exit code e stdout de forma
# sintetica e deterministica.

function New-FakePnpmOnPath {
  <# Cria um pnpm.cmd falso num diretorio temporario: imprime 2 linhas fixas em stdout e
     termina com o exit code lido da env var PLANNERFIN_TEST_FAKE_PNPM_EXITCODE em tempo de
     execucao (permite trocar o exit code entre chamadas sem recriar o arquivo). #>
  $dir = Join-Path ([System.IO.Path]::GetTempPath()) "plannerfin-fake-pnpm-$([Guid]::NewGuid().ToString('N'))"
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $cmdPath = Join-Path $dir 'pnpm.cmd'
  Set-Content -Path $cmdPath -Encoding Ascii -Value @'
@echo off
echo Upload concluido: fake-artifact.apk (12345 bytes)
echo Verificacao remota do APK publicado: OK.
exit /b %PLANNERFIN_TEST_FAKE_PNPM_EXITCODE%
'@
  return $dir
}

function Invoke-PublishCommandAgainstFakePnpm {
  <# Roda a Invoke-PublishCommand REAL contra o pnpm falso, com um exit code escolhido, e
     captura o stdout redirecionado (stream 6 -- Write-Host escreve nesse stream desde o
     PowerShell 5) para um arquivo temporario, sem interferir no valor de retorno
     (stream 1) da funcao. #>
  param([Parameter(Mandatory = $true)][int] $FakeExitCode, [switch] $Confirmed)
  $env:PLANNERFIN_TEST_FAKE_PNPM_EXITCODE = "$FakeExitCode"
  $stdoutFile = [System.IO.Path]::GetTempFileName()
  try {
    $exitCode = Invoke-PublishCommand -Config $script:FakePublishConfig -Secrets $script:FakePublishSecrets -Confirmed:$Confirmed 6> $stdoutFile
    $stdoutText = Get-Content -Path $stdoutFile -Raw
    return [pscustomobject]@{ ExitCode = $exitCode; StdoutText = $stdoutText }
  } finally {
    Remove-Item -Path $stdoutFile -Force -ErrorAction SilentlyContinue
  }
}

$script:FakePublishConfig = [pscustomobject]@{ bucket = 'fake-bucket'; endpoint = 'https://fake.example'; region = 'fake-region' }
$script:FakePublishSecrets = @{ RailwayBucketAccessKey = 'fake-access'; RailwayBucketSecretKey = 'fake-secret' }

$script:FakePnpmDir = New-FakePnpmOnPath
$script:OriginalPathForFakePnpm = $env:PATH
$env:PATH = "$script:FakePnpmDir;$script:OriginalPathForFakePnpm"

try {
  $resultSuccess = Invoke-PublishCommandAgainstFakePnpm -FakeExitCode 0 -Confirmed
  Assert-True ($resultSuccess.ExitCode -is [int]) `
    'Invoke-PublishCommand: filho com stdout + exit 0 -- retorno e do tipo int (nao colecao)'
  Assert-True ($resultSuccess.ExitCode -eq 0) `
    'Invoke-PublishCommand: filho com stdout + exit 0 -- retorno e exatamente o inteiro 0'
  Assert-True ($resultSuccess.StdoutText -match 'Upload concluido') `
    'Invoke-PublishCommand: stdout util do pnpm continua visivel (sucesso)'

  $callerThrewOnSuccess = $false
  try { if ($resultSuccess.ExitCode -ne 0) { throw 'pnpm android:release:publish -- --yes falhou.' } } catch { $callerThrewOnSuccess = $true }
  Assert-True (-not $callerThrewOnSuccess) `
    'Invoke-PublishCommand: caller no padrao real (if $exitCode -ne 0 { throw }) nao lanca em sucesso real'

  $resultFailure = Invoke-PublishCommandAgainstFakePnpm -FakeExitCode 1 -Confirmed
  Assert-True ($resultFailure.ExitCode -is [int]) `
    'Invoke-PublishCommand: filho com stdout + exit 1 -- retorno e do tipo int (nao colecao)'
  Assert-True ($resultFailure.ExitCode -eq 1) `
    'Invoke-PublishCommand: filho com stdout + exit 1 -- retorno e exatamente o inteiro 1'
  Assert-True ($resultFailure.StdoutText -match 'Upload concluido') `
    'Invoke-PublishCommand: stdout util do pnpm continua visivel (falha)'

  $callerThrewOnFailure = $false
  try { if ($resultFailure.ExitCode -ne 0) { throw 'pnpm android:release:publish -- --yes falhou.' } } catch { $callerThrewOnFailure = $true }
  Assert-True $callerThrewOnFailure `
    'Invoke-PublishCommand: caller no padrao real (if $exitCode -ne 0 { throw }) lanca em falha real'

  # Dry-run (sem -Confirmed) termina com exit code 1 de proposito (contrato do publisher
  # real: sem --yes, imprime o plano e faz process.exitCode = 1). Uma chamada CONFIRMADA
  # seguinte, com sucesso real, nao pode herdar esse 1 residualmente.
  $dryRun = Invoke-PublishCommandAgainstFakePnpm -FakeExitCode 1
  Assert-True ($dryRun.ExitCode -eq 1) `
    'Invoke-PublishCommand: dry-run (sem -Confirmed) retorna 1 de proposito (comportamento esperado, nao e bug)'

  $confirmedAfterDryRun = Invoke-PublishCommandAgainstFakePnpm -FakeExitCode 0 -Confirmed
  Assert-True ($confirmedAfterDryRun.ExitCode -eq 0) `
    'Invoke-PublishCommand: publish confirmado logo apos dry-run nao herda o exit code 1 do dry-run (sem residuo)'
} finally {
  $env:PATH = $script:OriginalPathForFakePnpm
  Remove-Item -Path $script:FakePnpmDir -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item Env:\PLANNERFIN_TEST_FAKE_PNPM_EXITCODE -ErrorAction SilentlyContinue
}

Write-Host ''
if ($script:FailureCount -gt 0) {
  Write-Host "$script:FailureCount verificacao(oes) falharam." -ForegroundColor Red
  exit 1
}
Write-Host 'Todas as verificacoes passaram.' -ForegroundColor Green
