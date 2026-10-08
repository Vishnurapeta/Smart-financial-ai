# SMARTFIN AI -- Unified Automated Testing Script (PowerShell)

$ROOT_DIR = Resolve-Path (Join-Path $PSScriptRoot "..")
$ExitCode = 0

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "SMARTFIN AI -- Running Automated Test Suites" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host ">>> Running Backend Vitest Suite..." -ForegroundColor Yellow
Push-Location "$ROOT_DIR\backend"
npm run test
if ($LASTEXITCODE -ne 0) { $ExitCode = 1 }
Pop-Location

Write-Host ""
Write-Host ">>> Running ML Microservice Pytest Suite..." -ForegroundColor Yellow
Push-Location "$ROOT_DIR\ml-service"
if (Test-Path ".\.venv\Scripts\pytest.exe") {
    & ".\.venv\Scripts\pytest.exe"
    if ($LASTEXITCODE -ne 0) { $ExitCode = 1 }
} else {
    pytest
    if ($LASTEXITCODE -ne 0) { $ExitCode = 1 }
}
Pop-Location

Write-Host ""
if ($ExitCode -eq 0) {
    Write-Host "All test suites passed cleanly!" -ForegroundColor Green
} else {
    Write-Host "One or more test suites failed." -ForegroundColor Red
}

exit $ExitCode
