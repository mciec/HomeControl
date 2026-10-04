#!/usr/bin/env bash
# Production mode - builds the frontend, serves it from the backend's wwwroot,
# publishes the backend and runs it with ASPNETCORE_ENVIRONMENT=Production.
#
# Connects to MQTT as homecontrol-backend-local (override via Mqtt__ClientId) so it doesn't
# knock the deployed app (homecontrol-backend) off the broker - one connection per ClientId.
set -euo pipefail
. "$(dirname "$0")/scripts/lib/common.sh"

FRONTEND_PATH="$REPO_ROOT/HomeControlFrontEnd"
PUBLISH_PATH="$BACKEND_PATH/bin/Release/publish"

banner "HomeControl Production Mode"

info "Installing frontend dependencies..."
(cd "$FRONTEND_PATH" && npm install)
info "Building frontend for production..."
(cd "$FRONTEND_PATH" && npm run build) || die "Frontend build failed!"
ok "Frontend build completed successfully!"

info "Copying frontend build to backend..."
rm -rf "$BACKEND_PATH/wwwroot"
mkdir -p "$BACKEND_PATH/wwwroot"
cp -r "$FRONTEND_PATH/dist/." "$BACKEND_PATH/wwwroot/"
ok "Frontend files copied to backend!"

info "Publishing backend..."
(cd "$BACKEND_PATH" && dotnet publish -c Release -o "$PUBLISH_PATH") || die "Backend publish failed!"
ok "Production build completed: $PUBLISH_PATH"

# User secrets are only loaded automatically in Development, so pass them as
# environment variables (same names App Service gets as app settings).
info "Loading secrets from user secrets store..."
load_app_secrets
if [ -z "$GOOGLE_CLIENT_ID" ] || [ -z "$GOOGLE_CLIENT_SECRET" ]; then
  warn "Warning: Google secrets not found in user secrets store."
  cmd "dotnet user-secrets set \"Google:ClientId\" \"<id>\" --project HomeControlBackEnd"
  cmd "dotnet user-secrets set \"Google:ClientSecret\" \"<secret>\" --project HomeControlBackEnd"
fi
export Google__ClientId="$GOOGLE_CLIENT_ID" Google__ClientSecret="$GOOGLE_CLIENT_SECRET"
export Mqtt__Host="$MQTT_HOST" Mqtt__User="$MQTT_USER" Mqtt__Password="$MQTT_PASSWORD"
export Mqtt__ClientId="${Mqtt__ClientId:-homecontrol-backend-local}"
export ASPNETCORE_ENVIRONMENT=Production

echo
info "Starting application..."
cd "$PUBLISH_PATH"
exec dotnet HomeControlBackEnd.dll
