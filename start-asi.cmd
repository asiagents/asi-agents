@echo off
REM ASI Agents — one-click Windows starter (Snapdragon X / Galaxy Book4 friendly)
setlocal EnableExtensions
cd /d "%~dp0"

title ASI Agents
echo.
echo  ========================================
echo   ASI Agents  ·  v0.1 Pre Release
echo   Port 3445  ·  http://127.0.0.1:3445
echo  ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [!] Node.js not found. Install Node 20+ ARM64 from https://nodejs.org
  echo     On Snapdragon X / Book4 prefer the win-arm64 MSI.
  pause
  exit /b 1
)

for /f "delims=" %%A in ('node -p "process.arch"') do set "ASI_ARCH=%%A"
for /f "delims=" %%V in ('node -p "process.version"') do set "ASI_NODE=%%V"
echo Node %ASI_NODE%  arch=%ASI_ARCH%

netstat -ano | findstr ":3445" | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL%==0 (
  echo ASI already listening — opening http://127.0.0.1:3445
  start "" "http://127.0.0.1:3445"
  exit /b 0
)

if not exist "node_modules\" (
  echo First run: npm install via setup...
  call npm.cmd run setup
  if errorlevel 1 (
    echo [!] setup failed
    pause
    exit /b 1
  )
)

if not exist "src\server\dist\index.js" (
  echo Building...
  call npm.cmd run build
  if errorlevel 1 (
    echo [!] build failed
    pause
    exit /b 1
  )
)

echo Starting ASI Agents...
start "" "http://127.0.0.1:3445"
call npm.cmd run start
exit /b %ERRORLEVEL%
