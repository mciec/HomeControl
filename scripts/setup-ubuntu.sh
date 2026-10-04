#!/usr/bin/env bash
# Sets up an Ubuntu machine (bare metal, VM, or WSL2) to build and run the
# HomeControl backend (.NET), web frontend (React/Vite) and - optionally - to build the
# Android release of the mobile app (JDK + Android SDK). iOS needs macOS/Xcode and is not covered.
#
# Idempotent: safe to re-run. Run as a normal user with sudo, or as root.
#
#   ./scripts/setup-ubuntu.sh                 # tools only
#   REPO_URL=https://github.com/mciec/HomeControl REPO_DIR=/home/src/home-control \
#     ./scripts/setup-ubuntu.sh               # also clone (if missing) + restore deps
#
# Optional env vars:
#   REPO_URL / REPO_DIR   clone target; if REPO_DIR already holds the repo, just restore deps
#   GIT_NAME / GIT_EMAIL  set global git identity
#   INSTALL_DOCKER=1      install Docker Engine (skipped automatically on WSL when Docker
#                         Desktop's WSL integration already provides `docker`)
#   INSTALL_AZ_CLI=1      install the Azure CLI (needed by the deploy-azure*.sh scripts)
#   INSTALL_ANDROID=1     install JDK 17 + Android SDK/NDK (needed by build-mobile-release.sh);
#                         ~3 GB. SDK lands in $ANDROID_HOME (default ~/Android/Sdk). The component
#                         versions below must match HomeControlMobile/android/build.gradle.
#   INSTALL_BROWSER_DEPS=1  system libraries + fonts for headless Chromium (Playwright)
#   MIN_NODE_MAJOR=22     minimum Node.js major version (Vite 7 needs >= 20.19 / 22.12;
#                         React Native 0.87 needs >= 22.13)
set -euo pipefail

REPO_URL="${REPO_URL:-}"
REPO_DIR="${REPO_DIR:-}"
GIT_NAME="${GIT_NAME:-}"
GIT_EMAIL="${GIT_EMAIL:-}"
INSTALL_DOCKER="${INSTALL_DOCKER:-0}"
INSTALL_AZ_CLI="${INSTALL_AZ_CLI:-0}"
INSTALL_ANDROID="${INSTALL_ANDROID:-0}"
ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
# Keep in sync with HomeControlMobile/android/build.gradle (compileSdk, buildTools, ndk).
ANDROID_PLATFORM="android-37.0"   # compileSdk 37; newer SDKs are named <major>.<minor>
ANDROID_BUILD_TOOLS="37.0.0"
ANDROID_NDK="27.1.12297006"
ANDROID_CMAKE="3.22.1"
ANDROID_CMDLINE_TOOLS_ZIP="commandlinetools-linux-11076708_latest.zip"
INSTALL_BROWSER_DEPS="${INSTALL_BROWSER_DEPS:-0}"
MIN_NODE_MAJOR="${MIN_NODE_MAJOR:-22}"
DOTNET_CHANNEL="10.0"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi
export DEBIAN_FRONTEND=noninteractive

. /etc/os-release
[ "${ID:-}" = "ubuntu" ] || { echo "This script targets Ubuntu (found: ${ID:-unknown})." >&2; exit 1; }
IS_WSL=0; grep -qi microsoft /proc/version 2>/dev/null && IS_WSL=1
echo "Ubuntu ${VERSION_ID} (${VERSION_CODENAME:-?}), WSL=${IS_WSL}"

# --- Base packages ---------------------------------------------------------
log "Base packages (git, curl, build tools)"
$SUDO apt-get update -qq
$SUDO apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg git unzip zip jq build-essential openssh-client gh

# --- Git identity ----------------------------------------------------------
log "Git configuration"
[ -n "$GIT_NAME" ]  && git config --global user.name  "$GIT_NAME"
[ -n "$GIT_EMAIL" ] && git config --global user.email "$GIT_EMAIL"
# The repo stores LF; never write CRLF into the working tree on Linux.
git config --global core.autocrlf input
git config --global init.defaultBranch main
git config --global pull.rebase false

# --- .NET SDK (global.json pins 10.0.100, rollForward latestFeature) -------
log ".NET SDK ${DOTNET_CHANNEL}"
if dotnet --list-sdks 2>/dev/null | grep -q "^${DOTNET_CHANNEL%%.*}\."; then
  echo "already installed: $(dotnet --version)"
elif apt-cache show "dotnet-sdk-${DOTNET_CHANNEL}" >/dev/null 2>&1; then
  $SUDO apt-get install -y "dotnet-sdk-${DOTNET_CHANNEL}"
else
  echo "Not in apt for this Ubuntu release; using Microsoft's dotnet-install script"
  curl -fsSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh
  $SUDO bash /tmp/dotnet-install.sh --channel "$DOTNET_CHANNEL" --install-dir /usr/share/dotnet
  $SUDO ln -sf /usr/share/dotnet/dotnet /usr/local/bin/dotnet
fi
# Opt out of telemetry for all shells
if ! grep -qs DOTNET_CLI_TELEMETRY_OPTOUT /etc/environment; then
  echo 'DOTNET_CLI_TELEMETRY_OPTOUT=1' | $SUDO tee -a /etc/environment >/dev/null
fi

# --- Node.js + npm (frontend: Vite, TypeScript, ESLint come from package.json)
log "Node.js >= ${MIN_NODE_MAJOR}"
node_major() { node -v 2>/dev/null | sed 's/^v\([0-9]*\).*/\1/'; }
if [ "$(node_major || echo 0)" -ge "$MIN_NODE_MAJOR" ] 2>/dev/null; then
  echo "already installed: $(node -v)"
else
  # (captured first: `grep -q` in a pipe + pipefail would fail on SIGPIPE)
  node_candidate="$(apt-cache policy nodejs | sed -n 's/^ *Candidate: \([0-9]*\)\..*/\1/p')"
  if [ "${node_candidate:-0}" -ge "$MIN_NODE_MAJOR" ]; then
    $SUDO apt-get install -y nodejs npm
  else
    echo "Distro Node is too old; using NodeSource ${MIN_NODE_MAJOR}.x"
    curl -fsSL "https://deb.nodesource.com/setup_${MIN_NODE_MAJOR}.x" -o /tmp/nodesource-setup.sh
    $SUDO bash /tmp/nodesource-setup.sh
    $SUDO apt-get install -y nodejs
  fi
fi
command -v npm >/dev/null || $SUDO apt-get install -y npm

# --- Docker (test-docker.sh / docker-compose.yml: run the production image locally) ---
# `docker` may be a Docker Desktop stub that only prints help, so require a working binary.
if docker --version >/dev/null 2>&1; then
  log "Docker already available: $(docker --version)"
elif [ "$INSTALL_DOCKER" = "1" ]; then
  log "Docker Engine"
  curl -fsSL https://get.docker.com | $SUDO sh
  [ "$(id -u)" -ne 0 ] && $SUDO usermod -aG docker "$USER" && echo "Log out/in for docker group to apply."
else
  log "Docker not installed (set INSTALL_DOCKER=1, or enable Docker Desktop's WSL integration)"
fi

# --- Azure CLI (deploy-azure*.sh; images are built remotely by `az acr build`,
# so deploying needs no local Docker) -----------------------------------------
if command -v az >/dev/null 2>&1; then
  log "Azure CLI already available: $(az version --query '"azure-cli"' -o tsv 2>/dev/null)"
elif [ "$INSTALL_AZ_CLI" = "1" ]; then
  log "Azure CLI (packages.microsoft.com, ${VERSION_CODENAME})"
  $SUDO install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://packages.microsoft.com/keys/microsoft.asc \
    | gpg --dearmor | $SUDO tee /etc/apt/keyrings/microsoft.gpg >/dev/null
  $SUDO chmod go+r /etc/apt/keyrings/microsoft.gpg
  printf 'Types: deb\nURIs: https://packages.microsoft.com/repos/azure-cli/\nSuites: %s\nComponents: main\nArchitectures: %s\nSigned-by: /etc/apt/keyrings/microsoft.gpg\n' \
    "$VERSION_CODENAME" "$(dpkg --print-architecture)" | $SUDO tee /etc/apt/sources.list.d/azure-cli.sources >/dev/null
  $SUDO apt-get update -qq
  $SUDO apt-get install -y azure-cli
else
  log "Azure CLI not installed (set INSTALL_AZ_CLI=1 to deploy to Azure)"
fi

# --- Headless Chromium dependencies (Playwright browsers themselves are
# downloaded per user by `npx playwright install chromium`) -------------------
if [ "$INSTALL_BROWSER_DEPS" = "1" ]; then
  log "Headless browser libraries and fonts"
  $SUDO apt-get install -y --no-install-recommends \
    libasound2t64 libatk-bridge2.0-0t64 libatk1.0-0t64 libatspi2.0-0t64 libcairo2 \
    libcups2t64 libdbus-1-3 libdrm2 libgbm1 libglib2.0-0t64 libnspr4 libnss3 \
    libpango-1.0-0 libx11-6 libxcb1 libxcomposite1 libxdamage1 libxext6 libxfixes3 \
    libxkbcommon0 libxrandr2 xvfb libfontconfig1 libfreetype6 \
    fonts-noto-color-emoji fonts-unifont xfonts-cyrillic xfonts-scalable \
    fonts-liberation fonts-ipafont-gothic fonts-wqy-zenhei fonts-tlwg-loma-otf fonts-freefont-ttf
fi

# --- Android toolchain (mobile release build: JDK + SDK + NDK) -------------
if [ "$INSTALL_ANDROID" = "1" ]; then
  log "JDK 17"
  $SUDO apt-get install -y --no-install-recommends openjdk-17-jdk-headless
  JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v javac)")")")"

  log "Android SDK -> $ANDROID_HOME"
  SDKMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
  if [ ! -x "$SDKMANAGER" ]; then
    mkdir -p "$ANDROID_HOME/cmdline-tools"
    tmpzip="$(mktemp --suffix=.zip)"
    curl -fsSL "https://dl.google.com/android/repository/$ANDROID_CMDLINE_TOOLS_ZIP" -o "$tmpzip"
    rm -rf "$ANDROID_HOME/cmdline-tools/latest" "$ANDROID_HOME/cmdline-tools/cmdline-tools"
    unzip -q "$tmpzip" -d "$ANDROID_HOME/cmdline-tools"
    mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
    rm -f "$tmpzip"
  fi
  # `yes` exits with SIGPIPE when sdkmanager stops reading; that is expected, not a failure.
  yes | JAVA_HOME="$JAVA_HOME" "$SDKMANAGER" --licenses >/dev/null 2>&1 || true
  JAVA_HOME="$JAVA_HOME" "$SDKMANAGER" --install \
    "platform-tools" "platforms;$ANDROID_PLATFORM" "build-tools;$ANDROID_BUILD_TOOLS" \
    "ndk;$ANDROID_NDK" "cmake;$ANDROID_CMAKE"

  # Persist for future shells (idempotent).
  if ! grep -qs 'HomeControl Android SDK' "$HOME/.profile"; then
    {
      echo ''
      echo '# HomeControl Android SDK (added by scripts/setup-ubuntu.sh)'
      echo "export ANDROID_HOME=\"$ANDROID_HOME\""
      echo "export JAVA_HOME=\"$JAVA_HOME\""
      echo 'export PATH="$PATH:$ANDROID_HOME/platform-tools"'
    } >> "$HOME/.profile"
  fi
else
  log "Android toolchain not installed (set INSTALL_ANDROID=1 to build the mobile app)"
fi

# --- Clone + restore dependencies ------------------------------------------
if [ -n "$REPO_DIR" ]; then
  if [ ! -d "$REPO_DIR/.git" ]; then
    [ -n "$REPO_URL" ] || { echo "REPO_DIR has no repo and REPO_URL is not set." >&2; exit 1; }
    log "Cloning $REPO_URL -> $REPO_DIR"
    $SUDO mkdir -p "$(dirname "$REPO_DIR")"
    git clone "$REPO_URL" "$REPO_DIR"
  fi
  log "Restoring backend packages"
  (cd "$REPO_DIR/HomeControlBackEnd" && dotnet restore)
  log "Installing frontend packages (npm ci)"
  (cd "$REPO_DIR/HomeControlFrontEnd" && npm ci)
  if [ "$INSTALL_ANDROID" = "1" ]; then
    log "Installing mobile packages (npm ci)"
    (cd "$REPO_DIR/HomeControlMobile" && npm ci)
  fi
fi

# --- Summary ---------------------------------------------------------------
log "Installed versions"
printf 'git     %s\n' "$(git --version | cut -d' ' -f3)"
printf 'dotnet  %s\n' "$(dotnet --version)"
printf 'node    %s\n' "$(node -v)"
printf 'npm     %s\n' "$(npm -v)"
command -v az >/dev/null && printf 'az      %s\n' "$(az version --query '"azure-cli"' -o tsv)"
command -v javac >/dev/null && printf 'java    %s\n' "$(javac -version 2>&1 | cut -d' ' -f2)"
[ -d "$ANDROID_HOME/platforms/$ANDROID_PLATFORM" ] && printf 'android %s (build-tools %s, ndk %s)\n' "$ANDROID_PLATFORM" "$ANDROID_BUILD_TOOLS" "$ANDROID_NDK"
docker --version >/dev/null 2>&1 && printf 'docker  %s\n' "$(docker --version | cut -d' ' -f3 | tr -d ,)"
cat <<'EOF'

Next steps (not automated, they hold secrets / machine-specific state):
  - Secrets live in `dotnet user-secrets` (never in appsettings.json); set them with
      cd HomeControlBackEnd
      dotnet user-secrets set "Google:ClientId" "<id>"
      dotnet user-secrets set "Google:ClientSecret" "<secret>"
      dotnet user-secrets set "Mqtt:Host" "<host>"
      dotnet user-secrets set "Mqtt:User" "<user>"
      dotnet user-secrets set "Mqtt:Password" "<password>"
    The backend refuses to start without Mqtt:Host/User/Password.
  - Dev certificate for https://localhost:7000: HomeControlBackEnd/certs is git-ignored;
    copy it from the old machine or regenerate it (mkcert / dotnet dev-certs), and set
    Kestrel:Certificates:Default:Path/Password as user secrets if you use it.
  - Google sign-in: register https://localhost:7000/signin-google as an authorized redirect
    URI on your OAuth client (see README.md / SETUP.md).
  - Run both with ./run-dev.sh (or separately: `dotnet run --launch-profile https` in
    HomeControlBackEnd, `npm run dev` in HomeControlFrontEnd). It uses its own MQTT ClientId
    so it won't disturb the deployed app.
  - Android release APK (after INSTALL_ANDROID=1): ./build-mobile-release.sh
EOF
