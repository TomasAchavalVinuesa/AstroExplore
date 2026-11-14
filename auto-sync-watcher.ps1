# auto-sync-watcher.ps1
# Monitor en segundo plano que detecta cambios y los sube automáticamente a GitHub

param(
    [int]$IntervaloSegundos = 10,
    [int]$DebounceSegundos = 5,
    [switch]$Notificaciones = $true
)

$repoPath = $PSScriptRoot
Set-Location -LiteralPath $repoPath

# Guardar PID actual
$pidPath = Join-Path $repoPath ".auto-sync.pid"
$PID | Out-File -FilePath $pidPath -Encoding ascii -Force

$logPath = Join-Path $repoPath "auto-sync.log"

function Escribir-Log([string]$mensaje) {
    $fecha = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $linea = "[$fecha] $mensaje"
    Write-Host $linea
    Add-Content -Path $logPath -Value $linea -Encoding utf8
}

function Mostrar-Notificacion([string]$titulo, [string]$texto) {
    try {
        Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
        $notify = New-Object System.Windows.Forms.NotifyIcon
        $notify.Icon = [System.Drawing.SystemIcons]::Information
        $notify.BalloonTipTitle = $titulo
        $notify.BalloonTipText = $texto
        $notify.Visible = $true
        $notify.ShowBalloonTip(3000)
        Start-Sleep -Milliseconds 500
        $notify.Dispose()
    } catch {
        # Ignorar si no se puede mostrar interfaz gráfica
    }
}

# Configurar ruta a Git
$gitCmd = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitCmd) {
    $desktopGit = Get-Item "$env:LOCALAPPDATA\GitHubDesktop\app-*\resources\app\git\cmd\git.exe" -ErrorAction SilentlyContinue | Select-Object -Last 1
    if ($desktopGit) {
        $gitDir = Split-Path $desktopGit.FullName
        $binDir = Join-Path (Split-Path $gitDir) "mingw64\bin"
        $env:PATH = "$gitDir;$binDir;$env:PATH"
    }
}

Escribir-Log "Iniciando monitor automático de cambios (PID: $PID)..."
Escribir-Log "Repositorio: $repoPath"
Escribir-Log "Intervalo de comprobación: $IntervaloSegundos s"

try {
    while ($true) {
        Start-Sleep -Seconds $IntervaloSegundos

        # Revisar cambios con git status
        $statusLines = @(git status --porcelain 2>$null)
        if ($statusLines.Count -gt 0) {
            Escribir-Log "Cambios detectados ($($statusLines.Count) elementos). Esperando $DebounceSegundos s para estabilizar..."
            Start-Sleep -Seconds $DebounceSegundos

            # Re-comprobar tras debounce
            $statusLines = @(git status --porcelain 2>$null)
            if ($statusLines.Count -eq 0) {
                continue
            }

            # Extraer nombres de archivos modificados
            $fileNames = @()
            foreach ($line in $statusLines) {
                if ($line.Length -gt 3) {
                    $fileNames += Split-Path ($line.Substring(3).Trim()) -Leaf
                }
            }

            $resumenArchivos = ($fileNames | Select-Object -Unique -First 3) -join ", "
            if ($fileNames.Count -gt 3) {
                $resumenArchivos += " (+ $($fileNames.Count - 3) más)"
            }

            $fechaMsg = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
            $commitMsg = "auto: cambios en $resumenArchivos ($fechaMsg)"

            Escribir-Log "Ejecutando auto-commit-push: '$commitMsg'..."

            # Ejecutar script auto-commit-push.ps1
            $pushScript = Join-Path $repoPath "auto-commit-push.ps1"
            $output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $pushScript -Mensaje $commitMsg 2>&1

            $exito = $LASTEXITCODE -eq 0
            if ($exito) {
                Escribir-Log "[ÉXITO] Cambios subidos a GitHub correctamente: $resumenArchivos"
                if ($Notificaciones) {
                    Mostrar-Notificacion "NASA SAC 2026 - GitHub Sync" "Cambios subidos a GitHub: $resumenArchivos"
                }
            } else {
                Escribir-Log "[ERROR] Falló la subida a GitHub. Detalles: $output"
            }
        }
    }
} finally {
    Escribir-Log "Monitor automático detenido."
    if (Test-Path $pidPath) {
        Remove-Item $pidPath -Force -ErrorAction SilentlyContinue
    }
}
