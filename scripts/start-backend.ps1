# Windows PowerShell launcher. Text files are UTF-8. Does not use .sh.
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
if (-not $env:PORT) { $env:PORT = "8000" }
$env:PYTHONUTF8 = "1"
Write-Host "Starting Wild-ID backend on PORT=$env:PORT (one worker = one model copy on CPU)"
Write-Host "Limits: --limit-concurrency 8 --timeout-keep-alive 5 --backlog 32"
python -m uvicorn backend.main:app --host 0.0.0.0 --port $env:PORT --workers 1 --limit-concurrency 8 --timeout-keep-alive 5 --backlog 32
