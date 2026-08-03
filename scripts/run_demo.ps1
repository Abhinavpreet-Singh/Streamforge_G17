# StreamForge — one-command local demo (Windows)
# Usage: .\scripts\run_demo.ps1
# Then open http://localhost:5173

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$env:DEMO_MODE = "1"

Write-Host "==> Tip: copy .env.example to .env for persistent demo settings"
Write-Host "==> Checking Docker stack..."
docker compose up -d

Write-Host "==> Stack health..."
if (Test-Path ".venv\Scripts\python.exe") {
    .\.venv\Scripts\python.exe scripts\check_stack.py
} else {
    python scripts\check_stack.py
}

Write-Host ""
Write-Host "Start these in separate terminals:"
Write-Host "  1. Producer:  `$env:DEMO_MODE='1'; python -m src.producer.truck_producer"
Write-Host "  2. API:       `$env:DEMO_MODE='1'; uvicorn src.api.main:app --reload --port 8000"
Write-Host "  3. UI:        cd frontend; npm run dev"
Write-Host ""
Write-Host "Dashboard: http://localhost:5173"
Write-Host "Then click Start Process in the chaos panel."
