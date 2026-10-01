# ASI Agents — pull Ollama tags + AMS place/download hook (fail-closed)
$ErrorActionPreference = "Continue"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host ""
Write-Host " ASI Agents — pull models" -ForegroundColor Cyan
Write-Host ""

$ollama = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollama) {
  Write-Host "[Ollama] not on PATH — install from https://ollama.com/download" -ForegroundColor Yellow
  Write-Host "         Skipping Ollama pulls. Chat needs Ollama, llama.cpp, or cloud keys."
} else {
  Write-Host "[Ollama] pulling recommended tags..." -ForegroundColor Green
  & ollama pull qwen2.5:3b
  if ($LASTEXITCODE -ne 0) { Write-Host "[!] qwen2.5:3b pull failed — try: ollama pull qwen2.5" -ForegroundColor Yellow }
  & ollama pull llama3.2:3b
  if ($LASTEXITCODE -ne 0) { Write-Host "[!] llama3.2:3b optional pull failed — continuing" -ForegroundColor Yellow }
}

Write-Host ""
Write-Host "[AMS] checking models/ams weights..." -ForegroundColor Cyan
& npm.cmd run verify:ams
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "[AMS] weights missing — see models/ams/PLACE-WEIGHTS-HERE.md" -ForegroundColor Yellow
  Write-Host "      or: npm run install:ams"
  exit 2
}

Write-Host ""
Write-Host "Models ready." -ForegroundColor Green
exit 0
