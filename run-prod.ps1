# Production mode script - builds frontend and serves it from backend

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

Write-Host "HomeControl Production Mode" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""

# Build frontend
Write-Host "Building frontend..." -ForegroundColor Yellow
$frontendPath = Join-Path $PSScriptRoot "HomeControlFrontEnd"
Set-Location $frontendPath

Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
npm install

Write-Host "Building frontend for production..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Frontend build completed successfully!" -ForegroundColor Green
Write-Host ""

# Copy frontend dist to backend wwwroot
Write-Host "Copying frontend build to backend..." -ForegroundColor Yellow
$backendPath = Join-Path $PSScriptRoot "HomeControlBackEnd"
$wwwrootPath = Join-Path $backendPath "wwwroot"

# Remove existing wwwroot if it exists
if (Test-Path $wwwrootPath) {
    Remove-Item $wwwrootPath -Recurse -Force
}

# Create wwwroot and copy dist contents
New-Item -ItemType Directory -Path $wwwrootPath -Force | Out-Null
Copy-Item -Path (Join-Path $frontendPath "dist\*") -Destination $wwwrootPath -Recurse -Force

Write-Host "Frontend files copied to backend!" -ForegroundColor Green
Write-Host ""

# Build backend
Write-Host "Building backend..." -ForegroundColor Yellow
Set-Location $backendPath

Write-Host "Restoring backend dependencies..." -ForegroundColor Yellow
dotnet restore

Write-Host "Building backend for production..." -ForegroundColor Yellow
dotnet build -c Release

if ($LASTEXITCODE -ne 0) {
    Write-Host "Backend build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Backend build completed successfully!" -ForegroundColor Green
Write-Host ""

# Publish backend
Write-Host "Publishing backend..." -ForegroundColor Yellow
$publishPath = Join-Path $backendPath "bin\Release\publish"

dotnet publish -c Release -o $publishPath

if ($LASTEXITCODE -ne 0) {
    Write-Host "Backend publish failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "============================" -ForegroundColor Green
Write-Host "Production build completed!" -ForegroundColor Green
Write-Host "============================" -ForegroundColor Green
Write-Host ""
Write-Host "Published application location:" -ForegroundColor Cyan
Write-Host $publishPath -ForegroundColor Green
Write-Host ""

# Load secrets from user secrets store
Write-Host "Loading secrets from user secrets store..." -ForegroundColor Yellow
$secrets = Read-UserSecrets -ProjectPath $backendPath
$env:Google__ClientId     = $secrets["Google:ClientId"]
$env:Google__ClientSecret = $secrets["Google:ClientSecret"]

if (-not $env:Google__ClientId -or -not $env:Google__ClientSecret) {
    Write-Host "Warning: Google secrets not found in user secrets store." -ForegroundColor Yellow
    Write-Host "Run: dotnet user-secrets set `"Google:ClientId`" `"<id>`" --project HomeControlBackEnd" -ForegroundColor Cyan
    Write-Host "Run: dotnet user-secrets set `"Google:ClientSecret`" `"<secret>`" --project HomeControlBackEnd" -ForegroundColor Cyan
} else {
    Write-Host "Google secrets loaded." -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting application..." -ForegroundColor Yellow
$env:ASPNETCORE_ENVIRONMENT = "Production"
Set-Location $publishPath
.\HomeControlBackEnd.exe

Write-Host ""
Write-Host "The application will be available at: https://localhost:7000" -ForegroundColor Cyan
Write-Host ""
