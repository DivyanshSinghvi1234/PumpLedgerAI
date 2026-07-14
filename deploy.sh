#!/bin/bash
# deploy.sh - Production deployment automation script for PumpLedgerAI on GCP VM

echo "========================================="
echo "   Deploying PumpLedgerAI on Cloud VM    "
echo "========================================="

# 1. Ensure Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    sudo apt-get update
    sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
    sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-compose-plugin
fi

# 2. Re-create storage invoices directory if missing
mkdir -p backend/storage/invoices

# 3. Pull latest changes (if running inside git repo)
if [ -d .git ]; then
    echo "Syncing latest codebase from GitHub..."
    git pull origin master
fi

# 4. Stop existing containers and launch new ones
echo "Rebuilding and starting Docker containers..."
docker compose down
docker compose up -d --build

echo "========================================="
echo " Deployment successful!                  "
echo " App is running on port 8080.            "
echo "========================================="
