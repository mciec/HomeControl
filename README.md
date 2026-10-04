# HomeControl

A home-automation system: a **.NET 10 backend**, a **React web app**, a **React Native mobile app** and the **Raspberry Pi firmware** that drives an LED strip. Sign in with Google, see what a device is doing in real time and override it with one tap.

```
 ┌────────────┐  HTTPS + SignalR   ┌──────────────────┐   MQTT (HiveMQ Cloud)   ┌──────────────────┐
 │ Web (React)│◄──────────────────►│                  │◄───────────────────────►│ Raspberry Pi     │
 ├────────────┤   cookie session   │ HomeControlBackEnd│  entrance/override  ──► │ LedStripeWith-   │
 │ Mobile (RN)│◄──────────────────►│  (.NET 10)       │  ◄── entrance/motion    │ Sensors + LEDs   │
 └────────────┘                    └──────────────────┘                          └──────────────────┘
```

- **Override:** the UI `POST`s `/api/devices/{id}/override`; the backend publishes `LEFT`/`RIGHT` to `entrance/override`.
- **Events:** the device publishes JSON `Started`/`Stopped` animation events (override *or* motion-triggered) on `entrance/motion`. The backend stamps each animation with **its own clock** (so device/host clock skew can't shift anything), keeps the state in memory and pushes it to every client over SignalR (`/hubs/devices`). Clients count the progress bar down against **server time** (`serverTimeUtc`).

## Repository layout

```
HomeControl/
├── HomeControlBackEnd/            # .NET 10 ASP.NET Core API, vertical slices under Features/
│   └── Features/
│       ├── Auth/                  # Google OAuth (cookie session), allow-listed emails
│       ├── Devices/               # device registry, MQTT listener, SignalR hub, override endpoint
│       ├── Home/  Sample/         # root endpoint, public/protected demo endpoints
├── HomeControlFrontEnd/           # React 19 + TypeScript + Vite 7 + Redux Toolkit (web)
├── HomeControlMobile/             # React Native 0.87 (bare CLI) - mirrors the web app, see its README
├── DevicesAndSensors/             # Raspberry Pi firmware (.NET) + animations + Blazor simulator
├── Shared/MqttManager/            # MQTT client with retry/recovery, used by backend and device
├── scripts/                       # setup-ubuntu.sh + lib/common.sh (shared helpers)
├── docker/dev/                    # dev-container image + compose
├── Dockerfile  docker-compose.yml # production image (frontend served from the backend's wwwroot)
├── run-dev.sh  run-prod.sh        # run locally
├── deploy-azure-aca.sh            # deploy to Azure Container Apps from the GHCR image (current target, ~$4/month)
├── deploy-azure-code.sh           # alternative: App Service B1, zip deploy, no registry (~$12/month)
├── deploy-azure-appservice.sh  deploy-azure.sh   # alternatives: App Service container (ACR) / Container Instances
├── .github/workflows/             # publish-image.yml: builds the image -> ghcr.io/mciec/homecontrol
├── build-mobile-release.sh        # Android release APK
├── test-docker.sh  test-backend-startup.sh
└── AZURE_DEPLOYMENT.md  SETUP.md  README.md
```

## Quick start (Ubuntu, WSL2 or a container)

```bash
./scripts/setup-ubuntu.sh            # .NET 10, Node 22, git, ... (idempotent)
#   INSTALL_AZ_CLI=1   Azure CLI (deploy scripts)      INSTALL_ANDROID=1  JDK + Android SDK (mobile build)
#   INSTALL_DOCKER=1   Docker Engine                   INSTALL_BROWSER_DEPS=1  headless Chromium libs

cd HomeControlBackEnd
dotnet user-secrets set "Google:ClientId"     "<id>"
dotnet user-secrets set "Google:ClientSecret" "<secret>"
dotnet user-secrets set "Mqtt:Host"           "<hivemq host>"
dotnet user-secrets set "Mqtt:User"           "<user>"
dotnet user-secrets set "Mqtt:Password"       "<password>"
cd ..

(cd HomeControlFrontEnd && npm ci)
./run-dev.sh                         # backend + frontend with hot reload
```

Open **http://localhost:3000**. See [SETUP.md](SETUP.md) for the step-by-step version including Google OAuth setup.

### Scripts

| Script | What it does |
|---|---|
| `./run-dev.sh` | Backend (`https://localhost:7000`, `http://localhost:5000`) + Vite (`http://localhost:3000`, proxies `/api`, `/signin-google`, `/hubs`). Inside Docker it binds `0.0.0.0`. Uses its own MQTT ClientId (see below). |
| `./run-prod.sh` | Builds the frontend into the backend's `wwwroot`, publishes and runs in `Production`, passing user secrets as environment variables. |
| `./test-docker.sh` | Builds the production image and runs it on `:8080`/`:8081`. |
| `./test-backend-startup.sh [s]` | Boots the backend for a few seconds and reports whether it stayed up. |
| `./deploy-azure-aca.sh` | Rolls the published GHCR image out to Azure Container Apps (one always-on replica, ~$4/month) - see [AZURE_DEPLOYMENT.md](AZURE_DEPLOYMENT.md). `deploy-azure-code.sh` (App Service zip deploy), `deploy-azure-appservice.sh` (App Service + ACR image) and `deploy-azure.sh` (Container Instances) are the alternatives. |
| `./build-mobile-release.sh [--aab]` | Type-checks, lints, tests and builds the Android release APK. |

## Configuration reference

The backend reads its settings from the standard ASP.NET Core layers, **later ones overriding earlier**:

1. `HomeControlBackEnd/appsettings.json` - non-secret defaults, committed (`Mqtt:ClientId/Port/UseTLS`, the `Devices` list). Secret keys are listed there with empty values so the shape is visible.
2. `appsettings.{Environment}.json` - optional, git-ignored local overrides.
3. **User secrets** (`dotnet user-secrets`) - secrets for local development. **Only loaded when `ASPNETCORE_ENVIRONMENT=Development`** - which is why `run-prod.sh`/`test-docker.sh` read them and pass them on as environment variables.
4. **Environment variables** - how Docker and Azure App Service supply the same keys; `:` becomes `__` (`Mqtt:Host` -> `Mqtt__Host`). The `deploy-azure*.sh` scripts set these from your user secrets.

| Setting | Required | Secret | Local dev | Azure / Docker |
|---|---|---|---|---|
| `Google:ClientId`, `Google:ClientSecret` | yes (deployed) / warning (dev) | yes | user secrets | `Google__ClientId`, `Google__ClientSecret` |
| `Mqtt:Host`, `Mqtt:User`, `Mqtt:Password` | yes | yes | user secrets | `Mqtt__Host`, `Mqtt__User`, `Mqtt__Password` |
| `Mqtt:ClientId`, `Mqtt:Port`, `Mqtt:UseTLS` | yes | no | `appsettings.json` | `appsettings.json` (or `Mqtt__*` to override) |
| `Devices` | yes | no | `appsettings.json` | `appsettings.json` |
| `ASPNETCORE_ENVIRONMENT` | - | no | `Development` (launch profiles) | `Production` (Dockerfile / deploy scripts) |

Missing required settings stop the app at startup with a message naming the key and where to set it.

**Two different MQTT sections, on purpose:** the *backend* uses the `Mqtt` section; the Raspberry Pi *device* apps under `DevicesAndSensors/` use `MqttConfig`. They hold the same broker credentials but are separate programs - do not put `MqttConfig:*` into the backend's secrets.

**MQTT `ClientId` must be unique per running instance.** A broker allows one connection per ClientId, so two backends sharing one keep kicking each other off (the symptom is `MQTT client disconnected` / reconnect loops in both). Azure uses `homecontrol-backend` (from `appsettings.json`); `run-dev.sh` defaults to `homecontrol-backend-dev`, `run-prod.sh` to `homecontrol-backend-local`, and Docker runs to `homecontrol-backend-docker`. Override any of them with the `Mqtt__ClientId` environment variable.

## Google OAuth

Create an OAuth 2.0 *Web application* client in the [Google Cloud Console](https://console.cloud.google.com/) and register these **authorized redirect URIs** (the callback is always served by the backend, even when you browse the Vite dev server):

- `https://localhost:7000/signin-google` - local dev and `run-prod.sh`
- `https://homecontrol-app.greenwater-2aa7f6a2.polandcentral.azurecontainerapps.io/signin-google` - Azure (production)
- `http://localhost:8080/signin-google` and `https://localhost:8081/signin-google` - only if you use `test-docker.sh`

Only the e-mail addresses in `AllowedEmails` (`HomeControlBackEnd/Features/Auth/AuthController.cs`) can sign in; everyone else is signed out again and redirected to `/?error=unauthorized`. In development a successful login returns you to `http://localhost:3000`.

## HTTP API

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /api/auth/login` | - | Start Google sign-in (`?returnUrl=` accepts same-site paths and `homecontrol://...` for the mobile app) |
| `GET /api/auth/status` | - | `{ isAuthenticated, email }` |
| `GET /api/auth/user` | yes | Current user |
| `POST /api/auth/logout` | yes | Sign out, clear cookies |
| `GET /api/sample/public`, `/api/sample/protected` | - / yes | Demo endpoints |
| `GET /api/devices` | yes | Device list |
| `GET /api/devices/{id}` | yes | Device detail incl. `state` (`currentAnimation`, `serverTimeUtc`, last override timestamps) |
| `POST /api/devices/{id}/override` | yes | Body `{ "direction": "Left" \| "Right" }` -> `202`, or `503` if the broker is down |
| `WS/SSE/LP /hubs/devices` | yes | SignalR; server pushes `DeviceStateChanged { deviceId, type, state }` |

In development `GET /openapi/v1.json` serves the OpenAPI document.

## Clients

- **Web** ([HomeControlFrontEnd](HomeControlFrontEnd/README.md)): dark, glassy design with a custom icon set and animated background; sign-in landing page, home dashboard, device list and detail with live override controls.
- **Mobile** ([HomeControlMobile](HomeControlMobile/README.md)): the same design and behaviour in React Native; Google sign-in runs in an in-app WebView because the backend uses a cookie session.
- The two clients are deliberately kept feature-equivalent: a change to one normally gets ported to the other.

## Docker & deployment

`Dockerfile` builds the frontend, publishes the backend and ships both in one image; `docker-compose.yml` and `test-docker.sh` run it locally. Production runs on Azure Container Apps (`https://homecontrol-app.greenwater-2aa7f6a2.polandcentral.azurecontainerapps.io`): GitHub Actions publishes the image to `ghcr.io/mciec/homecontrol` and `deploy-azure-aca.sh` rolls it out; the App Service variants are kept as alternatives. `docker/dev/` is the development container (`INSTALL_ANDROID=1` adds the Android toolchain). Details: [AZURE_DEPLOYMENT.md](AZURE_DEPLOYMENT.md).

## Development notes

- **Backend:** add a folder under `HomeControlBackEnd/Features/<Name>/` with its controller, models and services; register services in `Program.cs`.
- **Web state:** Redux Toolkit slices in `HomeControlFrontEnd/src/store/`; HTTP in `src/services/api.ts` and `devicesApi.ts`; SignalR in `deviceHub.ts`.
- **Time:** never compare device/browser clocks against animation timestamps; use `serverTimeUtc` (`serverClockOffsetMs` in `devicesSlice`).
- **Solution file:** `HomeControl.sln` covers the .NET projects (and the web project for Visual Studio); the mobile app is a plain npm project.

## Troubleshooting

- **Port in use:** `run-dev.sh` stops its own previous instances; otherwise `ps -eo pid,args | grep -E 'dotnet run|vite'` and kill them, or change the ports in `launchSettings.json` / `vite.config.ts`.
- **HTTPS certificate warnings:** the dev backend uses a self-signed certificate. For a browser-trusted one use mkcert (see the mobile README) and set `Kestrel:Certificates:Default:Path/Password` as user secrets.
- **Progress bar starts late / animation times look off:** a skewed clock. The backend no longer trusts the device's clock, but check `date -u` against reality anyway - Docker/WSL2 clocks drift after sleep (`wsl --shutdown` / restart Docker Desktop). The log line `MQTT Started ... lag=` shows the device-vs-backend skew.
- **Constant `MQTT client disconnected` loops:** two instances share an MQTT ClientId (see above).
- **Google login errors:** `dotnet user-secrets list --project HomeControlBackEnd`, check the redirect URIs above match exactly, and that the account is allow-listed.

## Security

Cookies are HttpOnly/Secure/SameSite=Lax; CORS is restricted to localhost origins in development and closed in production; `returnUrl` is validated against an allow-list (no open redirect); secrets live only in user secrets / environment variables, never in the repository. The Android release is signed with the debug keystore (stock React Native template) - not suitable for the Play Store.

## License

This project is provided as a sample application.
