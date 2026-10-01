@echo off
REM ASI Agents keep-alive launcher (no admin / no Corp publish).
REM Double-click, or register at user logon via deploy\register-keepalive-task.ps1
setlocal
cd /d "%~dp0"

set "NODE_ENV=production"
set "ASI_AMS_SKILL_RUN=0"
set "ASI_USE_POSTGRES=0"

REM Skip start if something is already listening on 3445
netstat -ano | findstr ":3445" | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL%==0 (
  echo ASI already listening on http://127.0.0.1:3445
  exit /b 0
)

echo Starting ASI Agents on http://127.0.0.1:3445 ...
call npm.cmd run start
exit /b %ERRORLEVEL%
