# Development mode script - runs both backend and frontend with hot reload
# This script kills any existing instances and starts fresh

Write-Host "HomeControl Development Mode" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""

# Kill existing processes
Write-Host "Stopping any existing instances..." -ForegroundColor Yellow

# Kill dotnet processes running on port 7000
$dotnetProcesses = Get-Process | Where-Object { $_.ProcessName -eq "dotnet" }
if ($dotnetProcesses) {
    Write-Host "Stopping .NET backend processes..." -ForegroundColor Yellow
    $dotnetProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Kill node processes running on port 3000
$nodeProcesses = Get-Process | Where-Object { $_.ProcessName -eq "node" }
if ($nodeProcesses) {
    Write-Host "Stopping Node.js frontend processes..." -ForegroundColor Yellow
    $nodeProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "Starting HomeControl in development mode..." -ForegroundColor Green
Write-Host ""

# Start backend
Write-Host "Starting backend on https://localhost:7000..." -ForegroundColor Cyan
$backendPath = Join-Path $PSScriptRoot "HomeControlBackEnd"
$backendJob = Start-Job -ScriptBlock {
    param($path)
    Set-Location $path
    $env:ASPNETCORE_ENVIRONMENT = "Development"
    dotnet run --launch-profile https
} -ArgumentList $backendPath -Name "HomeControl-Backend"

# Wait a bit for backend to start
Start-Sleep -Seconds 5

# Start frontend
Write-Host "Starting frontend on http://localhost:3000..." -ForegroundColor Cyan
$frontendPath = Join-Path $PSScriptRoot "HomeControlFrontEnd"
$frontendJob = Start-Job -ScriptBlock {
    param($path)
    Set-Location $path
    npm run dev
} -ArgumentList $frontendPath -Name "HomeControl-Frontend"

Write-Host ""
Write-Host "=============================" -ForegroundColor Green
Write-Host "Development environment started!" -ForegroundColor Green
Write-Host "=============================" -ForegroundColor Green
Write-Host ""
Write-Host "Frontend:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "Backend:   https://localhost:7000" -ForegroundColor Cyan
Write-Host "OpenAPI:   https://localhost:7000/openapi/v1.json" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host ""

# Keep the script running and display job output
while ($true) {
    $backendJob = Get-Job -Name "HomeControl-Backend" -ErrorAction SilentlyContinue
    $frontendJob = Get-Job -Name "HomeControl-Frontend" -ErrorAction SilentlyContinue
    
    if ($null -eq $backendJob -or $null -eq $frontendJob) {
        Write-Host "One or more services have stopped." -ForegroundColor Red
        break
    }
    
    Start-Sleep -Seconds 1
}

# Cleanup
Write-Host ""
Write-Host "Cleaning up..." -ForegroundColor Yellow
Get-Job | Stop-Job -ErrorAction SilentlyContinue
Get-Job | Remove-Job -ErrorAction SilentlyContinue
Write-Host "Development environment stopped." -ForegroundColor Green
