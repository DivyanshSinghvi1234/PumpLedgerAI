# Doppler Secrets Injection script for PumpLedgerAI
# Assumes Doppler CLI is installed: https://docs.doppler.com/docs/install-cli

Write-Host "Checking Doppler authentication status..." -ForegroundColor Cyan

# Check if doppler CLI is installed
if (-not (Get-Command "doppler" -ErrorAction SilentlyContinue)) {
    Write-Error "Doppler CLI is not installed. Please download it from https://docs.doppler.com/docs/install-cli"
    exit 1
}

# Verify configuration context
try {
    $dopplerConfig = doppler configs -j | ConvertFrom-Json
    Write-Host "Doppler project connected: $($dopplerConfig.project)" -ForegroundColor Green
} catch {
    Write-Host "Doppler CLI not configured. Running setup..." -ForegroundColor Yellow
    doppler setup
}

Write-Host "Injecting secrets and starting development server..." -ForegroundColor Cyan

# Run backend uvicorn with Doppler secrets injection
# This replaces the need for local .env files containing API keys
doppler run -- uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
