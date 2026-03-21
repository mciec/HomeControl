# Azure Deployment Guide

This guide covers deploying the HomeControl application to Microsoft Azure using Azure Container Apps.

## Prerequisites

1. **Azure Account**: [Create a free account](https://azure.microsoft.com/free/)
2. **Azure CLI**: [Install Azure CLI](https://docs.microsoft.com/cli/azure/install-azure-cli)
3. **Docker**: [Install Docker Desktop](https://www.docker.com/products/docker-desktop)
4. **Google OAuth Credentials**: See [SETUP.md](SETUP.md) for instructions

## Deployment Options

### Option 1: Azure Container Apps (Recommended)
- Fully managed serverless container platform
- Auto-scaling and built-in load balancing
- Pay only for what you use
- Easy HTTPS/SSL management

### Option 2: Azure App Service
- Platform-as-a-Service (PaaS)
- Good for continuous deployment
- Built-in monitoring

### Option 3: Azure Container Instances
- Simple container deployment
- Good for testing/development
- No orchestration features

## Quick Deployment with Azure Container Apps

### Step 1: Install Azure CLI and Login

```bash
# Install Azure CLI (if not already installed)
# Windows: Download from https://aka.ms/installazurecliwindows
# macOS: brew install azure-cli
# Linux: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Login to Azure
az login

# Set your subscription (if you have multiple)
az account list --output table
az account set --subscription "YOUR_SUBSCRIPTION_NAME"
```

### Step 2: Update Google OAuth Redirect URIs

Before deploying, you need to add your Azure domain to Google OAuth settings:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to your OAuth 2.0 Client ID
3. Add these Authorized redirect URIs (replace with your actual domain):
   - `https://YOUR_APP_NAME.azurecontainerapps.io/signin-google`
   - `https://YOUR_CUSTOM_DOMAIN.com/signin-google` (if using custom domain)

### Step 3: Run the Automated Deployment Script

```powershell
# Make sure you're in the HomeControl directory
cd d:\shared\repos\HomeControl

# Run the deployment script
.\deploy-azure.ps1
```

The script will prompt you for:
- Azure resource group name
- Location (e.g., eastus, westeurope)
- Container app name
- Google Client ID
- Google Client Secret

### Step 4: Access Your Application

After deployment completes, the script will output your application URL:
```
https://YOUR_APP_NAME.azurecontainerapps.io
```

## Manual Deployment Steps

If you prefer to deploy manually or need more control:

### 1. Build and Push Docker Image

```bash
# Set variables
$RESOURCE_GROUP="homecontrol-rg"
$LOCATION="eastus"
$ACR_NAME="homecontrolacr"
$IMAGE_NAME="homecontrol"
$TAG="latest"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Azure Container Registry
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic

# Login to ACR
az acr login --name $ACR_NAME

# Build and push image
az acr build --registry $ACR_NAME --image "${IMAGE_NAME}:${TAG}" .
```

### 2. Create Container App Environment

```bash
# Install Container Apps extension
az extension add --name containerapp --upgrade

# Register provider
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights

# Create Container Apps environment
$ENVIRONMENT="homecontrol-env"
az containerapp env create --name $ENVIRONMENT --resource-group $RESOURCE_GROUP --location $LOCATION
```

### 3. Deploy Container App

```bash
$CONTAINER_APP="homecontrol-app"

# Get ACR credentials
$ACR_SERVER=$(az acr show --name $ACR_NAME --query loginServer --output tsv)
$ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username --output tsv)
$ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value --output tsv)

# Create container app
az containerapp create `
  --name $CONTAINER_APP `
  --resource-group $RESOURCE_GROUP `
  --environment $ENVIRONMENT `
  --image "${ACR_SERVER}/${IMAGE_NAME}:${TAG}" `
  --registry-server $ACR_SERVER `
  --registry-username $ACR_USERNAME `
  --registry-password $ACR_PASSWORD `
  --target-port 8080 `
  --ingress external `
  --min-replicas 1 `
  --max-replicas 3 `
  --secrets google-client-id=YOUR_GOOGLE_CLIENT_ID google-client-secret=YOUR_GOOGLE_CLIENT_SECRET `
  --env-vars "Google__ClientId=secretref:google-client-id" "Google__ClientSecret=secretref:google-client-secret" "ASPNETCORE_ENVIRONMENT=Production"
```

### 4. Get Application URL

```bash
az containerapp show --name $CONTAINER_APP --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn --output tsv
```

## Configure HTTPS and Custom Domain

### Enable HTTPS (Automatic)
Azure Container Apps automatically provides HTTPS with a managed certificate for the default domain.

### Add Custom Domain

```bash
# Add custom domain
az containerapp hostname add `
  --name $CONTAINER_APP `
  --resource-group $RESOURCE_GROUP `
  --hostname www.yourdomain.com

# Bind certificate (automatic managed certificate)
az containerapp hostname bind `
  --name $CONTAINER_APP `
  --resource-group $RESOURCE_GROUP `
  --hostname www.yourdomain.com `
  --validation-method HTTP
```

Update your DNS:
- Add CNAME record: `www.yourdomain.com` → `your-app.azurecontainerapps.io`

## Update Application Secrets

To update Google OAuth credentials or other secrets:

```bash
# Update secrets
az containerapp secret set `
  --name $CONTAINER_APP `
  --resource-group $RESOURCE_GROUP `
  --secrets google-client-id=NEW_CLIENT_ID google-client-secret=NEW_CLIENT_SECRET

# Restart app to apply changes
az containerapp revision restart `
  --name $CONTAINER_APP `
  --resource-group $RESOURCE_GROUP
```

## Continuous Deployment

### Option 1: GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Azure

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Login to Azure
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Build and push image
        run: |
          az acr build --registry homecontrolacr --image homecontrol:${{ github.sha }} .

      - name: Deploy to Container App
        run: |
          az containerapp update \
            --name homecontrol-app \
            --resource-group homecontrol-rg \
            --image homecontrolacr.azurecr.io/homecontrol:${{ github.sha }}
```

### Option 2: Azure DevOps

1. Create a new Azure DevOps project
2. Connect to your repository
3. Create a pipeline using the Docker template
4. Configure the pipeline to build and push to ACR
5. Add a release pipeline to deploy to Container Apps

## Monitoring and Logs

### View Logs

```bash
# Stream live logs
az containerapp logs show `
  --name $CONTAINER_APP `
  --resource-group $RESOURCE_GROUP `
  --follow

# View recent logs
az containerapp logs show `
  --name $CONTAINER_APP `
  --resource-group $RESOURCE_GROUP `
  --tail 100
```

### Enable Application Insights

```bash
# Create Application Insights
$APP_INSIGHTS="homecontrol-insights"
az monitor app-insights component create `
  --app $APP_INSIGHTS `
  --location $LOCATION `
  --resource-group $RESOURCE_GROUP

# Get instrumentation key
$INSTRUMENTATION_KEY=$(az monitor app-insights component show --app $APP_INSIGHTS --resource-group $RESOURCE_GROUP --query instrumentationKey --output tsv)

# Update container app with Application Insights
az containerapp update `
  --name $CONTAINER_APP `
  --resource-group $RESOURCE_GROUP `
  --set-env-vars "APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=$INSTRUMENTATION_KEY"
```

## Scaling

### Manual Scaling

```bash
az containerapp update `
  --name $CONTAINER_APP `
  --resource-group $RESOURCE_GROUP `
  --min-replicas 2 `
  --max-replicas 10
```

### Auto-scaling Rules

```bash
# Scale based on HTTP requests
az containerapp update `
  --name $CONTAINER_APP `
  --resource-group $RESOURCE_GROUP `
  --scale-rule-name http-rule `
  --scale-rule-type http `
  --scale-rule-http-concurrency 100
```

## Cost Optimization

1. **Use Free Tier**: First 180,000 vCPU-seconds and 360,000 GiB-seconds per month are free
2. **Set Minimum Replicas to 0**: Scale to zero when not in use (not recommended for production)
3. **Use Spot Instances**: For non-production environments
4. **Monitor Usage**: Set up billing alerts

```bash
# Scale to zero when idle (development only)
az containerapp update `
  --name $CONTAINER_APP `
  --resource-group $RESOURCE_GROUP `
  --min-replicas 0
```

## Backup and Disaster Recovery

### Export Configuration

```bash
# Export container app configuration
az containerapp show `
  --name $CONTAINER_APP `
  --resource-group $RESOURCE_GROUP `
  --output json > containerapp-config.json
```

### Multi-Region Deployment

For high availability, deploy to multiple regions:

1. Create container apps in different regions
2. Use Azure Front Door or Traffic Manager for load balancing
3. Configure geo-replication for Azure Container Registry

## Troubleshooting

### Container Fails to Start

```bash
# Check logs
az containerapp logs show --name $CONTAINER_APP --resource-group $RESOURCE_GROUP --tail 100

# Check revision status
az containerapp revision list --name $CONTAINER_APP --resource-group $RESOURCE_GROUP --output table
```

### Authentication Issues

1. Verify Google OAuth redirect URIs match your Azure domain
2. Check that secrets are correctly set
3. Ensure allowed email addresses are configured

### Performance Issues

1. Enable Application Insights
2. Increase CPU/memory allocation
3. Add more replicas
4. Check for slow database queries or external API calls

## Security Best Practices

1. **Use Managed Identities**: For accessing Azure resources
2. **Store Secrets in Key Vault**: Instead of container app secrets
3. **Enable HTTPS Only**: Redirect HTTP to HTTPS
4. **Restrict Network Access**: Use Virtual Networks if needed
5. **Regular Updates**: Keep base images and dependencies updated

## Cleanup

To delete all resources:

```bash
# Delete resource group (deletes all resources in it)
az group delete --name $RESOURCE_GROUP --yes --no-wait
```

## Cost Estimate

Approximate monthly costs for production deployment:

- **Container App**: ~$50-200/month (depending on usage)
- **Container Registry**: ~$5/month (Basic tier)
- **Application Insights**: ~$0-50/month (depending on volume)
- **Custom Domain SSL**: Free (managed certificates)

**Total**: ~$55-255/month

Free tier includes:
- 180,000 vCPU-seconds
- 360,000 GiB-seconds
- Unlimited HTTP requests

## Next Steps

1. Set up continuous deployment with GitHub Actions or Azure DevOps
2. Configure custom domain and SSL certificates
3. Enable Application Insights for monitoring
4. Set up automated backups
5. Configure multi-region deployment for high availability

## Support

- [Azure Container Apps Documentation](https://docs.microsoft.com/azure/container-apps/)
- [Azure CLI Reference](https://docs.microsoft.com/cli/azure/)
- [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/)

For issues specific to this application, see [README.md](README.md)
