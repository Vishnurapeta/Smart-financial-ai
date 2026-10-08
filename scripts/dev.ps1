# SMARTFIN AI -- Unified Local Development Runner (PowerShell)
param (
    [string]$Service = "all" # "all", "backend", "frontend", "ml"
)

$ROOT_DIR = Resolve-Path (Join-Path $PSScriptRoot "..")

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "SMARTFIN AI -- Starting Development Services [$Service]" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

if ($Service -eq "backend" -or $Service -eq "all") {
    Write-Host "Starting Backend API (Port 5000)..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT_DIR\backend'; npm run dev"
}

if ($Service -eq "ml" -or $Service -eq "all") {
    Write-Host "Starting ML Microservice (Port 8000)..." -ForegroundColor Yellow
    $ML_CMD = "cd '$ROOT_DIR\ml-service'; if (Test-Path .venv\Scripts\Activate.ps1) { .\.venv\Scripts\Activate.ps1 }; uvicorn app.main:app --reload --port 8000"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $ML_CMD
}

if ($Service -eq "frontend" -or $Service -eq "all") {
    Write-Host "Starting Frontend Client (Port 5173)..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT_DIR\frontend'; npm run dev"
}

Write-Host "`nAll requested services launched in dedicated terminal windows." -ForegroundColor Green
Write-Host "Frontend:  http://localhost:5173" -ForegroundColor White
Write-Host "Backend:   http://localhost:5000/api/v1/health" -ForegroundColor White
Write-Host "ML Service: http://localhost:8000/health" -ForegroundColor White
