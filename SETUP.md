# Setup Guide

A step-by-step path from a clean Ubuntu machine (bare metal, VM, WSL2 or a container) to a running app. For what the system is and how it fits together, see [README.md](README.md).

## 1. Install the toolchain

```bash
./scripts/setup-ubuntu.sh
```

Installs git, .NET 10, Node 22 and friends (idempotent, safe to re-run). Optional extras are switched on with environment variables:

| Variable | Adds |
|---|---|
| `INSTALL_AZ_CLI=1` | Azure CLI - needed by `deploy-azure*.sh` |
| `INSTALL_ANDROID=1` | JDK 17 + Android SDK/NDK (~3 GB) - needed by `build-mobile-release.sh` |
| `INSTALL_DOCKER=1` | Docker Engine (skipped on WSL when Docker Desktop provides it) |
| `INSTALL_BROWSER_DEPS=1` | Libraries for headless Chromium (screenshots/e2e) |
| `REPO_URL=... REPO_DIR=...` | Clone the repo and restore backend/frontend (and, with Android, mobile) dependencies |

## 2. Google OAuth credentials

1. Open the [Google Cloud Console](https://console.cloud.google.com/), create a project and an **OAuth 2.0 Client ID** of type *Web application*.
2. Add these **authorized redirect URIs** - the callback is always served by the backend, even when you browse the Vite dev server on port 3000:
   - `https://localhost:7000/signin-google`
   - `https://homecontrol-app.azurewebsites.net/signin-google` (Azure)
   - `http://localhost:8080/signin-google`, `https://localhost:8081/signin-google` (only for `test-docker.sh`)
3. Copy the **Client ID** and **Client Secret**.

## 3. Store the secrets

Secrets live in .NET user secrets (never in `appsettings.json`, never in git):

```bash
cd HomeControlBackEnd
dotnet user-secrets set "Google:ClientId"     "<client id>"
dotnet user-secrets set "Google:ClientSecret" "<client secret>"
dotnet user-secrets set "Mqtt:Host"           "<your HiveMQ Cloud host>"
dotnet user-secrets set "Mqtt:User"           "<mqtt user>"
dotnet user-secrets set "Mqtt:Password"       "<mqtt password>"
```

The backend refuses to start without the three `Mqtt:*` secrets and tells you which one is missing. Use the same broker credentials as the Raspberry Pi device (its `MqttConfig` section) if you want to see the real device's traffic.

## 4. Development certificate (optional)

The dev backend serves HTTPS on `localhost:7000` with a self-signed certificate, so browsers show a warning you can click through. For a trusted one, use mkcert (`sudo apt install mkcert libnss3-tools && mkcert -install`), put the files in `HomeControlBackEnd/certs/` (git-ignored) and set `Kestrel:Certificates:Default:Path` / `:Password` as user secrets - see [HomeControlMobile/README.md](HomeControlMobile/README.md) for the exact commands (they are also what a phone needs to reach a local backend).

## 5. Run in development mode

```bash
(cd HomeControlFrontEnd && npm ci)
./run-dev.sh
```

- Frontend: **http://localhost:3000** (hot reload; proxies `/api`, `/signin-google`, `/hubs` to the backend)
- Backend: `https://localhost:7000` and `http://localhost:5000`; OpenAPI at `/openapi/v1.json`

`run-dev.sh` stops its own earlier instances, and uses the MQTT ClientId `homecontrol-backend-dev` so it never knocks the deployed app off the broker. Inside Docker it binds `0.0.0.0` so published ports work.

## 6. Try it

1. Open http://localhost:3000 and click **Sign in with Google** (only allow-listed accounts can sign in - `AllowedEmails` in `HomeControlBackEnd/Features/Auth/AuthController.cs`).
2. Open **Devices** -> *Entrance LED Strip*.
3. Press **Override Left** / **Override Right** - the button turns into a progress bar when the device confirms the animation.

## 7. Production build, Docker, Azure, mobile

```bash
./run-prod.sh                       # build frontend into wwwroot, publish, run in Production
./test-docker.sh                    # production image in Docker on :8080/:8081
./deploy-azure-appservice.sh -g homecontrol-rg -n homecontrol-app -y     # see AZURE_DEPLOYMENT.md
INSTALL_ANDROID=1 ./scripts/setup-ubuntu.sh && ./build-mobile-release.sh # Android release APK
```

## Troubleshooting

- **Ports already in use:** `ps -eo pid,args | grep -E 'dotnet run|vite'`, then `kill` the PIDs (avoid `pkill -f` patterns that match your own shell).
- **Google login not working:** check `dotnet user-secrets list --project HomeControlBackEnd`, that the redirect URIs above match exactly, and that you use an allow-listed account.
- **Backend exits at startup:** read the message - it names the missing `Mqtt:*` / `Google:*` setting.
- **Animation progress looks late:** your machine's clock is off (common after WSL2/Docker sleep). `date -u` should match real time; `wsl --shutdown` fixes it.
- **Repeated "MQTT client disconnected":** another instance uses the same MQTT ClientId; set `Mqtt__ClientId` to something unique.

Next: [README.md](README.md) (architecture, configuration reference, HTTP API) and [AZURE_DEPLOYMENT.md](AZURE_DEPLOYMENT.md).
