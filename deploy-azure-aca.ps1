# Azure Container Apps Deployment Script for HomeControl
# For Azure Container Instances deployment, use deploy-azure.ps1 instead.

param(
    [string]$ResourceGroup,
    [string]$Location = "eastus",
    [string]$AppName,
    [string]$GoogleClientId,
    [string]$GoogleClientSecret,
    [switch]$AutoDeploy
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

# Collect required parameters — in AutoDeploy mode, missing values are a fatal error
if ($AutoDeploy) {
    $missing = @()
    if ([string]::IsNullOrWhiteSpace($ResourceGroup))      { $missing += "ResourceGroup" }
    if ([string]::IsNullOrWhiteSpace($AppName))            { $missing += "AppName" }
    if ([string]::IsNullOrWhiteSpace($GoogleClientId))     { $missing += "GoogleClientId (set via user secrets or -GoogleClientId)" }
    if ([string]::IsNullOrWhiteSpace($GoogleClientSecret)) { $missing += "GoogleClientSecret (set via user secrets or -GoogleClientSecret)" }
    if ($missing.Count -gt 0) {
        Write-Host "ERROR: Missing required parameters for -AutoDeploy mode:" -ForegroundColor Red
        $missing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
        Write-Host ""
        Write-Host "Set credentials via user secrets:" -ForegroundColor Yellow
        Write-Host "  dotnet user-secrets set `"Google:ClientId`" `"YOUR_ID`" --project HomeControlBackEnd" -ForegroundColor Cyan
        Write-Host "  dotnet user-secrets set `"Google:ClientSecret`" `"YOUR_SECRET`" --project HomeControlBackEnd" -ForegroundColor Cyan
        exit 1
    }
} else {
    $ResourceGroup = Get-ParameterValue -ParamName "ResourceGroup" -Prompt "Enter Azure Resource Group name"                                       -CurrentValue $ResourceGroup
    $Location      = Get-ParameterValue -ParamName "Location"      -Prompt "Enter Azure Location (e.g., eastus, westeurope) [default: eastus]"     -CurrentValue $Location
    $AppName       = Get-ParameterValue -ParamName "AppName"       -Prompt "Enter Container App name (lowercase, hyphens ok e.g. homecontrol-app)" -CurrentValue $AppName
    $GoogleClientId      = Get-ParameterValue -ParamName "GoogleClientId"      -Prompt "Enter Google OAuth Client ID"     -CurrentValue $GoogleClientId
    $GoogleClientSecret  = Get-ParameterValue -ParamName "GoogleClientSecret"  -Prompt "Enter Google OAuth Client Secret" -CurrentValue $GoogleClientSecret -IsSecret $true
}

if ([string]::IsNullOrWhiteSpace($Location)) { $Location = "eastus" }

# Derive resource names
$ACRName         = $AppName.Replace("-", "").ToLower() + "acr"
$EnvironmentName = "$AppName-env"
$ImageName       = "homecontrol"
$Tag             = "latest"

Write-Host ""
Write-Host "Deployment Configuration:" -ForegroundColor Yellow
Write-Host "  Resource Group:      $ResourceGroup" -ForegroundColor White
Write-Host "  Location:            $Location" -ForegroundColor White
Write-Host "  Container App:       $AppName" -ForegroundColor White
Write-Host "  Container Registry:  $ACRName" -ForegroundColor White
Write-Host "  Environment:         $EnvironmentName" -ForegroundColor White
Write-Host "  App URL (after):     https://$AppName.<hash>.$Location.azurecontainerapps.io" -ForegroundColor White
Write-Host ""

if (-not $AutoDeploy) {
    $confirmation = Read-Host "Proceed with deployment? (y/n)"
    if ($confirmation -ne 'y') {
        Write-Host "Deployment cancelled." -ForegroundColor Red
        exit 0
    }
} else {
    Write-Host "Auto-deploy enabled, skipping confirmation." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Step 1: Checking Azure CLI" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Ensure Azure CLI is on PATH (handles fresh installs where PATH hasn't propagated yet)
$azCliWbin = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin"
if ((Test-Path $azCliWbin) -and ($env:PATH -notlike "*$azCliWbin*")) {
    $env:PATH = "$azCliWbin;$env:PATH"
}

try {
    az version | Out-Null
    Write-Host "Azure CLI is installed" -ForegroundColor Green
} catch {
    Write-Host "Azure CLI is not installed!" -ForegroundColor Red
    Write-Host "Please install from: https://aka.ms/installazurecliwindows" -ForegroundColor Yellow
    exit 1
}

# SSL bypass: a local proxy performs HTTPS inspection using a certificate that
# Python 3.12+ rejects (non-critical Basic Constraints on an intermediate CA).
# We override the 'az' command to call python.exe directly (without the -I isolation
# flag) via a wrapper that disables SSL verification before azure.cli starts.
$azExe = "C:\Program Files\Microsoft SDKs\Azure\CLI2\python.exe"
if (Test-Path $azExe) {
    $azWrapper = "$env:TEMP\homecontrol_az_ssl_bypass.py"
    Set-Content -Path $azWrapper -Encoding ASCII -Value @'
import ssl
ssl._create_default_https_context = ssl._create_unverified_context

import urllib3
urllib3.disable_warnings()

# Patch requests.Session.send to force verify=False on every call.
# urllib3 creates its own SSL contexts so patching ssl alone is not enough.
import requests
_orig_send = requests.Session.send
def _send_no_verify(self, request, **kwargs):
    kwargs["verify"] = False
    return _orig_send(self, request, **kwargs)
requests.Session.send = _send_no_verify

from azure.cli.__main__ import main
main()
'@
    # Force UTF-8 I/O so Azure CLI can stream build logs with Unicode chars (e.g. vite's checkmark)
    $env:PYTHONUTF8 = "1"
    $env:PYTHONIOENCODING = "utf-8"

    function global:az {
        & $azExe -B $script:azWrapper @args
    }
    Write-Host "SSL: proxy-safe az wrapper configured (UTF-8 output enabled)" -ForegroundColor Green
} else {
    Write-Host "Warning: Azure CLI Python not found at expected path; using system az" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Step 2: Logging in to Azure" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

$account = az account show 2>$null | ConvertFrom-Json
if ($null -eq $account) {
    if ($AutoDeploy) {
        Write-Host "Not logged in to Azure. Run 'az login' in a terminal first, then retry." -ForegroundColor Red
        exit 1
    }
    Write-Host "Please login to Azure..." -ForegroundColor Yellow
    az login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Azure login failed!" -ForegroundColor Red
        exit 1
    }
    $account = az account show 2>$null | ConvertFrom-Json
}
Write-Host "Logged in as: $($account.user.name)" -ForegroundColor Green
Write-Host "Subscription: $($account.name)" -ForegroundColor Green

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Step 3: Registering Azure Providers" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

Write-Host "Registering providers..." -ForegroundColor Yellow
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait
Write-Host "Providers registered" -ForegroundColor Green

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Step 4: Installing Container Apps Extension" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

Write-Host "Installing/upgrading Container Apps CLI extension..." -ForegroundColor Yellow
az extension add --name containerapp --upgrade --yes 2>$null
Write-Host "Extension ready" -ForegroundColor Green

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Step 5: Creating Resource Group" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

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
Write-Host "Step 6: Creating Container Registry" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

Write-Host "Creating Azure Container Registry '$ACRName'..." -ForegroundColor Yellow
az acr create --resource-group $ResourceGroup --name $ACRName --sku Basic --admin-enabled true 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ACR might already exist or name is taken, continuing..." -ForegroundColor Yellow
}
Write-Host "Container Registry ready" -ForegroundColor Green

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Step 7: Building Docker Image" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

Write-Host "Building and pushing Docker image (this may take several minutes)..." -ForegroundColor Yellow
az acr build --registry $ACRName --image "${ImageName}:${Tag}" .
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "Docker image built and pushed successfully" -ForegroundColor Green

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Step 8: Creating Container Apps Environment" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

Write-Host "Creating Container Apps environment '$EnvironmentName'..." -ForegroundColor Yellow
az containerapp env create --name $EnvironmentName --resource-group $ResourceGroup --location $Location 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Environment might already exist, continuing..." -ForegroundColor Yellow
}
Write-Host "Container Apps environment ready" -ForegroundColor Green

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Step 9: Deploying Container App" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Get ACR credentials
Write-Host "Retrieving Container Registry credentials..." -ForegroundColor Yellow
$ACRServer   = az acr show --name $ACRName --query loginServer --output tsv
$ACRUsername = az acr credential show --name $ACRName --query username --output tsv
$ACRPassword = az acr credential show --name $ACRName --query "passwords[0].value" --output tsv

Write-Host "Deploying container app..." -ForegroundColor Yellow
az containerapp create `
    --name $AppName `
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
    --secrets "google-client-id=$GoogleClientId" "google-client-secret=$GoogleClientSecret" `
    --env-vars "Google__ClientId=secretref:google-client-id" "Google__ClientSecret=secretref:google-client-secret" "ASPNETCORE_ENVIRONMENT=Production"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Container app creation failed, trying update instead..." -ForegroundColor Yellow

    az containerapp update `
        --name $AppName `
        --resource-group $ResourceGroup `
        --image "${ACRServer}/${ImageName}:${Tag}"

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Deployment failed. Check the Azure portal for details." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Container app deployed successfully" -ForegroundColor Green

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Step 10: Getting Application URL" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

$AppUrl = az containerapp show `
    --name $AppName `
    --resource-group $ResourceGroup `
    --query properties.configuration.ingress.fqdn `
    --output tsv

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
Write-Host "    az containerapp logs show --name $AppName --resource-group $ResourceGroup --follow" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Update secrets:" -ForegroundColor White
Write-Host "    az containerapp secret set --name $AppName --resource-group $ResourceGroup --secrets google-client-id=NEW_ID google-client-secret=NEW_SECRET" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Scale app:" -ForegroundColor White
Write-Host "    az containerapp update --name $AppName --resource-group $ResourceGroup --min-replicas 1 --max-replicas 5" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Delete all resources:" -ForegroundColor White
Write-Host "    az group delete --name $ResourceGroup --yes" -ForegroundColor Cyan
Write-Host ""
