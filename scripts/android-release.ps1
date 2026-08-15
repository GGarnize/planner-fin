<#
  Automacao local de release Android para o PlannerFin (Windows).

  Uso:
    powershell -File scripts/android-release.ps1 -Command setup
    powershell -File scripts/android-release.ps1 -Command doctor
    powershell -File scripts/android-release.ps1 -Command release
    powershell -File scripts/android-release.ps1 -Command build
    powershell -File scripts/android-release.ps1 -Command publish
    powershell -File scripts/android-release.ps1 -Command commit

  Segredos (senha da keystore, senha da key, credenciais do Railway Bucket) nunca sao
  aceitos por argumento de linha de comando nem impressos no console/log. Sao lidos via
  prompt sem eco (Read-Host -AsSecureString) e persistidos cifrados com DPAPI (CurrentUser)
  em C:\Users\<usuario>\.planner-fin\secrets.dat (ver scripts/android/windows-credentials.ps1).
  Dados nao secretos (URLs, caminhos, nomes de bucket/regiao) ficam em texto plano fora do
  repo, em C:\Users\<usuario>\.planner-fin\release-config.json.

  Nenhuma etapa aqui faz push, merge ou cria tag git.

  A logica (funcoes) mora em scripts/android-release.lib.ps1, separada deste entrypoint
  para poder ser dot-sourceada e testada em isolamento sem disparar nenhum comando real
  (ver scripts/android-release.lib.selftest.ps1).
#>
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('setup', 'doctor', 'release', 'build', 'publish', 'commit')]
  [string] $Command
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot 'android-release.lib.ps1')

# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

switch ($Command) {
  'setup' { Invoke-SetupCommand }
  'doctor' { Invoke-DoctorCommand }
  'release' { Invoke-ReleaseCommand }
  'build' {
    $config = Get-ReleaseConfigOrTemplate
    Assert-ReleaseConfigComplete
    Invoke-BuildCommand -Config $config -Secrets (Get-ResolvedSecrets)
  }
  'publish' {
    $config = Get-ReleaseConfigOrTemplate
    Assert-ReleaseConfigComplete
    $secrets = Get-ResolvedSecrets
    Write-Host '--- Dry-run de publicacao ---'
    Invoke-PublishCommand -Config $config -Secrets $secrets | Out-Null
    if (Confirm-YesNo 'Publicar de verdade agora?') {
      $confirmation = Read-Host 'Digite exatamente PUBLICAR para confirmar a publicacao real'
      if ($confirmation -ceq 'PUBLICAR') {
        $exitCode = Invoke-PublishCommand -Config $config -Secrets $secrets -Confirmed
        if ($exitCode -ne 0) { throw 'pnpm android:release:publish -- --yes falhou.' }
      } else {
        Write-Host 'Publicacao cancelada pelo usuario.'
      }
    }
  }
  'commit' { Invoke-CommitCommand }
}
