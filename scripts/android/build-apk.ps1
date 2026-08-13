param(
  [ValidateSet('emulator', 'lan', 'remote')]
  [string] $Target = 'emulator',
  [string] $LanIp
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'PlannerFin.Android.psm1') -Force
Import-PlannerFinDotEnv
Set-AndroidToolEnvironment
Assert-Node22

if ($Target -eq 'lan') {
  if (-not $LanIp) { $LanIp = $env:PLANNER_FIN_LAN_IP }
  $LanIp = Get-LanIPv4 $LanIp
  if (-not (Test-CertificateCoversHost -HostName $LanIp)) {
    throw "Certificado HTTPS local nao cobre $LanIp. Reemita .tools/certs/planner-fin-local.pem com SAN para esse IP e rode novamente. O build LAN foi bloqueado para evitar APK inutilizavel."
  }
  $apiUrl = (& node scripts/android/dx-cli.mjs api-url lan $LanIp).Trim()
} elseif ($Target -eq 'remote') {
  $apiUrl = (& node scripts/android/dx-cli.mjs validate-remote).Trim()
  Write-Host 'Aviso de seguranca: modo remoto usa uma API HTTPS explicitamente configurada pelo usuario.'
  Write-Host 'Exponha somente a camada HTTPS/proxy; mantenha PostgreSQL 5432 e NestJS 3000 inacessiveis externamente.'
  Write-Host 'VPN privada e preferivel a expor diretamente o ambiente de desenvolvimento.'
} else {
  $apiUrl = (& node scripts/android/dx-cli.mjs api-url emulator).Trim()
}
if ($LASTEXITCODE -ne 0 -or -not $apiUrl) { throw 'Nao foi possivel compor VITE_API_BASE_URL.' }

$oldValue = [Environment]::GetEnvironmentVariable('VITE_API_BASE_URL', 'Process')
try {
  $env:VITE_API_BASE_URL = $apiUrl
  Invoke-RepoCommand 'pnpm --filter @planner-fin/web android:build:debug'
} finally {
  if ($null -eq $oldValue) {
    [Environment]::SetEnvironmentVariable('VITE_API_BASE_URL', $null, 'Process')
  } else {
    $env:VITE_API_BASE_URL = $oldValue
  }
}

$apk = Join-Path (Resolve-Path '.') 'apps\web\android\app\build\outputs\apk\debug\app-debug.apk'
if (-not (Test-Path $apk)) { throw "APK esperado nao encontrado: $apk" }
Write-Host "API do APK: $apiUrl"
Write-Host "APK debug: $apk"
