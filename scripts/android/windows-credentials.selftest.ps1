<#
  Self-test do backend local de segredos (DPAPI). So usa valores e targets SINTETICOS
  (nunca credenciais reais), nunca imprime nenhum valor de segredo, e sempre limpa os
  proprios targets de teste em `finally` (mesmo se um teste falhar no meio). Cobre:
  segredo curto, ~60 chars, ~128 chars (o cenario que quebrava CredWriteW nesta maquina -
  ver windows-credentials.ps1), o mesmo "formato" de valor de uma Railway access key real
  (mas sob um target sintetico dedicado -- NUNCA o nome real), nao apagar segredo existente
  ao gravar outro, falha fechada quando ausente, e uma verificacao real (via transcript) de
  que nenhum valor sintetico usado aparece na saida do proprio script.

  Garantia de regressao: os quatro targets REAIS usados em producao
  (PlannerFin/KeystorePassword, PlannerFin/KeyPassword,
  PlannerFin/RailwayBucketAccessKey, PlannerFin/RailwayBucketSecretKey) NUNCA sao gravados,
  removidos, ou lidos-e-restaurados por este script -- nenhuma funcao de escrita
  (Set-PlannerFinCredential/Remove-PlannerFinCredential) e chamada com nenhum desses quatro
  nomes em nenhum ponto. O script so LE (nunca decifra) o ciphertext bruto desses quatro
  targets antes e depois de todo o resto rodar, e falha se qualquer um mudar -- essa
  comparacao roda em `finally`, entao detecta uma regressao futura mesmo que um teste
  sintetico quebre no meio.

  (Uma versao anterior deste self-test escrevia temporariamente sobre o target real
  PlannerFin/RailwayBucketAccessKey, salvando/restaurando o ciphertext ao redor de um
  round-trip sintetico. Isso apagou de fato um segredo real de producao quando a
  restauracao nao rodou em `finally` e o processo foi interrompido no meio. Removido:
  nenhum teste aqui grava/remove/le-para-restaurar nenhum dos quatro targets reais.)

  Uso:
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/android/windows-credentials.selftest.ps1
#>
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot 'windows-credentials.ps1')

$script:FailureCount = 0
$script:SyntheticValues = New-Object System.Collections.Generic.List[string]

$script:RealTargets = @(
  'PlannerFin/KeystorePassword',
  'PlannerFin/KeyPassword',
  'PlannerFin/RailwayBucketAccessKey',
  'PlannerFin/RailwayBucketSecretKey'
)

function Get-RealTargetsSnapshot {
  <# So leitura do ciphertext bruto (ou $null se ausente) dos quatro targets reais --
     nunca decifra, nunca escreve. Usado so para provar, antes e depois, que nada mudou. #>
  $secrets = Read-PlannerFinSecretsFile
  $snapshot = [ordered]@{}
  foreach ($target in $script:RealTargets) {
    $snapshot[$target] = if ($secrets.ContainsKey($target)) { $secrets[$target] } else { $null }
  }
  return $snapshot
}

function Assert-True {
  param([bool] $Condition, [string] $Message)
  if ($Condition) {
    Write-Host "[OK  ] $Message" -ForegroundColor Green
  } else {
    Write-Host "[FAIL] $Message" -ForegroundColor Red
    $script:FailureCount++
  }
}

function New-SyntheticSecret {
  param([int] $Length)
  $prefix = 'tid_TEST_'
  $body = ('x' * [Math]::Max($Length - $prefix.Length, 0))
  $value = ($prefix + $body)
  if ($value.Length -gt $Length) { $value = $value.Substring(0, $Length) }
  $script:SyntheticValues.Add($value)
  return $value
}

function Test-RoundTrip {
  <# So deve ser chamada com targets sinteticos descartaveis (prefixo _SelfTest*) -- NUNCA
     com um dos quatro nomes reais. Sempre remove o target em `finally`, mesmo se a
     gravacao/leitura falhar no meio, para nao deixar lixo de teste para tras. #>
  param([string] $Target, [int] $Length, [string] $Label)
  $value = New-SyntheticSecret -Length $Length
  try {
    $secure = ConvertTo-SecureString -String $value -AsPlainText -Force
    Set-PlannerFinCredential -Name $Target -SecureValue $secure
    $readBack = Get-PlannerFinCredential -Name $Target
    Assert-True ($readBack -ceq $value) "$Label (len=$Length): valor lido bate exatamente com o gravado"
  } finally {
    Remove-PlannerFinCredential -Name $Target
  }
  Assert-True ($null -eq (Get-PlannerFinCredential -Name $Target)) "$Label (len=$Length): removido corretamente apos cleanup"
}

function Invoke-SelfTestBody {
  Write-Host 'Self-test: backend local de segredos (DPAPI) -- somente valores e targets sinteticos'
  Write-Host ''

  # 1) Tamanhos variados, incluindo o cenario que quebrava CredWriteW (>~120 chars aqui),
  #    e o mesmo "formato" de uma Railway access key real -- sempre em targets sinteticos
  #    dedicados, nunca no nome real usado em producao.
  Test-RoundTrip -Target 'PlannerFin/_SelfTestShort' -Length 14 -Label 'segredo curto'
  Test-RoundTrip -Target 'PlannerFin/_SelfTest60' -Length 60 -Label 'segredo ~60 chars'
  Test-RoundTrip -Target 'PlannerFin/_SelfTest128' -Length 128 -Label 'segredo ~128 chars'
  Test-RoundTrip -Target 'PlannerFin/_SelfTestRailwayAccessKeyShape' -Length 60 -Label 'formato de Railway access key (target sintetico dedicado)'

  # 2) Gravar um segredo novo nao apaga/altera um segredo diferente ja existente
  #    (reexecucao do setup nunca deve perder segredo silenciosamente). Ambos sinteticos;
  #    cleanup em finally para nao deixar lixo se a assercao do meio falhar.
  $existingTarget = 'PlannerFin/_SelfTestExisting'
  $unrelatedTarget = 'PlannerFin/_SelfTestUnrelated'
  try {
    $existingValue = New-SyntheticSecret -Length 24
    Set-PlannerFinCredential -Name $existingTarget -SecureValue (ConvertTo-SecureString $existingValue -AsPlainText -Force)
    $unrelatedValue = New-SyntheticSecret -Length 20
    Set-PlannerFinCredential -Name $unrelatedTarget -SecureValue (ConvertTo-SecureString $unrelatedValue -AsPlainText -Force)
    $stillThere = Get-PlannerFinCredential -Name $existingTarget
    Assert-True ($stillThere -ceq $existingValue) 'gravar um segredo novo preserva um segredo existente diferente'
  } finally {
    Remove-PlannerFinCredential -Name $existingTarget
    Remove-PlannerFinCredential -Name $unrelatedTarget
  }

  # 3) Falha fechada: segredo ausente retorna $null, nunca excecao nem valor inventado.
  Assert-True ($null -eq (Get-PlannerFinCredential -Name 'PlannerFin/_SelfTestDefinitelyMissing')) `
    'segredo ausente retorna $null (falha fechada, sem excecao)'
  Assert-True ((Test-PlannerFinCredential -Name 'PlannerFin/_SelfTestDefinitelyMissing') -eq $false) `
    'Test-PlannerFinCredential reporta ausente corretamente'

  # 4) Backend self-test embutido (o mesmo usado pelo "doctor") -- usa seu proprio target
  #    sintetico interno (PlannerFin/_BackendSelfTest_<guid>), nunca um dos quatro reais.
  Assert-True (Test-PlannerFinSecretsBackend) 'Test-PlannerFinSecretsBackend (usado pelo doctor) retorna true'
}

$script:RealTargetsSnapshotBefore = Get-RealTargetsSnapshot

$transcriptPath = Join-Path ([System.IO.Path]::GetTempPath()) "planner-fin-credtest-$([Guid]::NewGuid().ToString('N')).log"
try {
  try {
    Start-Transcript -Path $transcriptPath -Force | Out-Null
    Invoke-SelfTestBody
  } finally {
    Stop-Transcript | Out-Null
  }
} catch {
  Assert-True $false "Invoke-SelfTestBody nao deveria lancar excecao: $($_.Exception.Message)"
} finally {
  # Roda SEMPRE, mesmo se algo acima tiver lancado excecao -- e a garantia de regressao
  # central deste self-test: nenhum dos quatro targets reais pode ter mudado.
  $afterSnapshot = Get-RealTargetsSnapshot
  foreach ($target in $script:RealTargets) {
    $unchanged = $script:RealTargetsSnapshotBefore[$target] -ceq $afterSnapshot[$target]
    Assert-True $unchanged "target real '$target' permanece exatamente inalterado (ciphertext identico ou ausente em ambos) apos o self-test"
  }
}

# 5) Verificacao real (nao so revisao de codigo): nenhum valor sintetico usado no teste
# aparece na saida efetivamente impressa pelo script.
$transcriptContent = Get-Content -Path $transcriptPath -Raw
$leakedValues = @($script:SyntheticValues | Where-Object { $transcriptContent.Contains($_) })
Remove-Item -Path $transcriptPath -Force -ErrorAction SilentlyContinue
Assert-True ($leakedValues.Count -eq 0) 'nenhum valor sintetico de segredo aparece na saida impressa pelo script'

Write-Host ''
if ($script:FailureCount -gt 0) {
  Write-Host "$script:FailureCount verificacao(oes) falharam." -ForegroundColor Red
  exit 1
}
Write-Host 'Todas as verificacoes passaram.' -ForegroundColor Green
