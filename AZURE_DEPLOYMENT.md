# Azure Deployment

HomeControl is one ASP.NET Core app: the React frontend is built into the backend's `wwwroot`, so a single process serves the UI, the API and the SignalR hub - and keeps a permanent MQTT connection to the device broker, which is why it must run **always-on**.

**Current production:** Azure App Service plan **B1** (Linux, Always On), app `homecontrol-app` in resource group `homecontrol-rg`, region West US 2 -> https://homecontrol-app.azurewebsites.net (also the default backend of the mobile app). It runs the code directly on the built-in .NET 10 runtime (`deploy-azure-code.sh`) - **no container registry**, about **$12.40/month** (B1 is $0.017/h).

## Pick a target

| Script | What it deploys | ≈ Cost / month | Always-on |
|---|---|---|---|
| `deploy-azure-code.sh` | **App Service B1, code (zip) deploy** - *current* | **~$12.40** | yes |
| `deploy-azure-appservice.sh` | App Service B1, Docker image built in ACR | ~$12.40 + ~$5 registry | yes |
| `deploy-azure-aca.sh` | Container Apps (needs a registry) | usage-based + registry | yes (min 1 replica) |
| `deploy-azure.sh` | Container Instances | ~$20 | yes |
| `deploy-azure-code.sh --sku F1` | App Service **Free** | $0 | **no** - see below |

Why not Free (F1)? It cannot run containers and has **no Always On**: the app is unloaded after ~20 minutes without HTTP traffic, so the first request after that is a cold start (10-30 s), the MQTT subscription and SignalR connections only exist while the app is awake, and a 60 CPU-minute/day quota can stop it for the rest of the day. It also needs "Free VMs" quota, which many subscriptions have as 0 in most regions. B1 is the cheapest tier with Always On.

Prices are Azure retail list prices (eastus, USD, 730 h/month) and change - check the [pricing calculator](https://azure.microsoft.com/pricing/calculator/). A cheaper always-on setup does exist in principle (Container Apps on the consumption plan with one small replica, ~$4-6/month, using a *public* registry such as GHCR instead of ACR), but it needs a CI pipeline to build and publish the image; it is not set up here.

All scripts share their logic in `scripts/lib/common.sh`, read secrets from the backend's `dotnet user-secrets`, and take similar options (`--help` lists them).

## Prerequisites

1. An Azure subscription and the Azure CLI: `INSTALL_AZ_CLI=1 ./scripts/setup-ubuntu.sh`
2. Log in once per machine (device code works headless / in containers): `az login --use-device-code`
3. Node 22 and the .NET 10 SDK for the local build (installed by `./scripts/setup-ubuntu.sh`), and `zip`.
4. The backend's user secrets set (`Google:*` and `Mqtt:*` - see [SETUP.md](SETUP.md)); the deploy copies them into Azure as app settings.
5. The Google OAuth client lists the deployed URL as a redirect URI: `https://<app>.azurewebsites.net/signin-google`.

## Deploy (code deployment, recommended)

```bash
./deploy-azure-code.sh -g homecontrol-rg -n homecontrol-app -y
```

| Option | Meaning |
|---|---|
| `-g, --resource-group` | Resource group (created if missing) |
| `-n, --app-name` | Web App name - globally unique, becomes `<name>.azurewebsites.net` |
| `-l, --location` | Region for a **new** plan (default `westus2`; an existing plan keeps its region) |
| `--sku` | Plan tier (default `B1`) |
| `--google-client-id/--google-client-secret` | Override the user secrets |
| `-y, --auto-deploy` | No prompts; fails with a list of whatever is missing |

Re-running is safe: it rebuilds, redeploys and re-applies the settings. It also **converts an existing container-based app** (from `deploy-azure-appservice.sh`) in place, and removes its registry settings.

### What the script does

1. Checks the Azure CLI/login and the resource group.
2. **Builds locally** (needs Node and .NET - `scripts/setup-ubuntu.sh`; no Docker): `npm ci && npm run build`, `dotnet publish`, frontend copied into `wwwroot`, local-only files (`appsettings.Development.json`, `certs/`) removed, zipped.
3. Creates the plan (or reuses it and scales it to `--sku`), then creates the Web App on the built-in **.NET 10** runtime - or switches an existing app to it.
4. Sets the app settings: `ASPNETCORE_ENVIRONMENT=Production`, `Google__*`, `Mqtt__*`, `DataProtection__KeysPath=/home/data-protection-keys`, plus WebSockets on, **Always On**, HTTPS-only.
5. Zip-deploys, restarts and waits until `/api/auth/status` answers.

Notes:
- **`DataProtection__KeysPath`** points the cookie-encryption keys at persistent storage (`/home`), so logins survive restarts. Without it each restart would invalidate everyone's cookie.
- **WebSockets** are off by default on App Service; with them off SignalR degrades to buffered long-polling and live updates arrive late.
- `ASPNETCORE_ENVIRONMENT` must be `Production`: `Program.cs` only trusts the proxy's `X-Forwarded-Proto` header outside Development, and in Development it would redirect every request to an unreachable HTTPS port.
- The first request after a restart or deploy can take ~10 s (startup + MQTT connect). An override sent right after a cold start waits up to 8 s for the broker instead of failing.

## Deploy as a container (alternative)

```bash
./deploy-azure-appservice.sh -g homecontrol-rg -n homecontrol-app -y
```

Builds the Docker image remotely in Azure Container Registry (`az acr build`; no local Docker needed), creates the Basic ACR `<app>acr`, the B1 plan and a Web App for Containers with `WEBSITES_PORT=8080` and the same app settings. Pick this if you want an immutable image you can also run elsewhere; it costs ~$5/month more for the registry. A cheaper path is not possible with containers on App Service Free (it does not support them).

## Configuration in Azure

The backend gets its configuration purely from environment variables here (see the configuration reference in [README.md](README.md)); it **stops at startup with a message naming the missing key** if `Google__*` or `Mqtt__*` is absent. Change a value without redeploying:

```bash
az webapp config appsettings set -n homecontrol-app -g homecontrol-rg --settings Mqtt__Password='<new>'
az webapp restart -n homecontrol-app -g homecontrol-rg
```

**MQTT ClientId:** the deployment uses `homecontrol-backend` (from `appsettings.json`); local runs use their own (`homecontrol-backend-dev`, `-local`, `-docker`) so they never knock it off the broker.

**Always On** is enabled by `deploy-azure-code.sh` (Basic tier and up), so the app is never unloaded and keeps its MQTT subscription and SignalR connections. Verify with `az webapp config show -n homecontrol-app -g homecontrol-rg --query '{alwaysOn:alwaysOn,webSockets:webSocketsEnabled}'`.

## Operations

```bash
az webapp log config -n homecontrol-app -g homecontrol-rg --docker-container-logging filesystem   # restarts the app
az webapp log tail   -n homecontrol-app -g homecontrol-rg          # live logs
az webapp log download -n homecontrol-app -g homecontrol-rg --log-file logs.zip
az webapp restart -n homecontrol-app -g homecontrol-rg
az webapp config show -n homecontrol-app -g homecontrol-rg --query '{webSockets:webSocketsEnabled,alwaysOn:alwaysOn}'
```

Useful log lines: `MQTT Started ... lag=` (device-vs-backend clock skew, informational), `SignalR DeviceStateChanged ... sent N ms after MQTT receipt`, `MQTT client disconnected` (repeating = two instances share a ClientId).

## Container Apps / Container Instances

`./deploy-azure-aca.sh -g <rg> -n <app> -y` registers the providers, installs the `containerapp` CLI extension, creates an environment and a Container App (port 8080, external ingress, 0.5 vCPU / 1 GiB, 1-3 replicas) with the same secrets as Container App secrets. `./deploy-azure.sh -g <rg> -n <name> -y` creates a Container Instance with a public DNS name (`<name>.<region>.azurecontainer.io`, ports 8080/8081 - HTTPS uses the image's self-signed certificate, so browsers warn). Both print the exact Google redirect URI to register.

## Manual steps (what `deploy-azure-code.sh` automates)

```bash
# build
(cd HomeControlFrontEnd && npm ci && npm run build)
(cd HomeControlBackEnd && dotnet publish -c Release -o /tmp/hc-publish)
rm -rf /tmp/hc-publish/wwwroot && mkdir /tmp/hc-publish/wwwroot && cp -r HomeControlFrontEnd/dist/. /tmp/hc-publish/wwwroot/
rm -rf /tmp/hc-publish/certs /tmp/hc-publish/appsettings.Development.json
(cd /tmp/hc-publish && zip -qr /tmp/homecontrol.zip .)

# azure
az group create -n homecontrol-rg -l westus2
az appservice plan create -g homecontrol-rg -n homecontrol-app-plan --is-linux --sku B1
az webapp create -g homecontrol-rg -n homecontrol-app --plan homecontrol-app-plan --runtime "DOTNETCORE:10.0"
az webapp config appsettings set -g homecontrol-rg -n homecontrol-app --settings \
  ASPNETCORE_ENVIRONMENT=Production Google__ClientId=... Google__ClientSecret=... \
  Mqtt__Host=... Mqtt__User=... Mqtt__Password=... DataProtection__KeysPath=/home/data-protection-keys
az webapp config set -g homecontrol-rg -n homecontrol-app --always-on true --web-sockets-enabled true
az webapp update -g homecontrol-rg -n homecontrol-app --https-only true
az webapp deploy -g homecontrol-rg -n homecontrol-app --src-path /tmp/homecontrol.zip --type zip --clean true --restart true
```

For the container variant, `az acr build` + `az webapp config container set` need the **fully qualified** image (`<acr>.azurecr.io/homecontrol:latest`); a bare name is looked up on Docker Hub.

## Troubleshooting

- **App won't start / HTTP 503:** `az webapp log tail`; a startup message like `Mqtt:Host is not set` names the missing app setting.
- **Redirect loop to `:8081`:** `ASPNETCORE_ENVIRONMENT` is not `Production`.
- **`redirect_uri_mismatch` on login:** add `https://<app>.azurewebsites.net/signin-google` to the Google OAuth client.
- **Live updates arrive late:** check WebSockets are enabled (command above) and that no second backend shares the MQTT ClientId.
- **Image build (container variant) fails with CS0246 `MqttManager`:** the build context is missing `Shared/` (the backend project references `../Shared/MqttManager`).
- **Logged out after every restart:** `DataProtection__KeysPath` is not set (cookie keys are regenerated on each start).
- **Plan creation fails with a quota message:** your subscription has no quota for that tier/region - try another region (`-l`) or tier (`--sku`); free-tier quota is commonly 0.

## Cleanup

```bash
az group delete --name homecontrol-rg --yes     # deletes everything in the group
```
