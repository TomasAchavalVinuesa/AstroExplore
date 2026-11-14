$repoPath = $PSScriptRoot
$pidFile = Join-Path $repoPath ".auto-sync.pid"

if (Test-Path $pidFile) {
    $oldPid = Get-Content $pidFile -ErrorAction SilentlyContinue
    if ($oldPid) {
        $proc = Get-Process -Id $oldPid -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "[i] El monitor automático ya se encuentra ejecutándose en segundo plano (PID: $oldPid)." -ForegroundColor Yellow
            return
        }
    }
}

$scriptWatcher = Join-Path $repoPath "auto-sync-watcher.ps1"
$arg = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptWatcher`""

$proc = Start-Process -FilePath "powershell.exe" -ArgumentList $arg -PassThru
$proc.Id | Out-File -FilePath $pidFile -Encoding ascii -Force

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  MONITOR AUTOMÁTICO DE GITHUB INICIADO   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "[OK] Proceso activo en segundo plano (PID: $($proc.Id))" -ForegroundColor Green
Write-Host "[i] Cada vez que guardes cambios en tus archivos, se subirán automáticamente a GitHub." -ForegroundColor Green
Write-Host "[i] Registro de actividad en: auto-sync.log" -ForegroundColor Gray
Write-Host "[i] Para detenerlo, ejecuta detener-auto-sync.bat" -ForegroundColor Gray
