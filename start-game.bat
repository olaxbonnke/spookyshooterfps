@echo off
cd /d "%~dp0"
echo ========================================================
echo   Starting Spooky Labyrinth FPS (Modern Edition)
echo ========================================================
echo.
echo Installing dependencies...
call npm install
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] npm install encountered an error.
    pause
    exit /b %ERRORLEVEL%
)
echo.
echo Launching local game server on http://localhost:8080 ...
echo.
call npm run dev
pause
