@echo off
echo Starting KrishiSaarthi Frontend...
cd /d "%~dp0frontend"
if not exist node_modules (
    echo Installing dependencies...
    call npm ci
    if errorlevel 1 exit /b 1
)
echo Starting React development server...
call npm start
