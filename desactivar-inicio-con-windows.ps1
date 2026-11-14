$startupFolder = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupFolder "Nasa-SAC-AutoSync.lnk"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " DESACTIVAR INICIO AUTOMÁTICO CON WINDOWS " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

if (Test-Path $shortcutPath) {
    Remove-Item $shortcutPath -Force
    Write-Host "[OK] Inicio automático eliminado de Windows." -ForegroundColor Green
} else {
    Write-Host "[i] No estaba configurado el inicio automático con Windows." -ForegroundColor Yellow
}

# Detener el monitor actual si estuviera corriendo
$repoPath = $PSScriptRoot
$detenerScript = Join-Path $repoPath "detener-auto-sync.ps1"
if (Test-Path $detenerScript) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $detenerScript
}
