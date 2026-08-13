param(
  [switch] $SkipEmulator,
  [switch] $PhoneMode
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'PlannerFin.Android.psm1') -Force

Initialize-PlannerFinRuntime
Import-PlannerFinDotEnv
Assert-Node22
Ensure-DockerEngine
Set-AndroidToolEnvironment

$env:API_HOST = '127.0.0.1'
$env:API_PORT = '3000'
if (-not $env:API_CORS_ORIGINS) {
  $env:API_CORS_ORIGINS = 'http://localhost:9000,https://localhost'
}

Invoke-RepoCommand 'docker compose up -d postgres'
Invoke-RepoCommand 'pnpm db:migrate'

$api = Start-ManagedPlannerFinProcess -Name 'api' -Port 3000 -Command 'pnpm --filter @planner-fin/api dev'
$proxy = Start-ManagedPlannerFinProcess -Name 'https-proxy' -Port 3443 -Command 'node scripts/android/https-proxy.mjs'

Wait-HttpHealth -Url 'http://127.0.0.1:3000/api/health'
Wait-HttpHealth -Url 'https://127.0.0.1:3443/api/health' -SkipCertificateCheck

$lanIp = $null
try { $lanIp = Get-LanIPv4 $env:PLANNER_FIN_LAN_IP } catch { $lanIp = $null }

if (-not $SkipEmulator) {
  Start-AvdIfNeeded -AvdName 'Pixel_7_Pro'
  Wait-AndroidBoot
}

Write-Host ''
Write-Host 'PlannerFin local/Android pronto.'
Write-Host "API HTTP local: http://127.0.0.1:3000/api/health (PID $($api.pid))"
Write-Host "Proxy HTTPS: https://127.0.0.1:3443/api/health (PID $($proxy.pid))"
if ($lanIp) {
  Write-Host "LAN API para celular: https://$lanIp`:3443/api/health"
  if (-not (Test-CertificateCoversHost -HostName $lanIp)) {
    Write-Host "Aviso: o certificado local atual nao cobre $lanIp. Reemita o certificado antes de usar APK LAN."
  }
}
if ($SkipEmulator) {
  Write-Host 'Android virtual: nao iniciado neste comando.'
} else {
  Write-Host 'Android virtual: AVD Pixel_7_Pro iniciado ou reutilizado.'
}
Write-Host 'Logs/PIDs: .tools/runtime'
if ($PhoneMode) {
  Write-Host 'Modo celular fisico: nenhum emulador foi iniciado.'
}
