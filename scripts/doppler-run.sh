#!/bin/bash
# Doppler Secrets Injection script for PumpLedgerAI
# Assumes Doppler CLI is installed: https://docs.doppler.com/docs/install-cli

echo "Checking Doppler authentication status..."

if ! command -v doppler &> /dev/null; then
    echo "Error: Doppler CLI is not installed. Visit https://docs.doppler.com/docs/install-cli"
    exit 1
fi

# Verify config context
if ! doppler configs &> /dev/null; then
    echo "Doppler CLI not configured. Running setup..."
    doppler setup
else
    echo "Doppler setup verified."
fi

echo "Injecting secrets and starting development server..."

# Execute backend with Doppler injected secrets
doppler run -- uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
