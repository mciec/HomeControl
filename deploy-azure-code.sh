#!/usr/bin/env bash
# Simplest always-on way to run HomeControl in Azure: App Service Basic B1 (~$12.40/month) with the
# code deployed straight to the built-in Linux .NET 10 runtime - no Docker image, no Azure Container
# Registry (which alone cost ~$5/month with the container setup, deploy-azure-appservice.sh).
#
# The script builds locally (frontend -> backend's wwwroot -> `dotnet publish`), zips the result and
# deploys it. It works for a new app and converts an existing container-based one in place, and it
# enables Always On: the backend keeps its MQTT subscription and SignalR connections alive 24/7.
#
#   ./deploy-azure-code.sh                                         # interactive
#   ./deploy-azure-code.sh -g homecontrol-rg -n homecontrol-app -y
#
# Tiers (--sku): B1 (default, cheapest with Always On) | B2, B3, S1, ... (more CPU/RAM).
#   F1 (Free, $0) also works but is NOT recommended: it has no Always On, so the app is unloaded after
#   ~20 min idle - the first request then cold-starts for 10-30 s and MQTT/SignalR only run while it is
#   awake - plus a 60 CPU-min/day quota. It also needs "Free VMs" quota, which some subscriptions lack.
# Secrets (Google:*, Mqtt:*) come from `dotnet user-secrets`, as for the other deploy scripts.
set -euo pipefail
. "$(dirname "$0")/scripts/lib/common.sh"

usage() {
  cat <<EOF
Usage: $0 [options]
  -g, --resource-group NAME     Azure resource group
  -l, --location NAME           Region for a NEW plan (default: westus2; an existing plan keeps its region)
      --sku NAME                App Service plan tier (default: B1 - cheapest with Always On)
  -n, --app-name NAME           Web App name (globally unique; <name>.azurewebsites.net)
      --google-client-id ID     overrides user secret Google:ClientId
      --google-client-secret S  overrides user secret Google:ClientSecret
  -y, --auto-deploy             no prompts; fail if anything is missing
  -h, --help
EOF
}

RESOURCE_GROUP="${RESOURCE_GROUP:-}"; LOCATION="${LOCATION:-westus2}"; APP_NAME="${APP_NAME:-}"; SKU="${SKU:-B1}"
AUTO_DEPLOY=0
while [ $# -gt 0 ]; do
  case "$1" in
    -g|--resource-group)     RESOURCE_GROUP="$2"; shift 2 ;;
    -l|--location)           LOCATION="$2"; shift 2 ;;
    -n|--app-name)           APP_NAME="$2"; shift 2 ;;
    --sku)                   SKU="$2"; shift 2 ;;
    --google-client-id)      GOOGLE_CLIENT_ID="$2"; shift 2 ;;
    --google-client-secret)  GOOGLE_CLIENT_SECRET="$2"; shift 2 ;;
    -y|--auto-deploy)        AUTO_DEPLOY=1; shift ;;
    -h|--help)               usage; exit 0 ;;
    *) usage >&2; die "Unknown option: $1" ;;
  esac
done

banner "Azure App Service - code deployment (no container registry)
HomeControl Application"

info "Loading secrets from user secrets store..."
load_app_secrets

if [ "$AUTO_DEPLOY" = "1" ]; then
  require_vars "RESOURCE_GROUP|--resource-group" "APP_NAME|--app-name" \
    "GOOGLE_CLIENT_ID|Google:ClientId (user secrets or --google-client-id)" \
    "GOOGLE_CLIENT_SECRET|Google:ClientSecret (user secrets or --google-client-secret)" \
    "MQTT_HOST|Mqtt:Host (user secrets)" "MQTT_USER|Mqtt:User (user secrets)" \
    "MQTT_PASSWORD|Mqtt:Password (user secrets)"
  fail_if_missing
else
  prompt_value RESOURCE_GROUP "Enter Azure Resource Group name"
  prompt_value APP_NAME "Enter Web App name (must be globally unique)"
  prompt_value GOOGLE_CLIENT_ID "Enter Google OAuth Client ID"
  prompt_value GOOGLE_CLIENT_SECRET "Enter Google OAuth Client Secret" secret
fi

PLAN_NAME="$APP_NAME-plan"
SKU="$(printf '%s' "$SKU" | tr '[:lower:]' '[:upper:]')"
case "$SKU" in F1|D1|FREE|SHARED) ALWAYS_ON=false ;; *) ALWAYS_ON=true ;; esac
RUNTIME_CONFIG="DOTNETCORE|10.0"
FQDN="$APP_NAME.azurewebsites.net"

echo
info "Deployment Configuration:"
echo "  Resource Group:   $RESOURCE_GROUP"
echo "  Web App:          $APP_NAME  ($FQDN)"
echo "  App Service Plan: $PLAN_NAME (Linux, $SKU, Always On: $ALWAYS_ON)"
echo "  Runtime:          .NET 10 (built-in, code deployment - no container, no registry)"
echo
if [ "$ALWAYS_ON" = "false" ]; then
  warn "WARNING: $SKU has no Always On - the app will be unloaded when idle (cold starts, MQTT/SignalR only while awake)."
fi
[ "$AUTO_DEPLOY" = "1" ] || confirm_or_exit

ensure_az
ensure_az_login "$AUTO_DEPLOY"
ensure_resource_group "$RESOURCE_GROUP" "$LOCATION"

# ---------------------------------------------------------------- build locally
banner "Building the deployment package (locally)"
FRONTEND_PATH="$REPO_ROOT/HomeControlFrontEnd"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
PUBLISH_DIR="$WORK/publish"
ZIP="$WORK/homecontrol.zip"

info "Building the frontend..."
(cd "$FRONTEND_PATH" && npm ci --no-audit --no-fund && npm run build) || die "Frontend build failed!"

info "Publishing the backend..."
(cd "$BACKEND_PATH" && dotnet publish -c Release -o "$PUBLISH_DIR") || die "Backend publish failed!"

# The frontend is served by the backend from wwwroot (same as the Docker image does).
rm -rf "$PUBLISH_DIR/wwwroot"; mkdir -p "$PUBLISH_DIR/wwwroot"
cp -r "$FRONTEND_PATH/dist/." "$PUBLISH_DIR/wwwroot/"
# Never ship local-only config/certs.
find "$PUBLISH_DIR" -maxdepth 1 -name 'appsettings.*.json' ! -name 'appsettings.json' -delete
rm -rf "$PUBLISH_DIR/certs"

command -v zip >/dev/null || die "zip is not installed (run ./scripts/setup-ubuntu.sh)."
(cd "$PUBLISH_DIR" && zip -qr "$ZIP" .)
ok "Package ready: $(du -h "$ZIP" | cut -f1)"

# ---------------------------------------------------------------- plan + app
banner "App Service plan"
PLAN_SKU="$(az appservice plan show --name "$PLAN_NAME" --resource-group "$RESOURCE_GROUP" --query sku.name -o tsv 2>/dev/null || true)"
if [ -z "$PLAN_SKU" ]; then
  info "Creating $SKU plan '$PLAN_NAME' in $LOCATION..."
  if ! out="$(az appservice plan create --name "$PLAN_NAME" --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" --is-linux --sku "$SKU" -o none 2>&1)"; then
    echo "$out" >&2
    die "Could not create the plan. If the message mentions quota, your subscription has none for $SKU in $LOCATION - retry with another region (-l) or tier (--sku)."
  fi
  PLAN_SKU="$SKU"
  ok "Plan created"
else
  info "Plan '$PLAN_NAME' exists (currently $PLAN_SKU)."
fi

banner "Web App (built-in .NET 10 runtime)"
if az webapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" -o none 2>/dev/null; then
  info "Web App exists - switching it from container to the built-in runtime..."
  az webapp config set --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" \
    --linux-fx-version "$RUNTIME_CONFIG" -o none || die "Failed to switch the runtime!"
  # Container-only settings; harmless leftovers otherwise, but the registry password should not linger.
  az webapp config appsettings delete --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" -o none \
    --setting-names DOCKER_REGISTRY_SERVER_URL DOCKER_REGISTRY_SERVER_USERNAME DOCKER_REGISTRY_SERVER_PASSWORD \
                    WEBSITES_PORT WEBSITES_ENABLE_APP_SERVICE_STORAGE DOCKER_ENABLE_CI 2>/dev/null || true
else
  az webapp create --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --plan "$PLAN_NAME" \
    --runtime "DOTNETCORE:10.0" -o none || die "Web App creation failed!"
fi

banner "App settings"
# DataProtection__KeysPath: /home is persistent storage; without it every cold start would regenerate
# the cookie-encryption keys and log everyone out.
az webapp config appsettings set --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" -o none \
  --settings \
  ASPNETCORE_ENVIRONMENT=Production \
  "Google__ClientId=$GOOGLE_CLIENT_ID" \
  "Google__ClientSecret=$GOOGLE_CLIENT_SECRET" \
  "Mqtt__Host=$MQTT_HOST" \
  "Mqtt__User=$MQTT_USER" \
  "Mqtt__Password=$MQTT_PASSWORD" \
  DataProtection__KeysPath=/home/data-protection-keys \
  SCM_DO_BUILD_DURING_DEPLOYMENT=false \
  || die "Failed to set app settings!"
# Scale the plan first when its tier differs (e.g. F1 -> B1), so Always On is accepted below.
if [ "$PLAN_SKU" != "$SKU" ]; then
  info "Scaling plan $PLAN_SKU -> $SKU..."
  az appservice plan update --name "$PLAN_NAME" --resource-group "$RESOURCE_GROUP" --sku "$SKU" -o none \
    || die "Could not scale the plan to $SKU (quota?)."
  PLAN_SKU="$SKU"
fi
az webapp config set --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" \
  --web-sockets-enabled true --always-on "$ALWAYS_ON" -o none \
  || die "Failed to configure WebSockets / Always On!"
az webapp update --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --https-only true -o none
ok "App configured (WebSockets on, Always On: $ALWAYS_ON, HTTPS only)"

# ---------------------------------------------------------------- deploy
banner "Deploying"
az webapp deploy --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" \
  --src-path "$ZIP" --type zip --clean true --restart true -o none \
  || die "Zip deployment failed!"
ok "Package deployed"

wait_for_site() {
  local i code
  for i in $(seq 1 48); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$FQDN/api/auth/status" || true)"
    [ "$code" = "200" ] && return 0
    sleep 5
  done
  return 1
}
info "Waiting for the app to answer (a cold start can take a minute)..."
wait_for_site || die "The app did not come up. Check: az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP"
ok "App is responding on the current tier"

printf '\n%s=====================================\nDeployment Completed Successfully!\n=====================================%s\n\n' "$C_GREEN" "$C_RESET"
info "Application URL:"
cmd "https://$FQDN"
google_redirect_notice "https://$FQDN/signin-google"
echo
if [ "$ALWAYS_ON" = "true" ]; then
  info "Always On: the app stays loaded, so MQTT and SignalR run 24/7 and there are no cold starts."
fi
echo
info "Useful Commands:"
echo "  Live logs:"
cmd "az webapp log config --name $APP_NAME --resource-group $RESOURCE_GROUP --docker-container-logging filesystem   # once (restarts the app)"
cmd "az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP"
echo "  Switch to the container-based setup instead (builds the image in a registry, ~\$5/month extra):"
cmd "./deploy-azure-appservice.sh -g $RESOURCE_GROUP -n $APP_NAME -y"
echo "  Delete everything:"
cmd "az group delete --name $RESOURCE_GROUP --yes"
echo
