# Shared helpers for the HomeControl bash scripts (deploy-azure*.sh, run-*.sh,
# test-*.sh). Source it, don't execute it:
#
#   . "$(dirname "$0")/scripts/lib/common.sh"
#
# Sets REPO_ROOT and BACKEND_PATH; expects the caller to `set -euo pipefail`.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_PATH="$REPO_ROOT/HomeControlBackEnd"

if [ -t 1 ]; then
  C_CYAN=$'\033[1;36m'; C_GREEN=$'\033[0;32m'; C_YELLOW=$'\033[0;33m'
  C_RED=$'\033[0;31m'; C_WHITE=$'\033[0;37m'; C_RESET=$'\033[0m'
else
  C_CYAN=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_WHITE=""; C_RESET=""
fi

info() { printf '%s%s%s\n' "$C_YELLOW" "$*" "$C_RESET"; }
ok()   { printf '%s%s%s\n' "$C_GREEN"  "$*" "$C_RESET"; }
warn() { printf '%s%s%s\n' "$C_YELLOW" "$*" "$C_RESET" >&2; }
err()  { printf '%s%s%s\n' "$C_RED"    "$*" "$C_RESET" >&2; }
cmd()  { printf '    %s%s%s\n' "$C_CYAN" "$*" "$C_RESET"; }
die()  { err "$*"; exit 1; }

banner() {
  printf '\n%s=====================================\n%s\n=====================================%s\n' \
    "$C_CYAN" "$*" "$C_RESET"
}

# Loads `dotnet user-secrets` of the backend into the associative array
# USER_SECRETS (keys as stored, e.g. "Google:ClientId").
declare -gA USER_SECRETS=()
load_user_secrets() {
  local line key value
  while IFS= read -r line; do
    [[ "$line" =~ ^(.+[^[:space:]])[[:space:]]*=[[:space:]]*(.+)$ ]] || continue
    key="${BASH_REMATCH[1]}"; value="${BASH_REMATCH[2]}"
    USER_SECRETS["$key"]="${value%"${value##*[![:space:]]}"}"
  done < <(dotnet user-secrets list --project "$BACKEND_PATH" 2>/dev/null || true)
}

# prompt_value VAR "Prompt text" [secret]
# Prompts for VAR only when it is empty. "secret" disables echo.
prompt_value() {
  local __var="$1" __prompt="$2" __secret="${3:-}" __value
  [ -n "${!__var:-}" ] && return 0
  if [ "$__secret" = "secret" ]; then
    read -r -s -p "$__prompt: " __value; echo
  else
    read -r -p "$__prompt: " __value
  fi
  printf -v "$__var" '%s' "$__value"
}

confirm_or_exit() {
  local answer
  read -r -p "Proceed with deployment? (y/n) " answer
  [ "$answer" = "y" ] || { err "Deployment cancelled."; exit 0; }
}

# Fills GOOGLE_CLIENT_ID/SECRET and MQTT_HOST/USER/PASSWORD from user secrets
# where not already set. Mqtt is not optional: DeviceMqttListenerService is a
# BackgroundService that throws (HiveMqttClientException) if Mqtt:Host is unset,
# and an unhandled BackgroundService exception stops the whole host
# (HostOptions.BackgroundServiceExceptionBehavior.StopHost) - unlike Google
# OAuth it has no "just don't log in" fallback.
load_app_secrets() {
  load_user_secrets
  GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-${USER_SECRETS[Google:ClientId]:-}}"
  GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-${USER_SECRETS[Google:ClientSecret]:-}}"
  MQTT_HOST="${MQTT_HOST:-${USER_SECRETS[Mqtt:Host]:-}}"
  MQTT_USER="${MQTT_USER:-${USER_SECRETS[Mqtt:User]:-}}"
  MQTT_PASSWORD="${MQTT_PASSWORD:-${USER_SECRETS[Mqtt:Password]:-}}"
  if [ -n "$GOOGLE_CLIENT_ID" ] && [ -n "$GOOGLE_CLIENT_SECRET" ]; then
    ok "Google secrets loaded."
  fi
  if [ -n "$MQTT_HOST" ] && [ -n "$MQTT_USER" ] && [ -n "$MQTT_PASSWORD" ]; then
    ok "MQTT broker secrets loaded."
  else
    warn "WARNING: Mqtt:Host/User/Password not found in user secrets - the app will crash on startup without them."
  fi
}

# Appends a message to the MISSING array for every named variable that is empty.
# Usage: require_vars "VAR|description" ...
MISSING=()
require_vars() {
  local spec var desc
  for spec in "$@"; do
    var="${spec%%|*}"; desc="${spec#*|}"
    [ -n "${!var:-}" ] || MISSING+=("$desc")
  done
}

fail_if_missing() {
  [ "${#MISSING[@]}" -eq 0 ] && return 0
  err "ERROR: Missing required parameters for --auto-deploy mode:"
  printf '  - %s\n' "${MISSING[@]}" >&2
  echo >&2
  warn "Set credentials via user secrets, e.g.:"
  cmd "dotnet user-secrets set \"Google:ClientId\" \"YOUR_ID\" --project HomeControlBackEnd" >&2
  exit 1
}

ensure_az() {
  banner "Checking Azure CLI"
  command -v az >/dev/null 2>&1 || die "Azure CLI is not installed! Run: INSTALL_AZ_CLI=1 ./scripts/setup-ubuntu.sh"
  ok "Azure CLI $(az version --query '"azure-cli"' -o tsv) is installed"
}

# ensure_az_login AUTO_DEPLOY(0|1)
ensure_az_login() {
  banner "Logging in to Azure"
  if ! az account show >/dev/null 2>&1; then
    [ "$1" = "1" ] && die "Not logged in to Azure. Run 'az login --use-device-code' in a terminal first, then retry."
    info "Please login to Azure..."
    # Device code flow works headless (Docker/WSL without a browser).
    az login --use-device-code >/dev/null || die "Azure login failed!"
  fi
  ok "Logged in as: $(az account show --query user.name -o tsv)"
  ok "Subscription: $(az account show --query name -o tsv)"
}

ensure_resource_group() {
  banner "Creating Resource Group"
  if [ "$(az group exists --name "$1")" = "true" ]; then
    info "Resource group '$1' already exists"
  else
    az group create --name "$1" --location "$2" -o none || die "Failed to create resource group!"
    ok "Resource group created"
  fi
}

ensure_acr() {
  banner "Creating Container Registry"
  if az acr show --name "$2" -o none 2>/dev/null; then
    info "Container Registry '$2' already exists"
  else
    az acr create --resource-group "$1" --name "$2" --sku Basic --admin-enabled true -o none \
      || die "Failed to create Container Registry '$2' (name taken globally?)"
  fi
  ok "Container Registry ready"
}

# acr_build ACR_NAME IMAGE:TAG
#
# `az acr build` uploads its *entire* directory argument as a tarball before
# any Docker build (or .dockerignore filtering) happens - repo-root siblings
# the Dockerfile never touches (HomeControlMobile's node_modules/native build
# output, DevicesAndSensors's bin/obj, etc.) get uploaded regardless of
# .dockerignore, which has caused multi-GB, multi-minute-stalling uploads.
# Build from a throwaway minimal context containing only what the Dockerfile
# needs. Shared/ is included because HomeControlBackEnd.csproj has a
# ProjectReference to ../Shared/MqttManager.
acr_build() {
  banner "Building Docker Image (remotely, in ACR)"
  local ctx="$REPO_ROOT/.deploy-build-context" rc=0
  info "Assembling minimal build context at $ctx..."
  rm -rf "$ctx"; mkdir -p "$ctx"
  tar -C "$REPO_ROOT" \
    --exclude='node_modules' --exclude='bin' --exclude='obj' \
    --exclude='HomeControlFrontEnd/dist' \
    --exclude='HomeControlBackEnd/certs' \
    --exclude='HomeControlBackEnd/wwwroot' \
    --exclude='HomeControlBackEnd/appsettings.Development.json' \
    --exclude='*.user' \
    -cf - HomeControlFrontEnd HomeControlBackEnd Shared Dockerfile \
    | tar -C "$ctx" -xf -
  info "Context size: $(du -sh "$ctx" | cut -f1). Building (this may take several minutes)..."
  az acr build --registry "$1" --image "$2" "$ctx" || rc=$?
  rm -rf "$ctx"
  [ "$rc" -eq 0 ] || die "Docker build failed!"
  ok "Docker image built and pushed successfully"
}

# Sets ACR_SERVER, ACR_USERNAME, ACR_PASSWORD for registry $1.
acr_credentials() {
  ACR_SERVER="$(az acr show --name "$1" --query loginServer -o tsv)"
  ACR_USERNAME="$(az acr credential show --name "$1" --query username -o tsv)"
  ACR_PASSWORD="$(az acr credential show --name "$1" --query 'passwords[0].value' -o tsv)"
}

google_redirect_notice() {
  echo
  info "IMPORTANT: Update Google OAuth Redirect URIs"
  echo "  1. Go to: https://console.cloud.google.com/"
  echo "  2. Navigate to your OAuth 2.0 Client ID"
  echo "  3. Make sure this Authorized redirect URI is present:"
  cmd "$1"
}
