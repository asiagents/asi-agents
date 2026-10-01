# Register ASI keep-alive as a current-user Scheduled Task (no admin required).
# At logon: runs start-asi-keepalive.cmd. Does not create Corp publish folders.
# Usage: powershell -ExecutionPolicy Bypass -File .\deploy\register-keepalive-task.ps1

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$CmdPath = Join-Path $RepoRoot "start-asi-keepalive.cmd"
$TaskName = "ASI-Agents-KeepAlive"

if (-not (Test-Path $CmdPath)) { throw "Missing launcher: $CmdPath" }

$action = New-ScheduledTaskAction -Execute $CmdPath -WorkingDirectory $RepoRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit (New-TimeSpan -Days 0)  # unlimited

# Remove prior registration if present (idempotent)
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Start ASI Agents (http://127.0.0.1:3445) at user logon" `
  | Out-Null

Write-Host "Registered Scheduled Task '$TaskName' (At logon for $env:USERNAME)."
Write-Host "Manual start: $CmdPath"
Write-Host "Health: http://127.0.0.1:3445/health"
Write-Host "Remove later: Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
