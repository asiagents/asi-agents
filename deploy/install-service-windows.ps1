# Install ASI Agents as a Windows service via NSSM (https://nssm.cc/).
# Edit $RepoRoot first. Run elevated PowerShell.
# WAIT: does not create Corp publish folders.

$ErrorActionPreference = "Stop"
$RepoRoot = "<repo>"   # change to your clone path
$Nssm = "C:\Tools\nssm\nssm.exe"  # path to nssm.exe
$ServiceName = "ASI-Agents"

if (-not (Test-Path $Nssm)) { throw "nssm.exe not found at $Nssm — install NSSM and update path." }
if (-not (Test-Path (Join-Path $RepoRoot "package.json"))) { throw "Repo not found: $RepoRoot" }

$npm = (Get-Command npm).Source
& $Nssm install $ServiceName $npm "run start"
& $Nssm set $ServiceName AppDirectory $RepoRoot
& $Nssm set $ServiceName AppEnvironmentExtra "NODE_ENV=production" "ASI_AMS_SKILL_RUN=0" "ASI_USE_POSTGRES=0"
& $Nssm set $ServiceName Start SERVICE_AUTO_START
& $Nssm start $ServiceName
Write-Host "Service $ServiceName installed. Health: http://127.0.0.1:3445/health"
