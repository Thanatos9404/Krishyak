@echo off
echo Starting Krishyak web app (http://127.0.0.1:3000)
cd /d "%~dp0frontend"
if not exist node_modules (
    echo Installing dependencies...
    call npm ci
    if errorlevel 1 exit /b 1
)
echo Starting Next.js development server...
call npm run dev
