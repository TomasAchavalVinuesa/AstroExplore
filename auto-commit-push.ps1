# Script de sincronización automática con GitHub
param (
    [string]$Mensaje = ""
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Sincronización Automática con GitHub" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Localizar Git
$gitCmd = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitCmd) {
    $desktopGit = Get-Item "$env:LOCALAPPDATA\GitHubDesktop\app-*\resources\app\git\cmd\git.exe" -ErrorAction SilentlyContinue | Select-Object -Last 1
    if ($desktopGit) {
        $gitDir = Split-Path $desktopGit.FullName
        $binDir = Join-Path (Split-Path $gitDir) "mingw64\bin"
        $env:PATH = "$gitDir;$binDir;$env:PATH"
    } else {
        Write-Error "No se encontró git instalado en el sistema ni en GitHub Desktop."
        exit 1
    }
}

$repoPath = $PSScriptRoot
Set-Location -LiteralPath $repoPath

# 2. Obtener Token de GitHub Desktop si es necesario
$token = $null
try {
    $code = @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class CredMgrAuto {
    [DllImport("Advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credentialPtr);

    [DllImport("Advapi32.dll", EntryPoint = "CredFree", SetLastError = true)]
    public static extern void CredFree(IntPtr credential);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL {
        public int Flags;
        public int Type;
        public string TargetName;
        public string Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public int CredentialBlobSize;
        public IntPtr CredentialBlob;
        public int Persist;
        public int AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }

    public static string GetUtf8Password(string target) {
        IntPtr credPtr;
        if (CredRead(target, 1, 0, out credPtr)) {
            try {
                CREDENTIAL cred = (CREDENTIAL)Marshal.PtrToStructure(credPtr, typeof(CREDENTIAL));
                byte[] bytes = new byte[cred.CredentialBlobSize];
                Marshal.Copy(cred.CredentialBlob, bytes, 0, cred.CredentialBlobSize);
                return Encoding.UTF8.GetString(bytes);
            } finally {
                CredFree(credPtr);
            }
        }
        return null;
    }
}
"@
    Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
    $token = [CredMgrAuto]::GetUtf8Password("GitHub - https://api.github.com/jonasvillegass")
} catch {
    # Ignorar si no se puede leer
}

# 3. Verificar estado
git status --short
$changes = git status --porcelain
if (-not $changes) {
    Write-Host "`n[i] No hay cambios nuevos en los archivos para commitear." -ForegroundColor Yellow
} else {
    Write-Host "`n[+] Agregando archivos al commit..." -ForegroundColor Green
    git add .

    if ([string]::IsNullOrWhiteSpace($Mensaje)) {
        $fecha = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        $Mensaje = "chore(sync): actualización automática - $fecha"
    }

    Write-Host "[+] Creando commit: '$Mensaje'..." -ForegroundColor Green
    git commit -m $Mensaje
}

# 4. Pushear cambios
Write-Host "`n[+] Subiendo cambios a GitHub..." -ForegroundColor Cyan
if ($token) {
    $remoteWithToken = "https://x-access-token:$token@github.com/jonasvillegass/NASA---SAC---2026.git"
    git push $remoteWithToken main
    git fetch $remoteWithToken main:refs/remotes/origin/main 2>$null
} else {
    git push origin main
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[OK] Repositorio sincronizado exitosamente con GitHub!" -ForegroundColor Green
} else {
    Write-Host "`n[X] Hubo un problema al subir a GitHub. Verifica la conexión o credenciales." -ForegroundColor Red
}
