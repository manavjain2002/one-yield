#!/bin/bash

# run-aum-update.sh
# ─────────────────────────────────────────────────────────────────────────────
# Wrapper script for daily AUM update cron job.
# ─────────────────────────────────────────────────────────────────────────────

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$( dirname "$DIR" )"

# Load NVM if present (optional, adjust as needed for your environment)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Ensure we are in the backend directory
cd "$BACKEND_DIR"

# Run the batch update
# Logs are sent to a daily log file
LOG_FILE="$BACKEND_DIR/logs/aum-update-$(date +%Y-%m-%d).log"
mkdir -p "$BACKEND_DIR/logs"

echo "--- AUM Update Started at $(date) ---" >> "$LOG_FILE"
node scripts/updateAUM.batch.js >> "$LOG_FILE" 2>&1
echo "--- AUM Update Finished at $(date) ---" >> "$LOG_FILE"
