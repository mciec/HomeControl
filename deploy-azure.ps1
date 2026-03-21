# Azure Container Apps Deployment Script for HomeControl
# This script automates the deployment of HomeControl to Azure Container Apps

param(
    [string]$ResourceGroup,
    [string]$Location = "eastus",
    [string]$ContainerAppName,
    [string]$GoogleClientId,
    [string]$GoogleClientSecret
)

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Azure Container Apps Deployment" -ForegroundColor Cyan
Write-Host "HomeControl Application" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

function Read-UserSecrets {
    param([string]$ProjectPath)
    $result = @{}
    $lines = dotnet user-secrets list --project $ProjectPath 2>&1
    foreach ($line in $lines) {
        if ($line -match '^(.+?)\s*=\s*(.+)$') {
            $result[$Matches[1].Trim()] = $Matches[2].Trim()
        }
    }
    return $result
}

# Function to prompt for input if not provided
function Get-ParameterValue {
    param(
        [string]$ParamName,
        [string]$Prompt,
        [string]$CurrentValue,
        [bool]$IsSecret = $false
    )

    if ([string]::IsNullOrWhiteSpace($CurrentValue)) {
        if ($IsSecret) {
            $secureValue = Read-Host -Prompt $Prompt -AsSecureString
            $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
            return [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
        } else {
            return Read-Host -Prompt $Prompt
        }
    }
    return $CurrentValue
}

# Auto-populate Google secrets from user secrets store if not provided as parameters
if ([string]::IsNullOrWhiteSpace($GoogleClientId) -or [string]::IsNullOrWhiteSpace($GoogleClientSecret)) {
    Write-Host "Loading Google secrets from user secrets store..." -ForegroundColor Yellow
    $backendPath = Join-Path $PSScriptRoot "HomeControlBackEnd"
    $userSecrets = Read-UserSecrets -ProjectPath $backendPath
    if ([string]::IsNullOrWhiteSpace($GoogleClientId))     { $GoogleClientId     = $userSecrets["Google:ClientId"] }
    if ([string]::IsNullOrWhiteSpace($GoogleClientSecret)) { $GoogleClientSecret = $userSecrets["Google:ClientSecret"] }
    if ($GoogleClientId -and $GoogleClientSecret) {
        Write-Host "Google secrets loaded from user secrets store." -ForegroundColor Green
    }
}

# Collect required parameters
$ResourceGroup = Get-ParameterValue -ParamName "ResourceGroup" -Prompt "Enter Azure Resource Group name" -CurrentValue $ResourceGroup
$Location = Get-ParameterValue -ParamName "Location" -Prompt "Enter Azure Location (e.g., eastus, westeurope) [default: eastus]" -CurrentValue $Location
if ([string]::IsNullOrWhiteSpace($Location)) { $Location = "eastus" }

$ContainerAppName = Get-ParameterValue -ParamName "ContainerAppName" -Prompt "Enter Container App name (lowercase, no spaces)" -CurrentValue $ContainerAppName
$GoogleClientId = Get-ParameterValue -ParamName "GoogleClientId" -Prompt "Enter Google OAuth Client ID" -CurrentValue $GoogleClientId
$GoogleClientSecret = Get-ParameterValue -ParamName "GoogleClientSecret" -Prompt "Enter Google OAuth Client Secret" -CurrentValue $GoogleClientSecret -IsSecret $true

# Generate unique names
$ACRName = $ContainerAppName.Replace("-", "") + "acr"
$EnvironmentName = "${ContainerAppName}-env"
$ImageName = "homecontrol"
$Tag = "latest"

Write-Host ""
Write-Host "Deployment Configuration:" -ForegroundColor Yellow
Write-Host "  Resource Group: $ResourceGroup" -ForegroundColor White
Write-Host "  Location: $Location" -ForegroundColor White
Write-Host "  Container App: $ContainerAppName" -ForegroundColor White
Write-Host "  Container Registry: $ACRName" -ForegroundColor White
Write-Host "  Environment: $EnvironmentName" -ForegroundColor White
Write-Host ""

$confirmation = Read-Host "Proceed with deployment? (y/n)"
if ($confirmation -ne 'y') {
    Write-Host "Deployment cancelled." -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Step 1: Checking Azure CLI" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Check if Azure CLI is installed
try {
    az version | Out-Null
    Write-Host "Azure CLI is installed" -ForegroundColor Green
} catch {
    Write-Host "Azure CLI is not installed!" -ForegroundColor Red
    Write-Host "Please install from: https://aka.ms/installazurecliwindows" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Step 2: Logging in to Azure" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Check if already logged in
$account = az account show 2>$null | ConvertFrom-Json
if ($null -eq $account) {
    Write-Host "Please login to Azure..." -ForegroundColor Yellow
    az login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Azure login failed!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Already logged in as: $($account.user.name)" -ForegroundColor Green
    Write-Host "Subscription: $($account.name)" -ForegroundColor Green
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Step 3: Installing Azure Extensions" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Install/upgrade Container Apps extension
Write-Host "Installing Container Apps extension..." -ForegroundColor Yellow
az extension add --name containerapp --upgrade --yes 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Container Apps extension ready" -ForegroundColor Green
}

# Register required providers
Write-Host "Registering Azure providers..." -ForegroundColor Yellow
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait
Write-Host "Providers registered" -ForegroundColor Green

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Step 4: Creating Resource Group" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Create resource group
$rgExists = az group exists --name $ResourceGroup
if ($rgExists -eq "true") {
    Write-Host "Resource group '$ResourceGroup' already exists" -ForegroundColor Yellow
} else {
    Write-Host "Creating resource group '$ResourceGroup'..." -ForegroundColor Yellow
    az group create --name $ResourceGroup --location $Location
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to create resource group!" -ForegroundColor Red
        exit 1
    }
    Write-Host "Resource group created" -ForegroundColor Green
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Step 5: Creating Container Registry" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Create Azure Container Registry
Write-Host "Creating Azure Container Registry '$ACRName'..." -ForegroundColor Yellow
az acr create --resource-group $ResourceGroup --name $ACRName --sku Basic --admin-enabled true 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ACR might already exist or name is taken, continuing..." -ForegroundColor Yellow
}
Write-Host "Container Registry ready" -ForegroundColor Green

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Step 6: Building Docker Image" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Build and push image to ACR
Write-Host "Building and pushing Docker image (this may take several minutes)..." -ForegroundColor Yellow
az acr build --registry $ACRName --image "${ImageName}:${Tag}" .
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "Docker image built and pushed successfully" -ForegroundColor Green

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Step 7: Creating Container App Environment" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Create Container Apps environment
Write-Host "Creating Container Apps environment..." -ForegroundColor Yellow
az containerapp env create --name $EnvironmentName --resource-group $ResourceGroup --location $Location 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Environment might already exist, continuing..." -ForegroundColor Yellow
}
Write-Host "Container Apps environment ready" -ForegroundColor Green

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Step 8: Deploying Container App" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Get ACR credentials
Write-Host "Retrieving Container Registry credentials..." -ForegroundColor Yellow
$ACRServer = az acr show --name $ACRName --query loginServer --output tsv
$ACRUsername = az acr credential show --name $ACRName --query username --output tsv
$ACRPassword = az acr credential show --name $ACRName --query passwords[0].value --output tsv

# Deploy container app
Write-Host "Deploying container app..." -ForegroundColor Yellow
az containerapp create `
    --name $ContainerAppName `
    --resource-group $ResourceGroup `
    --environment $EnvironmentName `
    --image "${ACRServer}/${ImageName}:${Tag}" `
    --registry-server $ACRServer `
    --registry-username $ACRUsername `
    --registry-password $ACRPassword `
    --target-port 8080 `
    --ingress external `
    --min-replicas 1 `
    --max-replicas 3 `
    --cpu 0.5 `
    --memory 1.0Gi `
    --secrets google-client-id=$GoogleClientId google-client-secret=$GoogleClientSecret `
    --env-vars "Google__ClientId=secretref:google-client-id" "Google__ClientSecret=secretref:google-client-secret" "ASPNETCORE_ENVIRONMENT=Production"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Container app deployment failed!" -ForegroundColor Red
    Write-Host "The app might already exist. Trying to update instead..." -ForegroundColor Yellow

    # Try to update existing app
    az containerapp update `
        --name $ContainerAppName `
        --resource-group $ResourceGroup `
        --image "${ACRServer}/${ImageName}:${Tag}" `
        --set-env-vars "Google__ClientId=secretref:google-client-id" "Google__ClientSecret=secretref:google-client-secret"

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Update also failed. Please check Azure portal for errors." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Container app deployed successfully" -ForegroundColor Green

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Step 9: Getting Application URL" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Get the application URL
$AppUrl = az containerapp show --name $ContainerAppName --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn --output tsv

Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "Deployment Completed Successfully!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Application URL:" -ForegroundColor Cyan
Write-Host "  https://$AppUrl" -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANT: Update Google OAuth Redirect URIs" -ForegroundColor Yellow
Write-Host "  1. Go to: https://console.cloud.google.com/" -ForegroundColor White
Write-Host "  2. Navigate to your OAuth 2.0 Client ID" -ForegroundColor White
Write-Host "  3. Add this Authorized redirect URI:" -ForegroundColor White
Write-Host "     https://$AppUrl/signin-google" -ForegroundColor Cyan
Write-Host ""
Write-Host "Useful Commands:" -ForegroundColor Yellow
Write-Host "  View logs:" -ForegroundColor White
Write-Host "    az containerapp logs show --name $ContainerAppName --resource-group $ResourceGroup --follow" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Update secrets:" -ForegroundColor White
Write-Host "    az containerapp secret set --name $ContainerAppName --resource-group $ResourceGroup --secrets google-client-id=NEW_ID google-client-secret=NEW_SECRET" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Scale app:" -ForegroundColor White
Write-Host "    az containerapp update --name $ContainerAppName --resource-group $ResourceGroup --min-replicas 1 --max-replicas 5" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Delete resources:" -ForegroundColor White
Write-Host "    az group delete --name $ResourceGroup --yes" -ForegroundColor Cyan
Write-Host ""
Write-Host "For more information, see AZURE_DEPLOYMENT.md" -ForegroundColor Yellow
Write-Host ""
