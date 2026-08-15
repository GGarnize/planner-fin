<#
  Self-test do backend local de segredos (DPAPI). So usa valores SINTETICOS (nunca
  credenciais reais), nunca imprime nenhum valor de segredo, e sempre limpa os proprios
  targets de teste no final. Cobre: segredo curto, ~60 chars, ~128 chars (o cenario que
  quebrava CredWriteW nesta maquina - ver windows-credentials.ps1), o target real usado
  pelo Railway access key (com valor sintetico, preservando qualquer segredo de producao
  ja configurado nele), nao apagar segredo existente ao gravar outro, falha fechada quando
  ausente, e uma verificacao real (via transcript) de que nenhum valor sintetico usado
  aparece na saida do proprio script.

  Uso:
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/android/windows-credentials.selftest.ps1
#>
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot 'windows-credentials.ps1')

$script:FailureCount = 0
$script:SyntheticValues = New-Object System.Collections.Generic.List[string]

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
  param([string] $Target, [int] $Length, [string] $Label)
  $value = New-SyntheticSecret -Length $Length
  $secure = ConvertTo-SecureString -String $value -AsPlainText -Force
  Set-PlannerFinCredential -Name $Target -SecureValue $secure
  $readBack = Get-PlannerFinCredential -Name $Target
  Assert-True ($readBack -ceq $value) "$Label (len=$Length): valor lido bate exatamente com o gravado"
  Remove-PlannerFinCredential -Name $Target
  Assert-True ($null -eq (Get-PlannerFinCredential -Name $Target)) "$Label (len=$Length): removido corretamente apos cleanup"
}

function Invoke-SelfTestBody {
  Write-Host 'Self-test: backend local de segredos (DPAPI) -- somente valores sinteticos'
  Write-Host ''

  # 1) Tamanhos variados, incluindo o cenario que quebrava CredWriteW (>~120 chars aqui).
  Test-RoundTrip -Target 'PlannerFin/_SelfTestShort' -Length 14 -Label 'segredo curto'
  Test-RoundTrip -Target 'PlannerFin/_SelfTest60' -Length 60 -Label 'segredo ~60 chars'
  Test-RoundTrip -Target 'PlannerFin/_SelfTest128' -Length 128 -Label 'segredo ~128 chars'

  # 2) O target exato usado pelo Railway access key -- valor SINTETICO, nunca real.
  #    Precisa preservar qualquer segredo de producao ja configurado nesse mesmo target.
  $prodTarget = 'PlannerFin/RailwayBucketAccessKey'
  $hadProdSecretBefore = Test-PlannerFinCredential -Name $prodTarget
  $prodValueBefore = if ($hadProdSecretBefore) { Get-PlannerFinCredential -Name $prodTarget } else { $null }

  Test-RoundTrip -Target $prodTarget -Length 60 -Label 'target real do Railway access key (valor sintetico)'

  $prodValueAfter = if ($hadProdSecretBefore) { Get-PlannerFinCredential -Name $prodTarget } else { $null }
  Assert-True (-not $hadProdSecretBefore -or ($prodValueBefore -ceq $prodValueAfter)) `
    'segredo de producao pre-existente no mesmo target (se houver) nao foi afetado pelo self-test'

  # 3) Gravar um segredo novo nao apaga/altera um segredo diferente ja existente
  #    (reexecucao do setup nunca deve perder segredo silenciosamente).
  $existingTarget = 'PlannerFin/_SelfTestExisting'
  $existingValue = New-SyntheticSecret -Length 24
  Set-PlannerFinCredential -Name $existingTarget -SecureValue (ConvertTo-SecureString $existingValue -AsPlainText -Force)
  $unrelatedValue = New-SyntheticSecret -Length 20
  Set-PlannerFinCredential -Name 'PlannerFin/_SelfTestUnrelated' -SecureValue (ConvertTo-SecureString $unrelatedValue -AsPlainText -Force)
  $stillThere = Get-PlannerFinCredential -Name $existingTarget
  Assert-True ($stillThere -ceq $existingValue) 'gravar um segredo novo preserva um segredo existente diferente'
  Remove-PlannerFinCredential -Name $existingTarget
  Remove-PlannerFinCredential -Name 'PlannerFin/_SelfTestUnrelated'

  # 4) Falha fechada: segredo ausente retorna $null, nunca excecao nem valor inventado.
  Assert-True ($null -eq (Get-PlannerFinCredential -Name 'PlannerFin/_SelfTestDefinitelyMissing')) `
    'segredo ausente retorna $null (falha fechada, sem excecao)'
  Assert-True ((Test-PlannerFinCredential -Name 'PlannerFin/_SelfTestDefinitelyMissing') -eq $false) `
    'Test-PlannerFinCredential reporta ausente corretamente'

  # 5) Backend self-test embutido (o mesmo usado pelo "doctor").
  Assert-True (Test-PlannerFinSecretsBackend) 'Test-PlannerFinSecretsBackend (usado pelo doctor) retorna true'
}

$transcriptPath = Join-Path ([System.IO.Path]::GetTempPath()) "planner-fin-credtest-$([Guid]::NewGuid().ToString('N')).log"
try {
  Start-Transcript -Path $transcriptPath -Force | Out-Null
  Invoke-SelfTestBody
} finally {
  Stop-Transcript | Out-Null
}

# 6) Verificacao real (nao so revisao de codigo): nenhum valor sintetico usado no teste
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
