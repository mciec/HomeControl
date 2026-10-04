#!/usr/bin/env bash
# Starts the backend (Development, https profile) for a few seconds and prints
# its startup output - a quick "does it boot" check.
#   ./test-backend-startup.sh [seconds]   (default 15)
set -uo pipefail
. "$(dirname "$0")/scripts/lib/common.sh"

SECONDS_TO_RUN="${1:-15}"
cd "$BACKEND_PATH"
echo "=== BACKEND OUTPUT (${SECONDS_TO_RUN}s) ==="
ASPNETCORE_ENVIRONMENT=Development timeout --signal=INT --kill-after=5 "$SECONDS_TO_RUN" \
  dotnet run --launch-profile https 2>&1
rc=$?
echo "=== EXIT ==="
# 124 (stopped by SIGINT) / 137 (needed the SIGKILL) = still running when the
# timeout hit, i.e. it started and stayed up.
if [ "$rc" -eq 124 ] || [ "$rc" -eq 137 ]; then ok "Backend was still running after ${SECONDS_TO_RUN}s"; else err "Backend exited early with code $rc"; fi
