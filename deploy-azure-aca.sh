#!/usr/bin/env bash
# Azure Container Apps deployment for HomeControl - the CHEAPEST always-on option (~$4-8/month).
#
# Runs the production image from the GitHub Container Registry (built and published by
# .github/workflows/publish-image.yml): ghcr.io/mciec/homecontrol:latest. The package is public, so
# Container Apps pulls it anonymously - no Azure Container Registry (~$5/month) and no registry credentials.
#
#   ./deploy-azure-aca.sh                                       # interactive
#   ./deploy-azure-aca.sh -g homecontrol-rg -n homecontrol-app -y
#   ./deploy-azure-aca.sh ... --image ghcr.io/mciec/homecontrol:<commit sha>      # pin a build
#
# Sizing/cost: ONE replica, 0.25 vCPU / 0.5 GiB on the Consumption plan, always on (min = max = 1).
#   * Exactly one replica is required, not just cheap: device state is in memory, SignalR has no
#     backplane, and every replica would connect to MQTT with the same ClientId (the broker would kick
#     them off each other).
#   * Billing: ~$4/month while idle (the normal state for this app), after the monthly free grant of
#     180k vCPU-s / 360k GiB-s; at most ~$14/month if it were busy 24/7.
# The URL is https://<app>.<random>.<region>.azurecontainerapps.io (stable for the life of the
# environment) - register <url>/signin-google in the Google OAuth client.
# Secrets (Google:*, Mqtt:*) come from `dotnet user-secrets`, as for the other deploy scripts.
set -euo pipefail
. "$(dirname "$0")/scripts/lib/common.sh"

usage() {
  cat <<EOF
Usage: $0 [options]
  -g, --resource-group NAME     Azure resource group
  -l, --location NAME           Azure region (default: polandcentral)
  -n, --app-name NAME           Container App name
      --image REF               container image (default: ghcr.io/mciec/homecontrol:latest)
      --mqtt-client-id ID       MQTT ClientId of this deployment (default: homecontrol-backend-aca)
      --google-client-id ID     overrides user secret Google:ClientId
      --google-client-secret S  overrides user secret Google:ClientSecret
  -y, --auto-deploy             no prompts; fail if anything is missing
  -h, --help
EOF
}

RESOURCE_GROUP="${RESOURCE_GROUP:-}"; LOCATION="${LOCATION:-polandcentral}"; APP_NAME="${APP_NAME:-}"
IMAGE="${IMAGE:-ghcr.io/mciec/homecontrol:latest}"
MQTT_CLIENT_ID="${MQTT_CLIENT_ID:-homecontrol-backend-aca}"
AUTO_DEPLOY=0
while [ $# -gt 0 ]; do
  case "$1" in
    -g|--resource-group)     RESOURCE_GROUP="$2"; shift 2 ;;
    -l|--location)           LOCATION="$2"; shift 2 ;;
    -n|--app-name)           APP_NAME="$2"; shift 2 ;;
    --image)                 IMAGE="$2"; shift 2 ;;
    --mqtt-client-id)        MQTT_CLIENT_ID="$2"; shift 2 ;;
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
  prompt_value LOCATION "Enter Azure Location [default: polandcentral]"
  prompt_value APP_NAME "Enter Container App name (lowercase, hyphens ok e.g. homecontrol-app)"
  prompt_value GOOGLE_CLIENT_ID "Enter Google OAuth Client ID"
  prompt_value GOOGLE_CLIENT_SECRET "Enter Google OAuth Client Secret" secret
fi
LOCATION="${LOCATION:-polandcentral}"
ENVIRONMENT_NAME="$APP_NAME-env"

echo
info "Deployment Configuration:"
echo "  Resource Group:   $RESOURCE_GROUP"
echo "  Location:         $LOCATION"
echo "  Container App:    $APP_NAME   (1 replica, 0.25 vCPU / 0.5 GiB, always on)"
echo "  Environment:      $ENVIRONMENT_NAME (Consumption)"
echo "  Image:            $IMAGE"
echo "  MQTT ClientId:    $MQTT_CLIENT_ID"
echo
[ "$AUTO_DEPLOY" = "1" ] || confirm_or_exit

# Container Apps pulls without credentials, so the image must be anonymously pullable. For ghcr.io that
# means the package is public (new GHCR packages from a public repo inherit its visibility).
check_image_public() {
  local host="${IMAGE%%/*}" rest="${IMAGE#*/}" repo tag token code
  [ "$host" = "ghcr.io" ] || { info "Image is not on ghcr.io - skipping the anonymous-pull check."; return 0; }
  repo="${rest%%:*}"; tag="latest"; [[ "$rest" == *:* ]] && tag="${rest##*:}"
  token="$(curl -fsS "https://ghcr.io/token?scope=repository:${repo}:pull&service=ghcr.io" 2>/dev/null | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"
  code="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $token" \
    -H 'Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.v2+json' \
    "https://ghcr.io/v2/${repo}/manifests/${tag}")"
  [ "$code" = "200" ] || die "Cannot anonymously pull $IMAGE (HTTP $code). Has the 'Publish image' workflow run, and is the package public? (GitHub -> Packages -> homecontrol -> Package settings -> visibility)"
  ok "Image is publicly pullable"
}
check_image_public

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

banner "Creating Container Apps Environment"
if az containerapp env show --name "$ENVIRONMENT_NAME" --resource-group "$RESOURCE_GROUP" -o none 2>/dev/null; then
  info "Environment '$ENVIRONMENT_NAME' already exists"
else
  az containerapp env create --name "$ENVIRONMENT_NAME" --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" -o none || die "Failed to create the Container Apps environment!"
fi
ok "Container Apps environment ready"

banner "Deploying Container App"
# A new revision suffix forces a fresh pull of a moving tag such as :latest.
REVISION_SUFFIX="r$(date -u +%m%d%H%M%S)"
SECRETS=("google-client-id=$GOOGLE_CLIENT_ID" "google-client-secret=$GOOGLE_CLIENT_SECRET"
         "mqtt-host=$MQTT_HOST" "mqtt-user=$MQTT_USER" "mqtt-password=$MQTT_PASSWORD")
ENV_VARS=("Google__ClientId=secretref:google-client-id" "Google__ClientSecret=secretref:google-client-secret"
          "Mqtt__Host=secretref:mqtt-host" "Mqtt__User=secretref:mqtt-user" "Mqtt__Password=secretref:mqtt-password"
          "Mqtt__ClientId=$MQTT_CLIENT_ID" "ASPNETCORE_ENVIRONMENT=Production")
# min = max = 1: see the header. cpu/memory are the smallest consumption combination.
SIZING=(--min-replicas 1 --max-replicas 1 --cpu 0.25 --memory 0.5Gi)

if az containerapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" -o none 2>/dev/null; then
  info "Container app exists - updating secrets, settings and image..."
  az containerapp secret set --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --secrets "${SECRETS[@]}" -o none \
    || die "Failed to update secrets!"
  az containerapp update --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" \
    --image "$IMAGE" --revision-suffix "$REVISION_SUFFIX" "${SIZING[@]}" --set-env-vars "${ENV_VARS[@]}" -o none \
    || die "Deployment failed. Check the Azure portal for details."
else
  # --transport http: HTTP/1.1 end to end, which SignalR's WebSocket and long-polling transports expect.
  az containerapp create --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" \
    --environment "$ENVIRONMENT_NAME" --image "$IMAGE" --revision-suffix "$REVISION_SUFFIX" \
    --target-port 8080 --ingress external --transport http "${SIZING[@]}" \
    --secrets "${SECRETS[@]}" --env-vars "${ENV_VARS[@]}" -o none \
    || die "Container app creation failed!"
fi
ok "Container app deployed"

APP_FQDN="$(az containerapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" \
  --query properties.configuration.ingress.fqdn -o tsv)"

info "Waiting for the app to answer..."
up=0
for _ in $(seq 1 48); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$APP_FQDN/api/auth/status" || true)"
  [ "$code" = "200" ] && { up=1; break; }
  sleep 5
done
[ "$up" = "1" ] || die "The app did not come up. Check: az containerapp logs show --name $APP_NAME --resource-group $RESOURCE_GROUP --type console"
ok "App is responding"

printf '\n%s=====================================\nDeployment Completed Successfully!\n=====================================%s\n\n' "$C_GREEN" "$C_RESET"
info "Application URL:"
cmd "https://$APP_FQDN"
google_redirect_notice "https://$APP_FQDN/signin-google"
echo
info "Useful Commands:"
echo "  Live logs:"
cmd "az containerapp logs show --name $APP_NAME --resource-group $RESOURCE_GROUP --type console --follow"
echo "  Redeploy the latest published image:"
cmd "./deploy-azure-aca.sh -g $RESOURCE_GROUP -n $APP_NAME -y"
echo "  Update a secret:"
cmd "az containerapp secret set --name $APP_NAME --resource-group $RESOURCE_GROUP --secrets mqtt-password=NEW"
echo "  Delete all resources:"
cmd "az group delete --name $RESOURCE_GROUP --yes"
echo
