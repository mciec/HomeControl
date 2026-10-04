#!/usr/bin/env bash
# Azure App Service (Web App for Containers) deployment for HomeControl.
#
# Builds the single Docker image (React frontend served from the .NET backend's
# wwwroot) remotely in ACR and runs it on App Service. App Service terminates
# public HTTPS itself with a free managed certificate on *.azurewebsites.net and
# proxies to the container over plain HTTP internally, so the image's own
# baked-in dev certificate (see Dockerfile) is left untouched and simply unused
# externally.
#
#   ./deploy-azure-appservice.sh                                  # interactive
#   ./deploy-azure-appservice.sh -g homecontrol-rg -n homecontrol-app -y
#
# Secrets (Google:*, Mqtt:*) come from the backend's `dotnet user-secrets`
# unless passed as options / env vars (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
# MQTT_HOST, MQTT_USER, MQTT_PASSWORD).
set -euo pipefail
. "$(dirname "$0")/scripts/lib/common.sh"

usage() {
  cat <<EOF
Usage: $0 [options]
  -g, --resource-group NAME     Azure resource group
  -l, --location NAME           Azure region (default: eastus)
  -n, --app-name NAME           Web App name (globally unique; <name>.azurewebsites.net)
      --google-client-id ID     overrides user secret Google:ClientId
      --google-client-secret S  overrides user secret Google:ClientSecret
  -y, --auto-deploy             no prompts; fail if anything is missing
  -h, --help
EOF
}

RESOURCE_GROUP="${RESOURCE_GROUP:-}"; LOCATION="${LOCATION:-eastus}"; APP_NAME="${APP_NAME:-}"
AUTO_DEPLOY=0
while [ $# -gt 0 ]; do
  case "$1" in
    -g|--resource-group)     RESOURCE_GROUP="$2"; shift 2 ;;
    -l|--location)           LOCATION="$2"; shift 2 ;;
    -n|--app-name)           APP_NAME="$2"; shift 2 ;;
    --google-client-id)      GOOGLE_CLIENT_ID="$2"; shift 2 ;;
    --google-client-secret)  GOOGLE_CLIENT_SECRET="$2"; shift 2 ;;
    -y|--auto-deploy)        AUTO_DEPLOY=1; shift ;;
    -h|--help)               usage; exit 0 ;;
    *) usage >&2; die "Unknown option: $1" ;;
  esac
done

banner "Azure App Service Deployment
HomeControl Application"

info "Loading secrets from user secrets store..."
load_app_secrets

if [ "$AUTO_DEPLOY" = "1" ]; then
  require_vars "RESOURCE_GROUP|--resource-group" "APP_NAME|--app-name" \
    "GOOGLE_CLIENT_ID|Google:ClientId (user secrets or --google-client-id)" \
    "GOOGLE_CLIENT_SECRET|Google:ClientSecret (user secrets or --google-client-secret)" \
    "MQTT_HOST|Mqtt:Host (dotnet user-secrets set Mqtt:Host ... --project HomeControlBackEnd)" \
    "MQTT_USER|Mqtt:User (user secrets)" "MQTT_PASSWORD|Mqtt:Password (user secrets)"
  fail_if_missing
else
  prompt_value RESOURCE_GROUP "Enter Azure Resource Group name"
  prompt_value LOCATION "Enter Azure Location [default: eastus]"
  prompt_value APP_NAME "Enter Web App name (must be globally unique)"
  prompt_value GOOGLE_CLIENT_ID "Enter Google OAuth Client ID"
  prompt_value GOOGLE_CLIENT_SECRET "Enter Google OAuth Client Secret" secret
fi
LOCATION="${LOCATION:-eastus}"

ACR_NAME="$(printf '%s' "${APP_NAME//-/}" | tr '[:upper:]' '[:lower:]')acr"
PLAN_NAME="$APP_NAME-plan"
IMAGE="homecontrol:latest"
FQDN="$APP_NAME.azurewebsites.net"

echo
info "Deployment Configuration:"
echo "  Resource Group:      $RESOURCE_GROUP"
echo "  Location:            $LOCATION"
echo "  Web App name:        $APP_NAME"
echo "  App Service Plan:    $PLAN_NAME (Linux, B1)"
echo "  Container Registry:  $ACR_NAME"
echo "  Hostname:            $FQDN (free managed TLS cert)"
echo
[ "$AUTO_DEPLOY" = "1" ] || confirm_or_exit

ensure_az
ensure_az_login "$AUTO_DEPLOY"
ensure_resource_group "$RESOURCE_GROUP" "$LOCATION"
ensure_acr "$RESOURCE_GROUP" "$ACR_NAME"
acr_build "$ACR_NAME" "$IMAGE"

banner "Creating App Service Plan"
if az appservice plan show --name "$PLAN_NAME" --resource-group "$RESOURCE_GROUP" -o none 2>/dev/null; then
  info "App Service Plan '$PLAN_NAME' already exists"
else
  # B1 is the cheapest Linux tier that supports custom containers (F1/Free does not).
  az appservice plan create --name "$PLAN_NAME" --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" --is-linux --sku B1 -o none || die "Failed to create App Service Plan!"
  ok "App Service Plan created"
fi

banner "Deploying Web App"
acr_credentials "$ACR_NAME"
if az webapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" -o none 2>/dev/null; then
  info "Web App '$APP_NAME' already exists - updating container image..."
  # Unlike `az webapp create`, `config container set` records exactly the
  # string given here as DOCKER_CUSTOM_IMAGE_NAME - a bare "<image>:<tag>"
  # gets interpreted as a Docker Hub reference at pull time, not resolved
  # against --container-registry-url. Must be fully qualified here.
  az webapp config container set \
    --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" \
    --container-image-name "$ACR_SERVER/$IMAGE" \
    --container-registry-url "https://$ACR_SERVER" \
    --container-registry-user "$ACR_USERNAME" \
    --container-registry-password "$ACR_PASSWORD" -o none \
    || die "Failed to update the Web App's container image!"
else
  # --container-image-name (not the deprecated --deployment-container-image-name)
  # is required with --container-registry-url on current az CLI, and per its own
  # help text must be bare "<image>:<tag>" (no registry prefix) in that combination.
  az webapp create \
    --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --plan "$PLAN_NAME" \
    --container-image-name "$IMAGE" \
    --container-registry-url "https://$ACR_SERVER" \
    --container-registry-user "$ACR_USERNAME" \
    --container-registry-password "$ACR_PASSWORD" -o none \
    || die "Web App creation failed!"
fi
ok "Web App deployed"

banner "Configuring App Settings"
# WEBSITES_PORT tells App Service's edge which container port to proxy HTTP
# to internally - it terminates public HTTPS itself, so the image's own
# internal 8081 HTTPS listener (dev cert) is never hit externally.
#
# ASPNETCORE_ENVIRONMENT must be Production: Program.cs only calls
# UseForwardedHeaders() in its non-Development branch; Development instead
# calls UseHttpsRedirection(), which (not knowing App Service already
# terminated TLS) 307s every request to the container's unreachable internal
# port 8081 - a redirect loop.
az webapp config appsettings set \
  --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" -o none \
  --settings \
  WEBSITES_PORT=8080 \
  ASPNETCORE_ENVIRONMENT=Production \
  "Google__ClientId=$GOOGLE_CLIENT_ID" \
  "Google__ClientSecret=$GOOGLE_CLIENT_SECRET" \
  "Mqtt__Host=$MQTT_HOST" \
  "Mqtt__User=$MQTT_USER" \
  "Mqtt__Password=$MQTT_PASSWORD" \
  WEBSITES_ENABLE_APP_SERVICE_STORAGE=false \
  || die "Failed to set app settings!"
ok "App settings configured"

banner "Restarting Web App"
az webapp restart --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" -o none
ok "Web App restarted"

printf '\n%s=====================================\nDeployment Completed Successfully!\n=====================================%s\n\n' "$C_GREEN" "$C_RESET"
info "Application URL (trusted managed certificate):"
cmd "https://$FQDN"
google_redirect_notice "https://$FQDN/signin-google"
echo
info "Useful Commands:"
echo "  View logs:"
cmd "az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP"
echo "  Delete all resources:"
cmd "az group delete --name $RESOURCE_GROUP --yes"
echo
