# Windows PowerShell frontend. Vite proxy reads PORT from the environment.
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
if (-not $env:PORT) { $env:PORT = "8000" }
$env:BACKEND_PORT = $env:PORT
Write-Host "Vite proxy /api -> http://127.0.0.1:$env:PORT"
npm run dev
