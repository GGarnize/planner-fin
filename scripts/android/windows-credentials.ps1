# Wrapper fino sobre a API nativa do Windows Credential Manager (advapi32.dll:
# CredWrite/CredRead/CredDelete) via P/Invoke. Nao depende de nenhum modulo PowerShell
# externo (ex: CredentialManager) que possa nao estar instalado. Segredos sao gravados como
# credenciais genericas (CRED_TYPE_GENERIC), persistidas por CRED_PERSIST_LOCAL_MACHINE, e
# NUNCA sao impressos no console/log por estas funcoes.

Set-StrictMode -Version Latest

if (-not ([System.Management.Automation.PSTypeName]'PlannerFinCredentialManager').Type) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class PlannerFinCredentialManager
{
    private const int CRED_TYPE_GENERIC = 1;
    private const int CRED_PERSIST_LOCAL_MACHINE = 2;

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
    private static extern bool CredWriteW(ref CREDENTIAL userCredential, uint flags);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CredReadW(string target, int type, int reservedFlag, out IntPtr credentialPtr);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool CredFree(IntPtr cred);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CredDeleteW(string target, int type, int flags);

    public static void WriteSecret(string target, string secret)
    {
        byte[] blob = Encoding.Unicode.GetBytes(secret ?? string.Empty);
        IntPtr blobPtr = Marshal.AllocHGlobal(Math.Max(blob.Length, 1));
        try
        {
            if (blob.Length > 0) Marshal.Copy(blob, 0, blobPtr, blob.Length);
            CREDENTIAL cred = new CREDENTIAL
            {
                Flags = 0,
                Type = CRED_TYPE_GENERIC,
                TargetName = target,
                Comment = "PlannerFin android-release local automation",
                CredentialBlobSize = blob.Length,
                CredentialBlob = blobPtr,
                Persist = CRED_PERSIST_LOCAL_MACHINE,
                AttributeCount = 0,
                Attributes = IntPtr.Zero,
                TargetAlias = null,
                UserName = "PlannerFin"
            };
            if (!CredWriteW(ref cred, 0))
            {
                int err = Marshal.GetLastWin32Error();
                throw new InvalidOperationException("CredWrite falhou para " + target + " (erro Win32 " + err + ").");
            }
        }
        finally
        {
            Marshal.FreeHGlobal(blobPtr);
            Array.Clear(blob, 0, blob.Length);
        }
    }

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

function Set-PlannerFinCredential {
  <#
    Grava um segredo generico no Windows Credential Manager. Recebe SecureString (nunca
    string em texto plano no argumento) para evitar aparecer em historico de linha de
    comando ou logs de auditoria do processo.
  #>
  param(
    [Parameter(Mandatory = $true)][string] $Name,
    [Parameter(Mandatory = $true)][System.Security.SecureString] $SecureValue
  )
  $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    [PlannerFinCredentialManager]::WriteSecret($Name, $plain)
  } finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function Get-PlannerFinCredential {
  <# Retorna o segredo em texto plano (para uso imediato como valor de env var de processo
     filho) ou $null se a credencial nao existir. Nao deve ser impresso por quem a chama. #>
  param([Parameter(Mandatory = $true)][string] $Name)
  return [PlannerFinCredentialManager]::ReadSecret($Name)
}

function Test-PlannerFinCredential {
  param([Parameter(Mandatory = $true)][string] $Name)
  return $null -ne (Get-PlannerFinCredential -Name $Name)
}

function Remove-PlannerFinCredential {
  param([Parameter(Mandatory = $true)][string] $Name)
  [PlannerFinCredentialManager]::DeleteSecret($Name) | Out-Null
}

function Read-PlannerFinSecureValue {
  <# Prompt interativo que nunca ecoa o valor digitado. #>
  param([Parameter(Mandatory = $true)][string] $Prompt)
  return Read-Host -Prompt $Prompt -AsSecureString
}
