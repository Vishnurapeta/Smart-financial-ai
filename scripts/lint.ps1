# SMARTFIN AI -- Unified Linting Script (PowerShell)

$ROOT_DIR = Resolve-Path (Join-Path $PSScriptRoot "..")
$ExitCode = 0

Write-Host ">>> Linting Backend..." -ForegroundColor Cyan
Push-Location "$ROOT_DIR\backend"
npm run lint
if ($LASTEXITCODE -ne 0) { $ExitCode = 1 }
Pop-Location

Write-Host "`n>>> Linting Frontend..." -ForegroundColor Cyan
Push-Location "$ROOT_DIR\frontend"
npm run lint
if ($LASTEXITCODE -ne 0) { $ExitCode = 1 }
Pop-Location

Write-Host "`n>>> Checking ML Service Formatting..." -ForegroundColor Cyan
Push-Location "$ROOT_DIR\ml-service"
if (Test-Path ".venv\Scripts\flake8.exe") {
    & ".\.venv\Scripts\flake8.exe" app tests
    if ($LASTEXITCODE -ne 0) { $ExitCode = 1 }
} else {
    Write-Host "Note: Python venv not detected. Run scripts/setup-venv.ps1 to install flake8." -ForegroundColor Yellow
}
Pop-Location

if ($ExitCode -eq 0) {
    Write-Host "`nAll linters passed successfully!" -ForegroundColor Green
} else {
    Write-Host "`nOne or more linters failed." -ForegroundColor Red
}

exit $ExitCode
