$repoPath = $PSScriptRoot
$vbsPath = Join-Path $repoPath "iniciar-auto-sync.vbs"
$startupFolder = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupFolder "Nasa-SAC-AutoSync.lnk"

$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = "`"$vbsPath`""
$shortcut.WorkingDirectory = $repoPath
$shortcut.Description = "Auto-Sync GitHub para NASA SAC 2026"
$shortcut.Save()

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  INICIO AUTOMÁTICO CON WINDOWS ACTIVADO  " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "[OK] Acceso directo creado en la carpeta de Inicio de Windows." -ForegroundColor Green
Write-Host "[i] El monitor de GitHub se iniciará solo cada vez que prendas o inicies sesión en tu PC." -ForegroundColor Green
Write-Host "[i] Para desactivarlo cuando quieras, ejecuta desactivar-inicio-con-windows.bat" -ForegroundColor Gray

# Iniciar el monitor ahora mismo también
Start-Process -FilePath "wscript.exe" -ArgumentList "`"$vbsPath`""
Write-Host "`n[OK] ¡Monitor automático iniciado y activo ahora mismo!" -ForegroundColor Green
