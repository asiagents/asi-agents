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
  Write-Host "[AMS] weights missing — GitHub-clean trees do not ship ONNX." -ForegroundColor Yellow
  Write-Host "      1. Download Release zip / onnx assets into models/ams/"
  Write-Host "      2. Or: npm run install:ams  (Hugging Face)"
  Write-Host "      See models/ams/PLACE-WEIGHTS-HERE.md"
  exit 2
}

Write-Host ""
Write-Host "Models ready." -ForegroundColor Green
exit 0
