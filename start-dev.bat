@echo off
echo Starting WonderImport Backend (Port 4000)...
start "WonderImport Backend" cmd /k "cd /d %~dp0backend && npm run start:dev"

echo Starting WonderImport Frontend (Port 3000)...
start "WonderImport Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Waiting for servers to initialize...
timeout /t 5 /nobreak >nul

start http://localhost:3000
echo WonderImport is running!

