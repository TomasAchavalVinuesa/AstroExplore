$repoPath = $PSScriptRoot
$pidFile = Join-Path $repoPath ".auto-sync.pid"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "     DETENER MONITOR AUTOMÁTICO GITHUB    " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

if (Test-Path $pidFile) {
    $oldPid = Get-Content $pidFile -ErrorAction SilentlyContinue
    if ($oldPid) {
        $proc = Get-Process -Id $oldPid -ErrorAction SilentlyContinue
        if ($proc) {
            Stop-Process -Id $oldPid -Force
            Write-Host "[OK] Monitor automático detenido correctamente (PID: $oldPid)." -ForegroundColor Green
        } else {
            Write-Host "[i] El proceso anterior (PID: $oldPid) ya no estaba en ejecución." -ForegroundColor Yellow
        }
    }
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
} else {
    Write-Host "[i] No hay ningún monitor automático registrado en ejecución." -ForegroundColor Yellow
}
