#!/usr/bin/env bash
# Development mode - runs backend (https://localhost:7000) and frontend
# (http://localhost:3000) with hot reload. Stops any previous instances first.
# Ctrl+C stops both.
#
# The backend connects to MQTT with its own ClientId (default homecontrol-backend-dev,
# override via Mqtt__ClientId): a broker allows one connection per ClientId, so reusing the
# deployed app's would knock it off the broker every time this runs.
set -euo pipefail
. "$(dirname "$0")/scripts/lib/common.sh"

# Inside a container, published ports only reach processes bound to 0.0.0.0, so use the
# https-lan launch profile and make Vite listen on all interfaces.
export Mqtt__ClientId="${Mqtt__ClientId:-homecontrol-backend-dev}"
BACKEND_PROFILE=https; VITE_ARGS=()
if [ -f /.dockerenv ]; then BACKEND_PROFILE=https-lan; VITE_ARGS=(-- --host 0.0.0.0); fi

banner "HomeControl Development Mode"

# Only match this repo's backend/Vite processes - a blanket `pkill node` would
# also kill VS Code's server and other tooling.
info "Stopping any existing instances..."
pkill -f "dotnet run --launch-profile https" 2>/dev/null || true
pkill -f "$BACKEND_PATH/bin/.*/HomeControlBackEnd" 2>/dev/null || true
pkill -f "$REPO_ROOT/HomeControlFrontEnd/node_modules/.bin/vite" 2>/dev/null || true
sleep 1

pids=()
cleanup() {
  trap - INT TERM EXIT
  echo; info "Cleaning up..."
  for pid in "${pids[@]}"; do pkill -TERM -P "$pid" 2>/dev/null || true; kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
  ok "Development environment stopped."
}
trap cleanup INT TERM EXIT

info "Starting backend on https://localhost:7000..."
(cd "$BACKEND_PATH" && ASPNETCORE_ENVIRONMENT=Development exec dotnet run --launch-profile "$BACKEND_PROFILE") &
pids+=($!)

sleep 5

info "Starting frontend on http://localhost:3000..."
(cd "$REPO_ROOT/HomeControlFrontEnd" && exec npm run dev "${VITE_ARGS[@]}") &
pids+=($!)

printf '\n%sDevelopment environment started!%s\n' "$C_GREEN" "$C_RESET"
cmd "Frontend:  http://localhost:3000"
cmd "Backend:   https://localhost:7000"
cmd "OpenAPI:   https://localhost:7000/openapi/v1.json"
info "Press Ctrl+C to stop all services"
echo

# Exit (and clean up the other one) as soon as either service stops.
wait -n
err "One or more services have stopped."
