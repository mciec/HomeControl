#!/usr/bin/env bash
# Builds the HomeControlMobile Android RELEASE APK (and optionally an AAB) on Ubuntu.
#
#   ./build-mobile-release.sh            # -> app-release.apk
#   ./build-mobile-release.sh --aab      # also builds the Play Store bundle
#
# Needs JDK 17 + Android SDK: INSTALL_ANDROID=1 ./scripts/setup-ubuntu.sh
#
# SIGNING: the release build type signs with android/app/debug.keystore (the stock React
# Native template setup), so the APK installs/sideloads fine but is NOT Play Store ready.
# For that, generate your own keystore and point signingConfigs.release at it in
# android/app/build.gradle.
#
# The backend URL is baked in at build time from HomeControlMobile/.env (API_BASE_URL).
set -euo pipefail
. "$(dirname "$0")/scripts/lib/common.sh"

MOBILE_PATH="$REPO_ROOT/HomeControlMobile"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
if [ -z "${JAVA_HOME:-}" ] && command -v javac >/dev/null 2>&1; then
  JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v javac)")")")"
fi
export JAVA_HOME="${JAVA_HOME:-}"

BUILD_AAB=0
[ "${1:-}" = "--aab" ] && BUILD_AAB=1

banner "HomeControl Mobile - Android release build"

[ -n "$JAVA_HOME" ] || die "JDK not found. Run: INSTALL_ANDROID=1 ./scripts/setup-ubuntu.sh"
[ -d "$ANDROID_HOME/platforms" ] || die "Android SDK not found at $ANDROID_HOME. Run: INSTALL_ANDROID=1 ./scripts/setup-ubuntu.sh"

info "API_BASE_URL: $(grep -E '^API_BASE_URL=' "$MOBILE_PATH/.env" 2>/dev/null | cut -d= -f2- || true)"

info "Installing JS dependencies..."
(cd "$MOBILE_PATH" && npm ci)

info "Type-checking, linting and testing before building..."
(cd "$MOBILE_PATH" && npx tsc --noEmit && npx eslint . && npx jest --silent)

# local.properties tells Gradle where the SDK is (git-ignored).
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > "$MOBILE_PATH/android/local.properties"

TASKS=(assembleRelease)
[ "$BUILD_AAB" = "1" ] && TASKS+=(bundleRelease)

info "Running Gradle: ${TASKS[*]} (first run downloads Gradle + dependencies, several minutes)..."
(cd "$MOBILE_PATH/android" && ./gradlew "${TASKS[@]}" --no-daemon -PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64)

APK="$MOBILE_PATH/android/app/build/outputs/apk/release/app-release.apk"
[ -f "$APK" ] || die "Build finished but $APK was not produced."
ok "APK: $APK ($(du -h "$APK" | cut -f1))"
[ "$BUILD_AAB" = "1" ] && ok "AAB: $MOBILE_PATH/android/app/build/outputs/bundle/release/app-release.aab"
echo
info "Install on a connected device/emulator:"
cmd "$ANDROID_HOME/platform-tools/adb install -r $APK"
