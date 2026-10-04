# Azure Deployment

HomeControl is one ASP.NET Core app: the React frontend is built into the backend's `wwwroot`, so a single process serves the UI, the API and the SignalR hub - and keeps a permanent MQTT connection to the device broker, which is why it must run **always-on, as exactly one instance**.

**Current production:** Azure **Container Apps** (Consumption plan), one replica of 0.25 vCPU / 0.5 GiB, running the public image `ghcr.io/mciec/homecontrol:latest`.
- Region: Poland Central, resource group `homecontrol-rg`, app `homecontrol-app`
- URL: **https://homecontrol-app.greenwater-2aa7f6a2.polandcentral.azurecontainerapps.io** (also the default backend of the mobile app)
- Cost: about **$4/month** while idle (the normal state), at most ~$14/month if it were busy around the clock. No container registry to pay for.

The Azure resources are just three: the Container App, its Container Apps environment, and the Log Analytics workspace the environment writes logs to (its free allowance of 5 GB/month is far above this app's volume).

## How an update reaches production

1. Push to `main` -> **GitHub Actions** (`.github/workflows/publish-image.yml`) builds the `Dockerfile` and publishes `ghcr.io/mciec/homecontrol:latest` (+ `:<commit sha>`). It only runs when `Dockerfile`, `HomeControlBackEnd/`, `HomeControlFrontEnd/` or `Shared/` change.
2. Run `./deploy-azure-aca.sh -g homecontrol-rg -n homecontrol-app -y` to roll that image out (a new revision is created, so the fresh `:latest` is pulled).

The GHCR package is public (it inherits the public repo's visibility), so Container Apps pulls it anonymously - no registry credentials. The image holds only the compiled app; the Google and MQTT credentials are supplied as Container App secrets / environment variables. The deploy script checks anonymous pull works before it starts.

## Pick a target

All scripts share their logic in `scripts/lib/common.sh`, read secrets from the backend's `dotnet user-secrets`, and take similar options (`--help` lists them).

| Script | What it deploys | ≈ Cost / month | Notes |
|---|---|---|---|
| `deploy-azure-aca.sh` | **Container Apps + GHCR image** - *current* | **~$4** | Cheapest always-on. Needs the published image (GitHub Actions). |
| `deploy-azure-code.sh` | App Service **B1**, code (zip) deploy, built locally | ~$12.40 | No registry, no CI, no Docker. Simplest; keeps an `azurewebsites.net` URL. |
| `deploy-azure-appservice.sh` | App Service B1, Docker image built in ACR | ~$12.40 + ~$5 registry | Immutable image; needs ACR. |
| `deploy-azure.sh` | Container Instances | ~$20 | Simplest container host; self-signed HTTPS only. |
| `deploy-azure-code.sh --sku F1` | App Service **Free** | $0 | **Not recommended**: no Always On, so the app is unloaded when idle (cold starts, MQTT/SignalR only while awake), 60 CPU-min/day quota, and most subscriptions have no Free quota. |

Prices are Azure retail list prices (USD, 730 h/month) and change - see the [pricing calculator](https://azure.microsoft.com/pricing/calculator/). Container Apps billing: after a monthly free grant (180k vCPU-s, 360k GiB-s, 2M requests) a replica costs $0.000003 per vCPU-second / GiB-second while idle and $0.000024 per vCPU-second while active.

## Prerequisites

1. An Azure subscription and the Azure CLI: `INSTALL_AZ_CLI=1 ./scripts/setup-ubuntu.sh`
2. Log in once per machine (device code works headless / in containers): `az login --use-device-code`
3. The backend's user secrets set (`Google:*` and `Mqtt:*` - see [SETUP.md](SETUP.md)); the deploy copies them into Azure as Container App secrets.
4. The Google OAuth client lists the deployed URL as a redirect URI: `https://<app fqdn>/signin-google` (the script prints the exact value).

## Deploy to Container Apps (current)

```bash
./deploy-azure-aca.sh -g homecontrol-rg -n homecontrol-app -l polandcentral -y
```

| Option | Meaning |
|---|---|
| `-g, --resource-group` | Resource group (created if missing) |
| `-n, --app-name` | Container App name |
| `-l, --location` | Region (default `polandcentral`) |
| `--image` | Image to run (default `ghcr.io/mciec/homecontrol:latest`; pin a build with `:<commit sha>`) |
| `--mqtt-client-id` | MQTT ClientId of this deployment (default `homecontrol-backend-aca`) |
| `--google-client-id/--google-client-secret` | Override the user secrets |
| `-y, --auto-deploy` | No prompts; fails with a list of whatever is missing |

Re-running is safe: it re-applies secrets and settings and rolls out a new revision. What it does:

1. Verifies the image is anonymously pullable, checks the Azure CLI and login, registers the `Microsoft.App` / `Microsoft.OperationalInsights` providers, installs the `containerapp` CLI extension.
2. Creates the resource group and the Consumption environment `<app>-env` (which creates the Log Analytics workspace).
3. Creates (or updates) the Container App: **min = max = 1 replica**, 0.25 vCPU / 0.5 GiB, external HTTPS ingress to port 8080 over HTTP/1.1 (what SignalR's WebSocket and long-polling transports expect), the credentials as Container App secrets exposed as `Google__*` / `Mqtt__*` environment variables, `ASPNETCORE_ENVIRONMENT=Production`.
4. Waits until `/api/auth/status` answers and prints the URL and the Google redirect URI to register.

Why exactly one replica: device state lives in memory, SignalR has no backplane, and every replica would connect to MQTT with the same ClientId, so the broker would keep kicking them off each other. Why `ASPNETCORE_ENVIRONMENT=Production`: `Program.cs` only trusts the proxy's `X-Forwarded-Proto` header outside Development.

Known trade-offs of this setup:
- **Redeploys log everyone out.** A container cannot keep the cookie-encryption keys across restarts (the log warns `Storing keys in a directory ... that may not be persisted`). Restarts only happen on a redeploy/crash, so it is rare. (The code-deploy App Service variant keeps the keys on persistent storage via `DataProtection__KeysPath`.)
- **The URL contains a random part** (`greenwater-2aa7f6a2`) that is stable for the life of the environment. If the environment is ever deleted and recreated, the URL changes - and then the Google redirect URI and the mobile app's `API_BASE_URL` (`HomeControlMobile/.env`, rebuild required) must be updated.
- **MQTT ClientId:** production uses `homecontrol-backend-aca`; local runs use their own (`-dev`, `-local`, `-docker`) so they never knock it off the broker.

## Operations

```bash
az containerapp logs show -n homecontrol-app -g homecontrol-rg --type console --tail 100      # recent logs
az containerapp logs show -n homecontrol-app -g homecontrol-rg --type console --follow        # live
az containerapp show -n homecontrol-app -g homecontrol-rg --query '{status:properties.runningStatus,fqdn:properties.configuration.ingress.fqdn,scale:properties.template.scale}'
az containerapp revision list -n homecontrol-app -g homecontrol-rg -o table
az containerapp secret set -n homecontrol-app -g homecontrol-rg --secrets mqtt-password=NEW   # then redeploy
```

Useful log lines: `MQTT Started ... lag=` (device-vs-backend clock skew, informational), `SignalR DeviceStateChanged ... sent N ms after MQTT receipt`, `Hub client connected/disconnected ... transport ...` (live-update clients), `MQTT client disconnected` (repeating = two instances share a ClientId).

## App Service variants

**Code deployment** (`./deploy-azure-code.sh -g <rg> -n <app> -y`): builds locally (needs Node, .NET 10, `zip`), zip-deploys to the built-in Linux .NET 10 runtime on a **B1** plan (`--sku` to change) with Always On, WebSockets, HTTPS-only and `DataProtection__KeysPath=/home/data-protection-keys`; converts an existing container-based app in place; URL `https://<app>.azurewebsites.net`. **Container deployment** (`./deploy-azure-appservice.sh ...`): builds the image remotely in Azure Container Registry (`az acr build`, no local Docker needed), creates the Basic ACR `<app>acr`, the B1 plan and a Web App for Containers (`WEBSITES_PORT=8080`). Both enable WebSockets - App Service has them off by default, which degrades SignalR to buffered long-polling. Always On matters too: without it an idle app is unloaded together with its MQTT subscription. With `az webapp config container set` pass the **fully qualified** image name (`<acr>.azurecr.io/homecontrol:latest`); a bare name is looked up on Docker Hub. To use an App Service variant the mobile app's `API_BASE_URL` and the Google redirect URI must be changed to its `azurewebsites.net` address.

## Container Instances

`./deploy-azure.sh -g <rg> -n <name> -y` creates a Container Instance with a public DNS name (`<name>.<region>.azurecontainer.io`, ports 8080/8081 - HTTPS uses the image's self-signed certificate, so browsers warn). It deletes and recreates the instance on every deploy.

## Troubleshooting

- **App won't start / HTTP 503:** read the console log; a startup message like `Mqtt:Host is not set` names the missing setting.
- **`redirect_uri_mismatch` on login:** add `https://<app fqdn>/signin-google` to the Google OAuth client.
- **Deploy says it cannot pull the image:** the `Publish image` workflow has not run yet (Actions tab) or the package is not public (GitHub -> Packages -> homecontrol -> Package settings).
- **Live updates arrive late or never:** check the log for `Hub client connected` (none = the client never connected - for the mobile app that was React Native's read-only `URL`, fixed by the polyfill) and that no second instance shares the MQTT ClientId.
- **Repeated `MQTT client disconnected`:** two instances share an MQTT ClientId.
- **Environment/plan creation fails with a quota message:** your subscription has no quota for that tier/region - try another region (`-l`); some regions are also disallowed by Azure policy for new subscriptions.

## Cleanup

```bash
az group delete --name homecontrol-rg --yes     # deletes everything in the group
```
