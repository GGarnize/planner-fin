# Armazenamento local de segredos do PlannerFin, protegido por DPAPI (CurrentUser).
#
# Historico: a primeira versao deste arquivo usava CredWriteW (Windows Credential Manager)
# via P/Invoke. Diagnostico reproduzivel (scripts/android/windows-credentials.selftest.ps1)
# mostrou que CredWriteW falha deterministicamente com ERROR_NOT_ENOUGH_MEMORY (Win32 8)
# para blobs acima de ~120 caracteres neste ambiente, independente da tecnica de marshaling
# usada (AllocHGlobal ou byte[] pinado) - ou seja, nao e um bug do nosso P/Invoke, e sim
# CredWriteW nao confiavel aqui para segredos do tamanho real de uma Railway access key.
# Por isso os segredos agora sao gravados em C:\Users\<usuario>\.planner-fin\secrets.dat,
# cada valor individualmente cifrado com
# System.Security.Cryptography.ProtectedData (DataProtectionScope.CurrentUser) - o arquivo
# nunca contem texto plano, so ciphertext base64, e so pode ser decifrado pelo mesmo usuario
# Windows que o gravou. CredReadW/CredDeleteW sao mantidos apenas para migrar em silencio
# (sem exibir o valor) qualquer segredo que tenha sido gravado com sucesso pela versao
# anterior (ex: senhas curtas, que ficavam abaixo do limite que quebra CredWriteW).

Set-StrictMode -Version Latest

Add-Type -AssemblyName System.Security

$script:PlannerFinSecretsPath = Join-Path $env:USERPROFILE '.planner-fin\secrets.dat'

if (-not ([System.Management.Automation.PSTypeName]'PlannerFinLegacyCredentialManager').Type) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;

// So leitura/remocao - nunca mais grava. Existe apenas para migrar em silencio segredos
// que uma versao anterior desta automacao conseguiu gravar no Windows Credential Manager
// antes do bug de CredWriteW ser identificado.
public static class PlannerFinLegacyCredentialManager
{
    private const int CRED_TYPE_GENERIC = 1;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct CREDENTIAL
    {
        public int Flags;
        public int Type;
        public string TargetName;
        public string Comment;
        public long LastWritten;
        public int CredentialBlobSize;
        public IntPtr CredentialBlob;
        public int Persist;
        public int AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CredReadW(string target, int type, int reservedFlag, out IntPtr credentialPtr);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool CredFree(IntPtr cred);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CredDeleteW(string target, int type, int flags);

    public static string ReadSecret(string target)
    {
        IntPtr credPtr;
        if (!CredReadW(target, CRED_TYPE_GENERIC, 0, out credPtr))
        {
            return null;
        }
        try
        {
            CREDENTIAL cred = (CREDENTIAL)Marshal.PtrToStructure(credPtr, typeof(CREDENTIAL));
            if (cred.CredentialBlobSize <= 0 || cred.CredentialBlob == IntPtr.Zero) return string.Empty;
            byte[] blob = new byte[cred.CredentialBlobSize];
            Marshal.Copy(cred.CredentialBlob, blob, 0, cred.CredentialBlobSize);
            return Encoding.Unicode.GetString(blob);
        }
        finally
        {
            CredFree(credPtr);
        }
    }

    public static bool DeleteSecret(string target)
    {
        return CredDeleteW(target, CRED_TYPE_GENERIC, 0);
    }
}
'@
}

function Read-PlannerFinLegacyCredential {
  <# So leitura, nunca grava. Usada apenas para migracao silenciosa (ver cabecalho). #>
  param([Parameter(Mandatory = $true)][string] $Name)
  try {
    return [PlannerFinLegacyCredentialManager]::ReadSecret($Name)
  } catch {
    return $null
  }
}

function Remove-PlannerFinLegacyCredential {
  param([Parameter(Mandatory = $true)][string] $Name)
  try { [PlannerFinLegacyCredentialManager]::DeleteSecret($Name) | Out-Null } catch {}
}

function Read-PlannerFinSecretsFile {
  <# Retorna um hashtable { target -> ciphertext base64 }. Nunca contem texto plano. #>
  if (-not (Test-Path $script:PlannerFinSecretsPath)) { return @{} }
  $raw = Get-Content -Path $script:PlannerFinSecretsPath -Raw
  if ([string]::IsNullOrWhiteSpace($raw)) { return @{} }
  $parsed = $raw | ConvertFrom-Json
  $hash = @{}
  if ($parsed) {
    foreach ($prop in $parsed.PSObject.Properties) { $hash[$prop.Name] = [string]$prop.Value }
  }
  return $hash
}

function Save-PlannerFinSecretsFile {
  <# Escrita atomica: grava num arquivo temporario e so entao move por cima do definitivo,
     para nunca deixar secrets.dat truncado/corrompido no meio de uma gravacao. #>
  param([Parameter(Mandatory = $true)][hashtable] $Secrets)
  $dir = Split-Path -Parent $script:PlannerFinSecretsPath
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $ordered = [ordered]@{}
  foreach ($key in ($Secrets.Keys | Sort-Object)) { $ordered[$key] = $Secrets[$key] }
  $json = if ($ordered.Count -eq 0) { '{}' } else { $ordered | ConvertTo-Json -Depth 3 }
  $tempPath = "$script:PlannerFinSecretsPath.tmp"
  [System.IO.File]::WriteAllText($tempPath, $json, (New-Object System.Text.UTF8Encoding($false)))
  Move-Item -Path $tempPath -Destination $script:PlannerFinSecretsPath -Force
}

function Protect-PlannerFinBytes {
  param([Parameter(Mandatory = $true)][byte[]] $PlainBytes)
  $cipherBytes = [System.Security.Cryptography.ProtectedData]::Protect(
    $PlainBytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
  return [Convert]::ToBase64String($cipherBytes)
}

function Unprotect-PlannerFinBytes {
  param([Parameter(Mandatory = $true)][string] $CipherBase64)
  $cipherBytes = [Convert]::FromBase64String($CipherBase64)
  return [System.Security.Cryptography.ProtectedData]::Unprotect(
    $cipherBytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
}

function Set-PlannerFinCredential {
  <#
    Grava um segredo em secrets.dat, cifrado com DPAPI (CurrentUser) - nunca em texto
    plano, nunca no Credential Manager (ver cabecalho do arquivo). Recebe SecureString
    (nunca string em texto plano no argumento) para nao aparecer em historico de linha de
    comando nem em logs de auditoria do processo.
  #>
  param(
    [Parameter(Mandatory = $true)][string] $Name,
    [Parameter(Mandatory = $true)][System.Security.SecureString] $SecureValue
  )
  $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  $cipherB64 = $null
  try {
    $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    $plainBytes = [System.Text.Encoding]::UTF8.GetBytes($plain)
    try {
      $cipherB64 = Protect-PlannerFinBytes -PlainBytes $plainBytes
    } finally {
      [Array]::Clear($plainBytes, 0, $plainBytes.Length)
    }
  } finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }

  $secrets = Read-PlannerFinSecretsFile
  $secrets[$Name] = $cipherB64
  Save-PlannerFinSecretsFile -Secrets $secrets

  # Uma credencial legada do Credential Manager (versao anterior) para este mesmo nome
  # agora esta desatualizada em relacao a secrets.dat - remove para nao divergir em silencio.
  Remove-PlannerFinLegacyCredential -Name $Name
}

function Get-PlannerFinCredential {
  <#
    Retorna o segredo em texto plano (para uso imediato como valor de env var de processo
    filho) ou $null se nao existir em nenhum backend. Nao deve ser impresso por quem chama.
    Faz migracao silenciosa: se o segredo nao estiver em secrets.dat mas existir uma
    credencial legada no Windows Credential Manager (gravada por uma versao anterior desta
    automacao), migra para secrets.dat sem exibir o valor e remove a entrada legada.
  #>
  param([Parameter(Mandatory = $true)][string] $Name)
  $secrets = Read-PlannerFinSecretsFile
  if ($secrets.ContainsKey($Name)) {
    try {
      $plainBytes = Unprotect-PlannerFinBytes -CipherBase64 $secrets[$Name]
      return [System.Text.Encoding]::UTF8.GetString($plainBytes)
    } catch {
      return $null
    }
  }

  $legacyValue = Read-PlannerFinLegacyCredential -Name $Name
  if ($null -ne $legacyValue) {
    $secureLegacy = ConvertTo-SecureString -String $legacyValue -AsPlainText -Force
    Set-PlannerFinCredential -Name $Name -SecureValue $secureLegacy
    return $legacyValue
  }
  return $null
}

function Test-PlannerFinCredential {
  param([Parameter(Mandatory = $true)][string] $Name)
  return $null -ne (Get-PlannerFinCredential -Name $Name)
}

function Remove-PlannerFinCredential {
  param([Parameter(Mandatory = $true)][string] $Name)
  $secrets = Read-PlannerFinSecretsFile
  if ($secrets.ContainsKey($Name)) {
    $secrets.Remove($Name)
    Save-PlannerFinSecretsFile -Secrets $secrets
  }
  Remove-PlannerFinLegacyCredential -Name $Name
}

function Read-PlannerFinSecureValue {
  <# Prompt interativo que nunca ecoa o valor digitado. #>
  param([Parameter(Mandatory = $true)][string] $Prompt)
  return Read-Host -Prompt $Prompt -AsSecureString
}

function Test-PlannerFinSecretsBackend {
  <#
    Diagnostico interno usado pelo "doctor": grava, le e remove um segredo sintetico com
    nome unico (nunca um dos quatro nomes reais) para confirmar que o backend de segredos
    (DPAPI + secrets.dat) esta funcional de ponta a ponta neste ambiente, sem nunca expor
    um valor real. Retorna $true/$false - nunca imprime nada.
  #>
  $target = "PlannerFin/_BackendSelfTest_$([Guid]::NewGuid().ToString('N'))"
  $probe = [Guid]::NewGuid().ToString('N')
  try {
    $secure = ConvertTo-SecureString -String $probe -AsPlainText -Force
    Set-PlannerFinCredential -Name $target -SecureValue $secure
    return (Get-PlannerFinCredential -Name $target) -ceq $probe
  } catch {
    return $false
  } finally {
    Remove-PlannerFinCredential -Name $target
  }
}
