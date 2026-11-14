$repoPath = $PSScriptRoot
$pidFile = Join-Path $repoPath ".auto-sync.pid"
$logFile = Join-Path $repoPath "auto-sync.log"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "        ESTADO DE AUTO-SYNC GITHUB        " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$activo = $false
if (Test-Path $pidFile) {
    $oldPid = Get-Content $pidFile -ErrorAction SilentlyContinue
    if ($oldPid) {
        $proc = Get-Process -Id $oldPid -ErrorAction SilentlyContinue
        if ($proc) {
            $activo = $true
            Write-Host "[ACTIVO] El monitor está ejecutándose en segundo plano (PID: $oldPid)" -ForegroundColor Green
        }
    }
}

if (-not $activo) {
    Write-Host "[INACTIVO] El monitor automático no está en ejecución." -ForegroundColor Yellow
}

if (Test-Path $logFile) {
    Write-Host "`nÚltimas líneas del registro (auto-sync.log):" -ForegroundColor Cyan
    Get-Content $logFile -Tail 10 | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
}
