@echo off
cd /d "%~dp0"
start "SEV clubsite server" /min node server.mjs
timeout /t 2 /nobreak >nul
start "" "http://localhost:4173"
