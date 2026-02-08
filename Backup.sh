#!/bin/bash
#
# Cloud Backup Script for Leaderboard
# Syncs local backups to cloud storage
#
# Usage: ./backup-sync.sh [s3|gcs|dropbox]
#

set -e

# Configuration
BACKUP_DIR="/var/lib/leaderboard/backups"
LOG_FILE="/var/log/leaderboard-backup.log"

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    log "ERROR: Backup directory $BACKUP_DIR does not exist"
    exit 1
fi

# Count backups
DB_BACKUPS=$(find "$BACKUP_DIR" -name "leaderboard-*.db" -mtime -1 | wc -l)
JSON_BACKUPS=$(find "$BACKUP_DIR" -name "authors-*.json" -mtime -1 | wc -l)

if [ "$DB_BACKUPS" -eq 0 ]; then
    log "WARNING: No recent database backups found"
fi

if [ "$JSON_BACKUPS" -eq 0 ]; then
    log "WARNING: No recent JSON backups found"
fi

# Determine backup method
METHOD=${1:-s3}

case $METHOD in
    s3)
        log "Starting S3 sync..."
        if ! command -v aws &> /dev/null; then
            log "ERROR: AWS CLI not installed"
            exit 1
        fi
        
        # Sync to S3
        aws s3 sync "$BACKUP_DIR" "s3://${S3_BUCKET:-leaderboard-backups}/backups/" \
            --storage-class STANDARD_IA \
            --exclude "*" \
            --include "*.db" \
            --include "*.json" 2>&1 | tee -a "$LOG_FILE"
        
        log "S3 sync completed"
        ;;
        
    gcs)
        log "Starting Google Cloud Storage sync..."
        if ! command -v gsutil &> /dev/null; then
            log "ERROR: gsutil not installed"
            exit 1
        fi
        
        # Sync to GCS
        gsutil -m rsync -r -d "$BACKUP_DIR" "gs://${GCS_BUCKET:-leaderboard-backups}/backups/" \
            2>&1 | tee -a "$LOG_FILE"
        
        log "GCS sync completed"
        ;;
        
    dropbox)
        log "Starting Dropbox sync..."
        DROPBOX_UPLOADER="/usr/local/bin/dropbox_uploader.sh"
        
        if [ ! -f "$DROPBOX_UPLOADER" ]; then
            log "ERROR: Dropbox uploader not found at $DROPBOX_UPLOADER"
            exit 1
        fi
        
        # Upload to Dropbox
        for file in "$BACKUP_DIR"/*.{db,json}; do
            if [ -f "$file" ]; then
                $DROPBOX_UPLOADER upload "$file" "/leaderboard-backups/" 2>&1 | tee -a "$LOG_FILE"
            fi
        done
        
        log "Dropbox sync completed"
        ;;
        
    rsync)
        log "Starting rsync to remote server..."
        if [ -z "$REMOTE_HOST" ] || [ -z "$REMOTE_PATH" ]; then
            log "ERROR: REMOTE_HOST and REMOTE_PATH must be set"
            exit 1
        fi
        
        # Rsync to remote server
        rsync -avz --delete \
            -e "ssh -i ${SSH_KEY:-$HOME/.ssh/id_rsa}" \
            "$BACKUP_DIR/" \
            "${REMOTE_USER:-backup}@${REMOTE_HOST}:${REMOTE_PATH}/" \
            2>&1 | tee -a "$LOG_FILE"
        
        log "Rsync completed"
        ;;
        
    *)
        log "ERROR: Unknown backup method: $METHOD"
        log "Usage: $0 [s3|gcs|dropbox|rsync]"
        exit 1
        ;;
esac

# Cleanup old local backups (keep last 10)
log "Cleaning up old local backups..."
ls -t "$BACKUP_DIR"/leaderboard-*.db | tail -n +11 | xargs -r rm -f
ls -t "$BACKUP_DIR"/authors-*.json | tail -n +11 | xargs -r rm -f

log "Backup sync completed successfully"

# Optional: Send notification
if command -v curl &> /dev/null && [ -n "$WEBHOOK_URL" ]; then
    curl -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{\"text\":\"Leaderboard backup completed: $DB_BACKUPS DB files, $JSON_BACKUPS JSON files\"}"
fi

exit 0