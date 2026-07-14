#!/bin/bash
# backup_to_gdrive.sh - Nightly database and invoice backups to Google Drive

BACKUP_DIR="/tmp/pumpledger_backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="${BACKUP_DIR}/pumpledger_backup_${TIMESTAMP}.zip"

# Create temp backup directory
mkdir -p "${BACKUP_DIR}"

# 1. Check if rclone is installed
if ! command -v rclone &> /dev/null; then
    echo "rclone is not installed. Installing rclone..."
    sudo curl https://rclone.org/install.sh | sudo bash
fi

# 2. Archive database and uploaded invoices
echo "Creating backup archive..."
zip -r "${BACKUP_FILE}" backend/pumpledger.db backend/storage/invoices

# 3. Upload to Google Drive via rclone
# Note: Assumes a configured rclone remote named 'gdrive'
if rclone listremotes | grep -q "^gdrive:"; then
    echo "Uploading backup archive to Google Drive..."
    rclone copy "${BACKUP_FILE}" gdrive:PumpLedgerBackups
    
    # 4. Remove local backup archive to save space
    rm -f "${BACKUP_FILE}"
    echo "Backup uploaded successfully and local archive cleared."
else
    echo "ERROR: Google Drive remote 'gdrive' is not configured in rclone."
    echo "Please configure it using: rclone config"
    echo "Backup kept locally at: ${BACKUP_FILE}"
fi
