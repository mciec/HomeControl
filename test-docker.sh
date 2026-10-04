#!/usr/bin/env bash
# Builds the HomeControl Docker image locally and runs it as "homecontrol-test"
# on http://localhost:8080 / https://localhost:8081.
set -euo pipefail
. "$(dirname "$0")/scripts/lib/common.sh"

banner "HomeControl Docker Local Test"

info "Checking Docker..."
docker version >/dev/null 2>&1 \
  || die "Docker is not running! Start Docker (or enable Docker Desktop's WSL integration; or INSTALL_DOCKER=1 ./scripts/setup-ubuntu.sh)."
ok "Docker is running"

banner "Step 1: Building Docker Image"
info "This may take several minutes..."
docker build -t homecontrol:test "$REPO_ROOT" || die "Docker build failed!"
ok "Docker image built successfully!"

banner "Step 2: Starting Container"
info "Cleaning up existing container..."
docker rm -f homecontrol-test >/dev/null 2>&1 || true

info "Loading secrets from user secrets store..."
load_app_secrets
if [ -z "$GOOGLE_CLIENT_ID" ] || [ -z "$GOOGLE_CLIENT_SECRET" ]; then
  warn "Google secrets not found in user secrets store. Please enter manually."
  prompt_value GOOGLE_CLIENT_ID "Enter Google Client ID"
  prompt_value GOOGLE_CLIENT_SECRET "Enter Google Client Secret" secret
fi

info "Starting container..."
docker run -d --name homecontrol-test \
  -p 8080:8080 -p 8081:8081 \
  -e "ASPNETCORE_ENVIRONMENT=Production" \
  -e "ASPNETCORE_URLS=http://+:8080;https://+:8081" \
  -e "ASPNETCORE_Kestrel__Certificates__Default__Password=YourSecurePassword123!" \
  -e "ASPNETCORE_Kestrel__Certificates__Default__Path=/app/aspnetapp.pfx" \
  -e "Google__ClientId=$GOOGLE_CLIENT_ID" \
  -e "Google__ClientSecret=$GOOGLE_CLIENT_SECRET" \
  -e "Mqtt__ClientId=${Mqtt__ClientId:-homecontrol-backend-docker}" \
  -e "Mqtt__Host=$MQTT_HOST" \
  -e "Mqtt__User=$MQTT_USER" \
  -e "Mqtt__Password=$MQTT_PASSWORD" \
  homecontrol:test >/dev/null || die "Failed to start container!"
ok "Container started successfully!"

info "Waiting for application to start..."
sleep 5
banner "Container Logs (last 20 lines)"
docker logs homecontrol-test --tail 20

printf '\n%sContainer is Running!%s\n' "$C_GREEN" "$C_RESET"
cmd "HTTP:  http://localhost:8080"
cmd "HTTPS: https://localhost:8081  (self-signed cert - browser warning expected)"
echo
info "For Google OAuth to work locally, make sure these redirect URIs are on your OAuth client:"
cmd "http://localhost:8080/signin-google"
cmd "https://localhost:8081/signin-google"
echo
info "Useful Commands:"
cmd "docker logs homecontrol-test -f"
cmd "docker stop homecontrol-test && docker rm homecontrol-test"
cmd "docker restart homecontrol-test"
cmd "docker exec -it homecontrol-test /bin/sh"
echo
