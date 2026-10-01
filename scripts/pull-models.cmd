@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

echo.
echo  ASI Agents — pull models
echo.

where ollama >nul 2>&1
if errorlevel 1 (
  echo [Ollama] not on PATH — install from https://ollama.com/download
  echo          Skipping Ollama pulls. Chat needs Ollama, llama.cpp, or cloud keys.
) else (
  echo [Ollama] pulling recommended tags...
  ollama pull qwen2.5:3b
  if errorlevel 1 echo [!] qwen2.5:3b pull failed — try: ollama pull qwen2.5
  ollama pull llama3.2:3b
  if errorlevel 1 echo [!] llama3.2:3b optional pull failed — continuing
)

echo.
echo [AMS] checking models\ams weights...
call npm.cmd run verify:ams
if errorlevel 1 (
  echo.
  echo [AMS] weights missing — see models\ams\PLACE-WEIGHTS-HERE.md
  echo       or: npm run install:ams
  exit /b 2
)

echo Models ready.
exit /b 0
