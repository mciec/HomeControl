#!/usr/bin/env bash
# Azure Container Apps deployment for HomeControl.
# (deploy-azure-code.sh is the primary target; this is the ACA variant.)
#
#   ./deploy-azure-aca.sh                                       # interactive
#   ./deploy-azure-aca.sh -g homecontrol-rg -n homecontrol-app -y
set -euo pipefail
. "$(dirname "$0")/scripts/lib/common.sh"

usage() {
  cat <<EOF
Usage: $0 [options]
  -g, --resource-group NAME     Azure resource group
  -l, --location NAME           Azure region (default: eastus)
  -n, --app-name NAME           Container App name
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

banner "Azure Container Apps Deployment
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
  prompt_value LOCATION "Enter Azure Location (e.g., eastus, westeurope) [default: eastus]"
  prompt_value APP_NAME "Enter Container App name (lowercase, hyphens ok e.g. homecontrol-app)"
  prompt_value GOOGLE_CLIENT_ID "Enter Google OAuth Client ID"
  prompt_value GOOGLE_CLIENT_SECRET "Enter Google OAuth Client Secret" secret
fi
LOCATION="${LOCATION:-eastus}"

ACR_NAME="$(printf '%s' "${APP_NAME//-/}" | tr '[:upper:]' '[:lower:]')acr"
ENVIRONMENT_NAME="$APP_NAME-env"
IMAGE="homecontrol:latest"

echo
info "Deployment Configuration:"
echo "  Resource Group:      $RESOURCE_GROUP"
echo "  Location:            $LOCATION"
echo "  Container App:       $APP_NAME"
echo "  Container Registry:  $ACR_NAME"
echo "  Environment:         $ENVIRONMENT_NAME"
echo "  App URL (after):     https://$APP_NAME.<hash>.$LOCATION.azurecontainerapps.io"
echo
[ "$AUTO_DEPLOY" = "1" ] || confirm_or_exit

ensure_az
ensure_az_login "$AUTO_DEPLOY"

banner "Registering Azure Providers"
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait
ok "Providers registered"

banner "Installing Container Apps Extension"
az extension add --name containerapp --upgrade --yes 2>/dev/null || true
ok "Extension ready"

ensure_resource_group "$RESOURCE_GROUP" "$LOCATION"
ensure_acr "$RESOURCE_GROUP" "$ACR_NAME"
acr_build "$ACR_NAME" "$IMAGE"

banner "Creating Container Apps Environment"
if az containerapp env show --name "$ENVIRONMENT_NAME" --resource-group "$RESOURCE_GROUP" -o none 2>/dev/null; then
  info "Environment '$ENVIRONMENT_NAME' already exists"
else
  az containerapp env create --name "$ENVIRONMENT_NAME" --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" -o none || die "Failed to create Container Apps environment!"
fi
ok "Container Apps environment ready"

banner "Deploying Container App"
acr_credentials "$ACR_NAME"
if az containerapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" -o none 2>/dev/null; then
  info "Container app exists - updating image..."
  az containerapp update --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" \
    --image "$ACR_SERVER/$IMAGE" -o none \
    || die "Deployment failed. Check the Azure portal for details."
else
  az containerapp create \
    --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" \
    --environment "$ENVIRONMENT_NAME" \
    --image "$ACR_SERVER/$IMAGE" \
    --registry-server "$ACR_SERVER" \
    --registry-username "$ACR_USERNAME" \
    --registry-password "$ACR_PASSWORD" \
    --target-port 8080 --ingress external \
    --min-replicas 1 --max-replicas 3 --cpu 0.5 --memory 1.0Gi \
    --secrets "google-client-id=$GOOGLE_CLIENT_ID" "google-client-secret=$GOOGLE_CLIENT_SECRET" \
              "mqtt-host=$MQTT_HOST" "mqtt-user=$MQTT_USER" "mqtt-password=$MQTT_PASSWORD" \
    --env-vars "Google__ClientId=secretref:google-client-id" \
               "Google__ClientSecret=secretref:google-client-secret" \
               "Mqtt__Host=secretref:mqtt-host" "Mqtt__User=secretref:mqtt-user" \
               "Mqtt__Password=secretref:mqtt-password" \
               "ASPNETCORE_ENVIRONMENT=Production" \
    -o none || die "Container app creation failed!"
fi
ok "Container app deployed successfully"

APP_URL="$(az containerapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" \
  --query properties.configuration.ingress.fqdn -o tsv)"

printf '\n%s=====================================\nDeployment Completed Successfully!\n=====================================%s\n\n' "$C_GREEN" "$C_RESET"
info "Application URL:"
cmd "https://$APP_URL"
google_redirect_notice "https://$APP_URL/signin-google"
echo
info "Useful Commands:"
echo "  View logs:"
cmd "az containerapp logs show --name $APP_NAME --resource-group $RESOURCE_GROUP --follow"
echo "  Update secrets:"
cmd "az containerapp secret set --name $APP_NAME --resource-group $RESOURCE_GROUP --secrets google-client-id=NEW_ID google-client-secret=NEW_SECRET"
echo "  Scale app:"
cmd "az containerapp update --name $APP_NAME --resource-group $RESOURCE_GROUP --min-replicas 1 --max-replicas 5"
echo "  Delete all resources:"
cmd "az group delete --name $RESOURCE_GROUP --yes"
echo
