# Local Docker Testing Script for HomeControl
# This script builds and runs the Docker container locally

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

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "HomeControl Docker Local Test" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker..." -ForegroundColor Yellow
try {
    docker version | Out-Null
    Write-Host "Docker is running" -ForegroundColor Green
} catch {
    Write-Host "Docker is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Step 1: Building Docker Image" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This may take several minutes..." -ForegroundColor Yellow
Write-Host ""

# Build the Docker image
docker build -t homecontrol:test .

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Docker build failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Docker image built successfully!" -ForegroundColor Green

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Step 2: Starting Container" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Stop and remove existing container if it exists
Write-Host "Cleaning up existing container..." -ForegroundColor Yellow
docker stop homecontrol-test 2>$null
docker rm homecontrol-test 2>$null

# Read credentials from user secrets store
$backendPath = Join-Path $PSScriptRoot "HomeControlBackEnd"
Write-Host "Loading secrets from user secrets store..." -ForegroundColor Yellow
$secrets = Read-UserSecrets -ProjectPath $backendPath
$GoogleClientId     = $secrets["Google:ClientId"]
$GoogleClientSecret = $secrets["Google:ClientSecret"]

if (-not $GoogleClientId -or -not $GoogleClientSecret) {
    Write-Host "Google secrets not found in user secrets store. Please enter manually." -ForegroundColor Yellow
    $GoogleClientId = Read-Host "Enter Google Client ID"
    $secureSecret = Read-Host "Enter Google Client Secret" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureSecret)
    $GoogleClientSecret = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
} else {
    Write-Host "Google secrets loaded from user secrets store." -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting container..." -ForegroundColor Yellow

# Run the container
docker run -d `
    --name homecontrol-test `
    -p 8080:8080 `
    -p 8081:8081 `
    -e "ASPNETCORE_ENVIRONMENT=Production" `
    -e "ASPNETCORE_URLS=http://+:8080;https://+:8081" `
    -e "ASPNETCORE_Kestrel__Certificates__Default__Password=YourSecurePassword123!" `
    -e "ASPNETCORE_Kestrel__Certificates__Default__Path=/app/aspnetapp.pfx" `
    -e "Google__ClientId=$GoogleClientId" `
    -e "Google__ClientSecret=$GoogleClientSecret" `
    homecontrol:test

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Failed to start container!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Container started successfully!" -ForegroundColor Green

# Wait a moment for the container to start
Write-Host ""
Write-Host "Waiting for application to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Show container logs
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Container Logs (last 20 lines)" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
docker logs homecontrol-test --tail 20

Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "Container is Running!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Application URLs:" -ForegroundColor Cyan
Write-Host "  HTTP:  http://localhost:8080" -ForegroundColor White
Write-Host "  HTTPS: https://localhost:8081" -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANT: For Google OAuth to work locally:" -ForegroundColor Yellow
Write-Host "  1. Go to: https://console.cloud.google.com/" -ForegroundColor White
Write-Host "  2. Navigate to your OAuth 2.0 Client ID" -ForegroundColor White
Write-Host "  3. Make sure these redirect URIs are added:" -ForegroundColor White
Write-Host "     http://localhost:8080/signin-google" -ForegroundColor Cyan
Write-Host "     https://localhost:8081/signin-google" -ForegroundColor Cyan
Write-Host ""
Write-Host "NOTE: HTTPS uses a self-signed certificate." -ForegroundColor Yellow
Write-Host "You may see a security warning in your browser - this is normal for development." -ForegroundColor Yellow
Write-Host "Click 'Advanced' and 'Proceed' to continue." -ForegroundColor Yellow
Write-Host ""
Write-Host "Useful Commands:" -ForegroundColor Yellow
Write-Host "  View live logs:" -ForegroundColor White
Write-Host "    docker logs homecontrol-test -f" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Stop container:" -ForegroundColor White
Write-Host "    docker stop homecontrol-test" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Remove container:" -ForegroundColor White
Write-Host "    docker rm homecontrol-test" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Restart container:" -ForegroundColor White
Write-Host "    docker restart homecontrol-test" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Execute shell in container:" -ForegroundColor White
Write-Host "    docker exec -it homecontrol-test /bin/sh" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop viewing logs, then run:" -ForegroundColor Yellow
Write-Host "  docker logs homecontrol-test -f" -ForegroundColor Cyan
Write-Host ""
