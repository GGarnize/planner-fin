<#
  Self-test de Invoke-CommitCommand/Test-ReleaseBumpFilesChanged (scripts/android-release.lib.ps1)
  rodando inteiramente dentro de um repositorio git TEMPORARIO e isolado, criado do zero em
  cada teste -- nunca toca no repositorio real, em version/versionCode reais, nem cria
  nenhum commit fora desse repo descartavel.

  Cobre: working tree limpo (no-op, sem excecao, sem commit novo), somente package.json
  alterado, somente version.json alterado, ambos alterados, arquivo nao relacionado
  alterado (nunca entra no commit, mesmo junto com um bump real), e uma falha real de
  `git commit` (via hook pre-commit) que deve continuar propagando erro.

  Uso:
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/android-release.commit.selftest.ps1
#>
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot 'android-release.lib.ps1')

$script:OriginalRepoRoot = $script:RepoRoot
$script:OriginalWebDir = $script:WebDir
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

function Write-Utf8NoBom {
  param([string] $Path, [string] $Content)
  [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding($false)))
}

function New-TempReleaseRepo {
  <# Cria um repo git isolado com apps/web/package.json e apps/web/android/version.json,
     e um commit baseline (HEAD limpo). user.name/user.email locais para o commit
     funcionar sem depender de config global do usuario que roda o teste. #>
  $root = Join-Path ([System.IO.Path]::GetTempPath()) "planner-fin-commit-selftest-$([Guid]::NewGuid().ToString('N'))"
  New-Item -ItemType Directory -Force -Path (Join-Path $root 'apps\web\android') | Out-Null
  Write-Utf8NoBom (Join-Path $root 'apps\web\package.json') "{`n  `"version`": `"0.1.0`"`n}`n"
  Write-Utf8NoBom (Join-Path $root 'apps\web\android\version.json') "{`n  `"versionCode`": 1`n}`n"

  Push-Location $root
  try {
    & git init --quiet | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'git init falhou no repo temporario de teste.' }
    & git config user.email 'selftest@plannerfin.local' | Out-Null
    & git config user.name 'PlannerFin Selftest' | Out-Null
    & git add -A | Out-Null
    & git commit --quiet -m 'baseline' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel criar o commit baseline do repo temporario de teste.' }
  } finally {
    Pop-Location
  }
  return $root
}

function Use-TempReleaseRepo {
  param([string] $Root)
  $script:RepoRoot = $Root
  $script:WebDir = Join-Path $Root 'apps\web'
}

function Remove-TempReleaseRepo {
  param([string] $Root)
  if ($Root -and (Test-Path $Root)) {
    Remove-Item -Path $Root -Recurse -Force -ErrorAction SilentlyContinue
  }
}

function Invoke-InRepoLocation {
  param([string] $Root, [scriptblock] $Body)
  Push-Location $Root
  try {
    return (& $Body)
  } finally {
    Pop-Location
  }
}

function Get-CommitCountAt {
  param([string] $Root)
  return @(Invoke-InRepoLocation -Root $Root -Body { (& git log --oneline) 2>$null }).Count
}

function Get-HeadChangedFiles {
  param([string] $Root)
  return @(Invoke-InRepoLocation -Root $Root -Body { (& git show --name-only --format='') | Where-Object { $_ } })
}

function Invoke-InTempRepo {
  param([scriptblock] $Body)
  $repo = New-TempReleaseRepo
  try {
    Use-TempReleaseRepo -Root $repo
    & $Body $repo
  } finally {
    Remove-TempReleaseRepo -Root $repo
  }
}

Write-Host 'Self-test: Invoke-CommitCommand / Test-ReleaseBumpFilesChanged (repo git temporario)'
Write-Host ''

# 1) Working tree limpo -> no-op: sem excecao, sem commit novo, sem exit not-zero.
Invoke-InTempRepo {
  param($repo)
  $before = Get-CommitCountAt -Root $repo
  $threw = $false
  try { Invoke-CommitCommand } catch { $threw = $true }
  $after = Get-CommitCountAt -Root $repo
  Assert-True (-not $threw) 'working tree limpo: Invoke-CommitCommand nao lanca excecao'
  Assert-True ($after -eq $before) 'working tree limpo: nenhum commit novo foi criado'
}

# 2) Somente package.json alterado -> cria commit so com esse arquivo.
Invoke-InTempRepo {
  param($repo)
  Write-Utf8NoBom (Join-Path $repo 'apps\web\package.json') "{`n  `"version`": `"0.1.1`"`n}`n"
  $before = Get-CommitCountAt -Root $repo
  Invoke-CommitCommand
  $after = Get-CommitCountAt -Root $repo
  $changed = @(Get-HeadChangedFiles -Root $repo)
  $message = Invoke-InRepoLocation -Root $repo -Body { & git log -1 --format='%s' }
  Assert-True ($after -eq $before + 1) 'somente package.json alterado: cria exatamente 1 commit novo'
  Assert-True ($changed.Count -eq 1 -and $changed[0] -match 'package\.json$') 'somente package.json alterado: commit contem so esse arquivo'
  Assert-True ($message -eq 'chore: release Android 0.1.1') 'somente package.json alterado: mensagem usa a nova versao'
}

# 3) Somente version.json alterado -> cria commit so com esse arquivo.
Invoke-InTempRepo {
  param($repo)
  Write-Utf8NoBom (Join-Path $repo 'apps\web\android\version.json') "{`n  `"versionCode`": 2`n}`n"
  $before = Get-CommitCountAt -Root $repo
  Invoke-CommitCommand
  $after = Get-CommitCountAt -Root $repo
  $changed = @(Get-HeadChangedFiles -Root $repo)
  Assert-True ($after -eq $before + 1) 'somente version.json alterado: cria exatamente 1 commit novo'
  Assert-True ($changed.Count -eq 1 -and $changed[0] -match 'version\.json$') 'somente version.json alterado: commit contem so esse arquivo'
}

# 4) Ambos alterados -> cria commit com os dois arquivos.
Invoke-InTempRepo {
  param($repo)
  Write-Utf8NoBom (Join-Path $repo 'apps\web\package.json') "{`n  `"version`": `"0.1.2`"`n}`n"
  Write-Utf8NoBom (Join-Path $repo 'apps\web\android\version.json') "{`n  `"versionCode`": 3`n}`n"
  $before = Get-CommitCountAt -Root $repo
  Invoke-CommitCommand
  $after = Get-CommitCountAt -Root $repo
  $changed = @(Get-HeadChangedFiles -Root $repo)
  Assert-True ($after -eq $before + 1) 'ambos alterados: cria exatamente 1 commit novo'
  Assert-True ($changed.Count -eq 2) 'ambos alterados: commit contem exatamente os 2 arquivos de bump'
}

# 5) So um arquivo NAO relacionado alterado (bump ainda limpo) -> permanece no-op, e o
#    arquivo nao relacionado nunca e tocado/commitado.
Invoke-InTempRepo {
  param($repo)
  Write-Utf8NoBom (Join-Path $repo 'apps\web\README.md') "unrelated change`n"
  $before = Get-CommitCountAt -Root $repo
  Invoke-CommitCommand
  $after = Get-CommitCountAt -Root $repo
  $stillDirty = Invoke-InRepoLocation -Root $repo -Body { & git status --porcelain }
  Assert-True ($after -eq $before) 'arquivo nao relacionado sozinho: nao cria commit (bump ainda limpo)'
  Assert-True ([bool]$stillDirty) 'arquivo nao relacionado permanece fora do commit (continua modificado no working tree)'
}

# 6) Bump real + arquivo nao relacionado juntos -> commit criado, mas contendo SO os 2
#    arquivos de bump; o arquivo nao relacionado nunca entra no commit.
Invoke-InTempRepo {
  param($repo)
  Write-Utf8NoBom (Join-Path $repo 'apps\web\package.json') "{`n  `"version`": `"0.1.1`"`n}`n"
  Write-Utf8NoBom (Join-Path $repo 'apps\web\android\version.json') "{`n  `"versionCode`": 2`n}`n"
  Write-Utf8NoBom (Join-Path $repo 'apps\web\README.md') "unrelated change`n"
  Invoke-CommitCommand
  $changed = @(Get-HeadChangedFiles -Root $repo)
  $stillDirty = Invoke-InRepoLocation -Root $repo -Body { & git status --porcelain }
  Assert-True ($changed.Count -eq 2) 'bump + arquivo nao relacionado: commit contem so os 2 arquivos de bump'
  Assert-True ([bool]$stillDirty) 'bump + arquivo nao relacionado: o nao relacionado continua fora do commit'
}

# 7) Falha real de "git commit" (hook pre-commit) -- nunca deve ser mascarada como sucesso.
Invoke-InTempRepo {
  param($repo)
  $hookPath = Join-Path $repo '.git\hooks\pre-commit'
  Write-Utf8NoBom $hookPath "#!/bin/sh`nexit 1`n"
  Write-Utf8NoBom (Join-Path $repo 'apps\web\package.json') "{`n  `"version`": `"0.1.1`"`n}`n"
  $before = Get-CommitCountAt -Root $repo
  $threw = $false
  try { Invoke-CommitCommand } catch { $threw = $true }
  $after = Get-CommitCountAt -Root $repo
  Assert-True $threw 'falha real de git commit (pre-commit hook) continua propagando excecao'
  Assert-True ($after -eq $before) 'falha real de git commit: nenhum commit foi criado'
}

$script:RepoRoot = $script:OriginalRepoRoot
$script:WebDir = $script:OriginalWebDir

Write-Host ''
if ($script:FailureCount -gt 0) {
  Write-Host "$script:FailureCount verificacao(oes) falharam." -ForegroundColor Red
  exit 1
}
Write-Host 'Todas as verificacoes passaram.' -ForegroundColor Green
