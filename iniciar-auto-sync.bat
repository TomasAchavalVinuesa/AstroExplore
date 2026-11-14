@echo off
cd /d "%~dp0"
wscript "%~dp0iniciar-auto-sync.vbs"
echo ==========================================
echo   MONITOR AUTOMATICO DE GITHUB INICIADO
echo ==========================================
echo [OK] Monitor automatico iniciado en segundo plano.
echo      Cada vez que guardes cambios en tus archivos,
echo      se subiran automaticamente a GitHub.
echo.
echo      Para ver el estado: ejecuta ver-estado-auto-sync.bat
echo      Para detenerlo:     ejecuta detener-auto-sync.bat
echo.
pause
