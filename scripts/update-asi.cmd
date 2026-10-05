@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0.."

echo.
echo  ASI Agents — update (research preview)
echo  Honest helper — not a silent auto-updater.
echo.

if defined ASI_GITHUB_RELEASES_URL (
  set "RELEASES_URL=%ASI_GITHUB_RELEASES_URL%"
) else (
  set "RELEASES_URL=https://github.com/vvarghese/asi-agents/releases"
)

echo  [1] Open GitHub Releases (notes + zip assets)
echo  [2] git pull main   (stable preview)
echo  [3] git pull updates (patch channel)
echo  [4] Rebuild after pull  (setup + build)
echo  [5] Print module-zip tip
echo  [0] Exit
echo.
set /p CHOICE=Choice [0-5]: 

if "%CHOICE%"=="1" goto OPEN_RELEASES
if "%CHOICE%"=="2" goto PULL_MAIN
if "%CHOICE%"=="3" goto PULL_UPDATES
if "%CHOICE%"=="4" goto REBUILD
if "%CHOICE%"=="5" goto MODULE_TIP
if "%CHOICE%"=="0" goto END
echo Unknown choice.
goto END

:OPEN_RELEASES
echo.
echo Opening %RELEASES_URL%
echo Override with: set ASI_GITHUB_RELEASES_URL=https://github.com/^<you^>/asi-agents/releases
start "" "%RELEASES_URL%"
goto END

:PULL_MAIN
if not exist ".git" (
  echo [!] Not a git checkout — download a new Release zip, or clone the github-clean repo.
  echo     See docs\UPDATES.md
  goto END
)
echo.
echo git fetch origin
git fetch origin
if errorlevel 1 (
  echo [!] git fetch failed — check remotes / network.
  exit /b 1
)
echo git pull origin main
git pull origin main
if errorlevel 1 (
  echo [!] git pull main failed.
  exit /b 1
)
echo.
echo Done. Optional: run choice [4] rebuild, or npm.cmd run start
goto END

:PULL_UPDATES
if not exist ".git" (
  echo [!] Not a git checkout — download a new Release zip, or clone the github-clean repo.
  echo     See docs\UPDATES.md
  goto END
)
echo.
echo git fetch origin
git fetch origin
if errorlevel 1 (
  echo [!] git fetch failed — check remotes / network.
  exit /b 1
)
echo git pull origin updates
git pull origin updates
if errorlevel 1 (
  echo [!] git pull updates failed — branch may not exist yet. Use main or a Release tag.
  exit /b 1
)
echo.
echo Done. Optional: run choice [4] rebuild, or npm.cmd run start
goto END

:REBUILD
echo.
echo npm.cmd run setup
call npm.cmd run setup
if errorlevel 1 (
  echo [!] setup failed.
  exit /b 1
)
echo npm.cmd run build
call npm.cmd run build
if errorlevel 1 (
  echo [!] build failed.
  exit /b 1
)
echo.
echo Rebuild OK. Start with start-asi.cmd or: npm.cmd run start
goto END

:MODULE_TIP
echo.
echo Module / skill patches:
echo   1. Download a module zip from GitHub Releases when published
echo   2. Unzip into modules\^<name^>\  ^(merge carefully^)
echo   3. npm.cmd run build   then restart start-asi.cmd
echo.
echo AMS weights are NOT in git — copy from the Release zip into models\ams\
echo or: npm.cmd run install:ams
echo.
echo Full notes: docs\UPDATES.md
goto END

:END
echo.
endlocal
exit /b 0
