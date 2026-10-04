#!/usr/bin/env bash
# Azure Container Instances deployment for HomeControl.
# (deploy-azure-appservice.sh is the primary target; this is the ACI variant.)
#
#   ./deploy-azure.sh                                       # interactive
#   ./deploy-azure.sh -g homecontrol-rg -n homecontrol-app -y
set -euo pipefail
. "$(dirname "$0")/scripts/lib/common.sh"

usage() {
  cat <<EOF
Usage: $0 [options]
  -g, --resource-group NAME     Azure resource group
  -l, --location NAME           Azure region (default: eastus)
  -n, --container-name NAME     Container instance name (also the DNS label)
      --google-client-id ID     overrides user secret Google:ClientId
      --google-client-secret S  overrides user secret Google:ClientSecret
  -y, --auto-deploy             no prompts; fail if anything is missing
  -h, --help
EOF
}

RESOURCE_GROUP="${RESOURCE_GROUP:-}"; LOCATION="${LOCATION:-eastus}"; CONTAINER_NAME="${CONTAINER_NAME:-}"
AUTO_DEPLOY=0
while [ $# -gt 0 ]; do
  case "$1" in
    -g|--resource-group)     RESOURCE_GROUP="$2"; shift 2 ;;
    -l|--location)           LOCATION="$2"; shift 2 ;;
    -n|--container-name)     CONTAINER_NAME="$2"; shift 2 ;;
    --google-client-id)      GOOGLE_CLIENT_ID="$2"; shift 2 ;;
    --google-client-secret)  GOOGLE_CLIENT_SECRET="$2"; shift 2 ;;
    -y|--auto-deploy)        AUTO_DEPLOY=1; shift ;;
    -h|--help)               usage; exit 0 ;;
    *) usage >&2; die "Unknown option: $1" ;;
  esac
done

banner "Azure Container Instances Deployment
HomeControl Application"

info "Loading secrets from user secrets store..."
load_app_secrets

if [ "$AUTO_DEPLOY" = "1" ]; then
  require_vars "RESOURCE_GROUP|--resource-group" "CONTAINER_NAME|--container-name" \
    "GOOGLE_CLIENT_ID|Google:ClientId (user secrets or --google-client-id)" \
    "GOOGLE_CLIENT_SECRET|Google:ClientSecret (user secrets or --google-client-secret)" \
    "MQTT_HOST|Mqtt:Host (user secrets)" "MQTT_USER|Mqtt:User (user secrets)" \
    "MQTT_PASSWORD|Mqtt:Password (user secrets)"
  fail_if_missing
else
  prompt_value RESOURCE_GROUP "Enter Azure Resource Group name"
  prompt_value LOCATION "Enter Azure Location (e.g., eastus, westeurope) [default: eastus]"
  prompt_value CONTAINER_NAME "Enter Container Instance name (lowercase, hyphens ok e.g. homecontrol-app)"
  prompt_value GOOGLE_CLIENT_ID "Enter Google OAuth Client ID"
  prompt_value GOOGLE_CLIENT_SECRET "Enter Google OAuth Client Secret" secret
fi
LOCATION="${LOCATION:-eastus}"

ACR_NAME="$(printf '%s' "${CONTAINER_NAME//-/}" | tr '[:upper:]' '[:lower:]')acr"
IMAGE="homecontrol:latest"

echo
info "Deployment Configuration:"
echo "  Resource Group:      $RESOURCE_GROUP"
echo "  Location:            $LOCATION"
echo "  Container Instance:  $CONTAINER_NAME"
echo "  Container Registry:  $ACR_NAME"
echo "  DNS hostname:        $CONTAINER_NAME.$LOCATION.azurecontainer.io"
echo
[ "$AUTO_DEPLOY" = "1" ] || confirm_or_exit

ensure_az
ensure_az_login "$AUTO_DEPLOY"

banner "Registering Azure Providers"
info "Registering Microsoft.ContainerInstance provider (required for ACI)..."
az provider register --namespace Microsoft.ContainerInstance --wait
ok "Provider registered"

ensure_resource_group "$RESOURCE_GROUP" "$LOCATION"
ensure_acr "$RESOURCE_GROUP" "$ACR_NAME"
acr_build "$ACR_NAME" "$IMAGE"

banner "Deploying Container Instance"
acr_credentials "$ACR_NAME"
# ACI has no in-place update for the image - delete and recreate.
if az container show --resource-group "$RESOURCE_GROUP" --name "$CONTAINER_NAME" -o none 2>/dev/null; then
  info "Existing container instance found - deleting for fresh deployment..."
  az container delete --resource-group "$RESOURCE_GROUP" --name "$CONTAINER_NAME" --yes -o none \
    || die "Failed to delete existing container instance!"
  ok "Existing container instance deleted"
fi

az container create \
  --resource-group "$RESOURCE_GROUP" --name "$CONTAINER_NAME" \
  --image "$ACR_SERVER/$IMAGE" \
  --registry-login-server "$ACR_SERVER" \
  --registry-username "$ACR_USERNAME" \
  --registry-password "$ACR_PASSWORD" \
  --cpu 0.5 --memory 1.0 --ports 8080 8081 \
  --ip-address public --dns-name-label "$CONTAINER_NAME" --os-type Linux \
  --environment-variables "ASPNETCORE_ENVIRONMENT=Production" \
  --secure-environment-variables \
    "Google__ClientId=$GOOGLE_CLIENT_ID" "Google__ClientSecret=$GOOGLE_CLIENT_SECRET" \
    "Mqtt__Host=$MQTT_HOST" "Mqtt__User=$MQTT_USER" "Mqtt__Password=$MQTT_PASSWORD" \
  -o none \
  || die "Container instance deployment failed! If the DNS label is unavailable, re-run with a different --container-name."
ok "Container instance deployed successfully"

FQDN="$(az container show --resource-group "$RESOURCE_GROUP" --name "$CONTAINER_NAME" --query ipAddress.fqdn -o tsv)"

printf '\n%s=====================================\nDeployment Completed Successfully!\n=====================================%s\n\n' "$C_GREEN" "$C_RESET"
info "Application URLs:"
cmd "http://$FQDN:8080"
cmd "https://$FQDN:8081  (self-signed cert - browser warning expected)"
google_redirect_notice "https://$FQDN:8081/signin-google"
echo
info "Useful Commands:"
echo "  View logs:"
cmd "az container logs --resource-group $RESOURCE_GROUP --name $CONTAINER_NAME --follow"
echo "  Check status:"
cmd "az container show --resource-group $RESOURCE_GROUP --name $CONTAINER_NAME --query '{State:instanceView.state,IP:ipAddress.ip,FQDN:ipAddress.fqdn}'"
echo "  Restart container:"
cmd "az container restart --resource-group $RESOURCE_GROUP --name $CONTAINER_NAME"
echo "  Delete all resources:"
cmd "az group delete --name $RESOURCE_GROUP --yes"
echo
