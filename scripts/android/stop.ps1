$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'PlannerFin.Android.psm1') -Force
Initialize-PlannerFinRuntime

$remaining = @()
foreach ($entry in @(Get-ManagedProcesses)) {
  $processId = [int]$entry.pid
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if (-not $process) { continue }
  Write-Host "Parando $($entry.name) PID $processId..."
  Stop-RegisteredProcessTree -ProcessId $processId
}
Save-ManagedProcesses $remaining
Write-Host 'Processos PlannerFin registrados foram parados. Docker Desktop e PostgreSQL nao foram derrubados.'
