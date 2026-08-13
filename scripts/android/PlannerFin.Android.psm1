Set-StrictMode -Version Latest

$script:RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$script:RuntimeDir = Join-Path $script:RepoRoot '.tools\runtime'
$script:PidFile = Join-Path $script:RuntimeDir 'android-dev-processes.json'
$script:LogDir = Join-Path $script:RuntimeDir 'logs'

function Initialize-PlannerFinRuntime {
  New-Item -ItemType Directory -Force -Path $script:RuntimeDir, $script:LogDir | Out-Null
}

function Import-PlannerFinDotEnv {
  $path = Join-Path $script:RepoRoot '.env'
  if (-not (Test-Path $path)) { return }
  Get-Content $path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#') -or -not $line.Contains('=')) { return }
    $name, $value = $line.Split('=', 2)
    $name = $name.Trim()
    $value = $value.Trim().Trim('"').Trim("'")
    if ($name -and -not [Environment]::GetEnvironmentVariable($name, 'Process')) {
      [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
  }
}

function Assert-Node22 {
  $versionText = (& node -v) 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $versionText) { throw 'Node 22+ nao encontrado no PATH.' }
  $major = [int]($versionText.TrimStart('v').Split('.')[0])
  if ($major -lt 22) { throw "Node 22+ exigido. Versao encontrada: $versionText" }
}

function Wait-DockerInfo {
  param([int] $TimeoutSeconds = 90)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    & docker info *> $null
    if ($LASTEXITCODE -eq 0) { return }
    Start-Sleep -Seconds 3
  }
  throw 'Docker engine nao respondeu a docker info dentro do tempo limite.'
}

function Ensure-DockerEngine {
  & docker info *> $null
  if ($LASTEXITCODE -eq 0) { return }
  $dockerDesktop = @(
    "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
    "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe",
    "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
  ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  if ($dockerDesktop) {
    Start-Process -FilePath $dockerDesktop -WindowStyle Hidden
  } else {
    throw 'Docker Desktop fechado ou docker indisponivel. Abra o Docker Desktop e tente novamente.'
  }
  Wait-DockerInfo
}

function Invoke-RepoCommand {
  param([Parameter(Mandatory=$true)][string] $Command)
  Push-Location $script:RepoRoot
  try {
    powershell -NoProfile -ExecutionPolicy Bypass -Command $Command
    if ($LASTEXITCODE -ne 0) { throw "Comando falhou: $Command" }
  } finally {
    Pop-Location
  }
}

function Get-ManagedProcesses {
  if (-not (Test-Path $script:PidFile)) { return @() }
  $content = Get-Content $script:PidFile -Raw
  if (-not $content.Trim()) { return @() }
  $items = $content | ConvertFrom-Json
  if ($null -eq $items) { return @() }
  if ($items -is [array]) { return $items }
  return @($items)
}

function Save-ManagedProcesses {
  param([array] $Processes)
  Initialize-PlannerFinRuntime
  $Processes | ConvertTo-Json -Depth 5 | Set-Content -Path $script:PidFile
}

function Test-ProcessAlive {
  param([int] $ProcessId)
  return $null -ne (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)
}

function Stop-RegisteredProcessTree {
  param([int] $ProcessId)
  $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue
  foreach ($child in @($children)) {
    Stop-RegisteredProcessTree -ProcessId ([int]$child.ProcessId)
  }
  $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if ($process) {
    Stop-Process -Id $ProcessId -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    if (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue) {
      Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
    }
  }
}

function Get-PortOwner {
  param([int] $Port)
  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $connection) { return $null }
  return [int]$connection.OwningProcess
}

function Get-PortListener {
  param([int] $Port)
  return Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
}

function Test-LoopbackListener {
  param([object] $Listener)
  if (-not $Listener) { return $false }
  return @('127.0.0.1', '::1', 'localhost') -contains [string]$Listener.LocalAddress
}

function Test-PlannerFinProcess {
  param(
    [int] $ProcessId,
    [string] $Name
  )
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
  if (-not $process -or -not $process.CommandLine) { return $false }
  $commandLine = [string]$process.CommandLine
  $repo = [regex]::Escape([string]$script:RepoRoot)
  if ($Name -eq 'api') {
    return $commandLine -match $repo -and $commandLine -match 'apps\\api|@planner-fin/api|dist\\main'
  }
  if ($Name -eq 'https-proxy') {
    return $commandLine -match $repo -and $commandLine -match 'https-proxy'
  }
  return $commandLine -match $repo
}

function Start-ManagedPlannerFinProcess {
  param(
    [Parameter(Mandatory=$true)][string] $Name,
    [Parameter(Mandatory=$true)][int] $Port,
    [Parameter(Mandatory=$true)][string] $Command
  )
  Initialize-PlannerFinRuntime
  $registered = @(Get-ManagedProcesses)
  $existing = $registered | Where-Object { $_.name -eq $Name -and $_.port -eq $Port -and (Test-ProcessAlive ([int]$_.pid)) } | Select-Object -First 1
  if ($existing) { return $existing }

  $listener = Get-PortListener $Port
  $owner = if ($listener) { [int]$listener.OwningProcess } else { $null }
  if ($owner) {
    $known = $registered | Where-Object { [int]$_.pid -eq $owner } | Select-Object -First 1
    if ($known -and (Test-ProcessAlive $owner)) { return $known }
    if (Test-PlannerFinProcess -ProcessId $owner -Name $Name) {
      if ($Name -eq 'api' -and -not (Test-LoopbackListener $listener)) {
        throw "Porta $Port ja tem API PlannerFin no PID $owner, mas nao esta restrita a 127.0.0.1/::1. Pare esse processo antes de usar o tooling Android."
      }
      return [pscustomobject]@{
        name = $Name
        pid = $owner
        port = $Port
        command = 'processo PlannerFin existente reutilizado'
        startedAt = $null
        stdout = $null
        stderr = $null
        external = $true
      }
    }
    throw "Porta $Port ocupada por processo desconhecido PID $owner. Encerre esse processo ou altere a porta antes de continuar."
  }

  $stdout = Join-Path $script:LogDir "$Name.out.log"
  $stderr = Join-Path $script:LogDir "$Name.err.log"
  $process = Start-Process -FilePath 'powershell' -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-Command',
    "Set-Location '$script:RepoRoot'; $Command"
  ) -RedirectStandardOutput $stdout -RedirectStandardError $stderr -WindowStyle Hidden -PassThru

  $entry = [pscustomobject]@{
    name = $Name
    pid = $process.Id
    port = $Port
    command = $Command
    startedAt = (Get-Date).ToString('o')
    stdout = $stdout
    stderr = $stderr
  }
  Save-ManagedProcesses @($registered + $entry)
  return $entry
}

function Wait-HttpHealth {
  param(
    [Parameter(Mandatory=$true)][string] $Url,
    [switch] $SkipCertificateCheck,
    [int] $TimeoutSeconds = 90
  )
  if ($SkipCertificateCheck) {
    Add-Type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public class PlannerFinCertPolicy : ICertificatePolicy {
  public bool CheckValidationResult(ServicePoint srvPoint, X509Certificate certificate, WebRequest request, int certificateProblem) { return true; }
}
"@ -ErrorAction SilentlyContinue
    [System.Net.ServicePointManager]::CertificatePolicy = New-Object PlannerFinCertPolicy
  }
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) { return }
    } catch {
      Start-Sleep -Seconds 2
    }
  }
  throw "Health check falhou: $Url"
}

function Set-AndroidToolEnvironment {
  $sdk = @(
    $env:ANDROID_HOME,
    $env:ANDROID_SDK_ROOT,
    "$env:LOCALAPPDATA\Android\Sdk"
  ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  if ($sdk) {
    $env:ANDROID_HOME = $sdk
    $env:ANDROID_SDK_ROOT = $sdk
    $platformTools = Join-Path $sdk 'platform-tools'
    $emulator = Join-Path $sdk 'emulator'
    $env:PATH = "$platformTools;$emulator;$env:PATH"
  }

  $jdk = @(
    $env:JAVA_HOME,
    "$env:ProgramFiles\Android\Android Studio\jbr",
    "$env:ProgramFiles\Eclipse Adoptium\jdk-21.0.2.13-hotspot"
  ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  if ($jdk) {
    $env:JAVA_HOME = $jdk
    $env:PATH = "$jdk\bin;$env:PATH"
  }
}

function Get-LanIPv4 {
  param([string] $Override)
  $args = @('scripts/android/dx-cli.mjs', 'lan-ip')
  if ($Override) { $args += $Override }
  $ip = (& node $args).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $ip) { throw 'Nao foi possivel detectar IP LAN.' }
  return $ip
}

function Test-CertificateCoversHost {
  param(
    [Parameter(Mandatory=$true)][string] $HostName,
    [string] $CertPath = (Join-Path $script:RepoRoot '.tools\certs\planner-fin-local.pem')
  )
  if (-not (Test-Path $CertPath)) { return $false }
  $cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($CertPath)
  foreach ($extension in $cert.Extensions) {
    if ($extension.Oid.Value -eq '2.5.29.17') {
      $san = $extension.Format($false)
      return $san -match [regex]::Escape($HostName)
    }
  }
  return $cert.Subject -match [regex]::Escape("CN=$HostName")
}

function Start-AvdIfNeeded {
  param([string] $AvdName = 'Pixel_7_Pro')
  $devices = (& adb devices) 2>$null
  if ($LASTEXITCODE -eq 0 -and ($devices -match '^emulator-\d+\s+device')) { return }
  $emulator = Get-Command emulator -ErrorAction SilentlyContinue
  if (-not $emulator) { throw 'emulator.exe nao encontrado. Instale/aponte ANDROID_HOME para o Android SDK.' }
  Start-Process -FilePath $emulator.Source -ArgumentList @('-avd', $AvdName) -WindowStyle Hidden | Out-Null
}

function Wait-AndroidBoot {
  param([int] $TimeoutSeconds = 180)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $value = (& adb shell getprop sys.boot_completed) 2>$null
    if ($LASTEXITCODE -eq 0 -and $value.Trim() -eq '1') { return }
    Start-Sleep -Seconds 3
  }
  throw 'Emulador Android nao concluiu boot dentro do tempo limite.'
}

Export-ModuleMember -Function *
