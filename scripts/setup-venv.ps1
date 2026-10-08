# SMARTFIN AI -- Python Virtual Environment Setup Script (Windows PowerShell)

Write-Host "Setting up Python virtual environment for ml-service..." -ForegroundColor Cyan

$ML_DIR = Join-Path $PSScriptRoot "..\ml-service"
Set-Location $ML_DIR

if (-not (Test-Path ".venv")) {
    Write-Host "Creating virtual environment in .venv..." -ForegroundColor Yellow
    python -m venv .venv
}

Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& ".\.venv\Scripts\Activate.ps1"

Write-Host "Upgrading pip and installing requirements..." -ForegroundColor Yellow
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

Write-Host "ML Service setup completed successfully!" -ForegroundColor Green
