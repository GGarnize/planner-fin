$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'PlannerFin.Android.psm1') -Force
Assert-Node22

$apkRoot = Join-Path (Resolve-Path '.') 'apps\web\android\app\build\outputs\apk'
$apk = (& node scripts/android/dx-cli.mjs latest-apk $apkRoot).Trim()
if ($LASTEXITCODE -ne 0 -or -not $apk) { throw 'Nenhum APK debug encontrado para servir.' }
$apkItem = Get-Item $apk
$dir = $apkItem.Directory.FullName
$port = 8000
$owner = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($owner) { throw "Porta $port ja esta ocupada por PID $($owner.OwningProcess)." }

$lanIp = Get-LanIPv4 $env:PLANNER_FIN_LAN_IP
Write-Host "Servindo somente o diretorio: $dir"
Write-Host "APK: $($apkItem.Name)"
Write-Host "URL localhost: http://127.0.0.1:$port/$($apkItem.Name)"
Write-Host "URL LAN para celular: http://$lanIp`:$port/$($apkItem.Name)"
Write-Host 'Ctrl+C encerra o servidor.'

$python = Get-Command py -ErrorAction SilentlyContinue
if ($python) {
  & py -m http.server $port --bind 0.0.0.0 --directory $dir
} else {
  & python -m http.server $port --bind 0.0.0.0 --directory $dir
}
