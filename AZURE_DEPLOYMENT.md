# Azure Deployment

HomeControl ships as **one Docker image**: the React frontend is built into the .NET backend's `wwwroot`, so a single container serves the UI, the API and the SignalR hub. The image is built remotely in **Azure Container Registry** (`az acr build`), so **no local Docker is needed** to deploy.

**Current production:** Azure App Service `homecontrol-app` in resource group `homecontrol-rg` -> https://homecontrol-app.azurewebsites.net (this is also the default backend of the mobile app).

## Pick a target

| Script | Target | Notes |
|---|---|---|
| `deploy-azure-appservice.sh` | **App Service (Web App for Containers)** - *current* | Free managed TLS cert on `*.azurewebsites.net`, Linux B1 plan. Updates in place. |
| `deploy-azure-aca.sh` | Container Apps | Serverless, auto-scaling; updates in place. |
| `deploy-azure.sh` | Container Instances | Simplest; deletes and recreates the instance on each deploy; self-signed HTTPS only. |

All three share their logic in `scripts/lib/common.sh`, read secrets from the backend's `dotnet user-secrets`, and take the same options (`--help` lists them).

## Prerequisites

1. An Azure subscription and the Azure CLI: `INSTALL_AZ_CLI=1 ./scripts/setup-ubuntu.sh`
2. Log in once per machine (device code works headless / in containers): `az login --use-device-code`
3. The backend's user secrets set (`Google:*` and `Mqtt:*` - see [SETUP.md](SETUP.md)); the deploy copies them into Azure as app settings.
4. The Google OAuth client lists the deployed URL as a redirect URI: `https://<app>.azurewebsites.net/signin-google`.

## Deploy

```bash
./deploy-azure-appservice.sh -g homecontrol-rg -n homecontrol-app -l eastus -y
```

| Option | Meaning |
|---|---|
| `-g, --resource-group` | Resource group (created if missing) |
| `-n, --app-name` | Web App name - globally unique, becomes `<name>.azurewebsites.net` |
| `-l, --location` | Region (default `eastus`) |
| `--google-client-id/--google-client-secret` | Override the user secrets |
| `-y, --auto-deploy` | No prompts; fails with a list of whatever is missing |

Without `-y` it prompts for anything not given and asks for confirmation. Re-running is safe: existing resources are reused and the app is updated to the freshly built image.

### What the script does

1. Checks the Azure CLI and login; creates the resource group and a Basic **ACR** named `<app name without hyphens>acr`.
2. Assembles a minimal build context (frontend, backend, `Shared/`, `Dockerfile`) - `az acr build` uploads its whole directory, so the full repo (mobile `node_modules` etc.) must not go along - and builds `homecontrol:latest` in ACR.
3. Creates the Linux **B1** plan `<app>-plan` (the cheapest tier that runs custom containers), then creates or updates the Web App with the ACR image.
4. Sets the app settings: `WEBSITES_PORT=8080`, `ASPNETCORE_ENVIRONMENT=Production`, `Google__ClientId/ClientSecret`, `Mqtt__Host/User/Password`, `WEBSITES_ENABLE_APP_SERVICE_STORAGE=false`.
5. Enables **WebSockets** (App Service has them off by default, which degrades SignalR to buffered long-polling and delays live device updates) and restarts the app.

Why `Production` matters: `Program.cs` only trusts the proxy's `X-Forwarded-Proto` header outside Development. In Development it calls `UseHttpsRedirection()`, which - not knowing App Service already terminated TLS - redirects every request to the container's unreachable port 8081.

## Configuration in Azure

The backend gets its configuration purely from environment variables here (see the configuration reference in [README.md](README.md)); it **stops at startup with a message naming the missing key** if `Google__*` or `Mqtt__*` is absent. Change a value without redeploying:

```bash
az webapp config appsettings set -n homecontrol-app -g homecontrol-rg --settings Mqtt__Password='<new>'
az webapp restart -n homecontrol-app -g homecontrol-rg
```

**MQTT ClientId:** the deployment uses `homecontrol-backend` (from `appsettings.json`); local runs use their own (`homecontrol-backend-dev`, `-local`, `-docker`) so they never knock it off the broker.

**Always On** is off on the current plan, so an idle app is unloaded after a while - and with it the MQTT subscription that feeds live updates. If you want the app always listening: `az webapp config set -n homecontrol-app -g homecontrol-rg --always-on true`.

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

## Manual steps (what the script automates)

```bash
az group create -n homecontrol-rg -l eastus
az acr create -g homecontrol-rg -n homecontrolappacr --sku Basic --admin-enabled true
az acr build -r homecontrolappacr -t homecontrol:latest .      # run from a trimmed context, see above
az appservice plan create -g homecontrol-rg -n homecontrol-app-plan --is-linux --sku B1
az webapp create -g homecontrol-rg -n homecontrol-app --plan homecontrol-app-plan \
  --container-image-name homecontrol:latest --container-registry-url https://homecontrolappacr.azurecr.io \
  --container-registry-user <acr user> --container-registry-password <acr password>
az webapp config appsettings set -g homecontrol-rg -n homecontrol-app --settings \
  WEBSITES_PORT=8080 ASPNETCORE_ENVIRONMENT=Production Google__ClientId=... Google__ClientSecret=... \
  Mqtt__Host=... Mqtt__User=... Mqtt__Password=...
az webapp config set -g homecontrol-rg -n homecontrol-app --web-sockets-enabled true
```

When updating an existing app with `az webapp config container set`, pass the **fully qualified** image (`<acr>.azurecr.io/homecontrol:latest`); a bare name is looked up on Docker Hub.

## Troubleshooting

- **Container won't start / HTTP 503:** `az webapp log tail`; a startup message like `Mqtt:Host is not set` names the missing app setting.
- **Redirect loop to `:8081`:** `ASPNETCORE_ENVIRONMENT` is not `Production`.
- **`redirect_uri_mismatch` on login:** add `https://<app>.azurewebsites.net/signin-google` to the Google OAuth client.
- **Live updates arrive late:** check WebSockets are enabled (command above) and that no second backend shares the MQTT ClientId.
- **Image build fails with CS0246 `MqttManager`:** the build context is missing `Shared/` (the backend project references `../Shared/MqttManager`).

## Cleanup

```bash
az group delete --name homecontrol-rg --yes     # deletes everything in the group
```
