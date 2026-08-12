$rpi = "192.168.8.20"
#$rpi = 192.168.8.67
Write-Host "RPI address:" $rpi

$projectPath = Join-Path $PSScriptRoot "..\LedStripeWithSensors.csproj"
Write-Host "Building and publishing for linux-arm64..."
dotnet publish $projectPath -p:PublishProfile=FolderProfile
if ($LASTEXITCODE -ne 0) {
    Write-Host "Publish failed, aborting deployment." -ForegroundColor Red
    exit 1
}

ssh mciec@${rpi} pkill -f 'LedStripeWithSensors.dll'
ssh mciec@${rpi} rm ~/projects/LedStripeWithSensors -f -r -d 
ssh mciec@${rpi} mkdir ~/projects
ssh mciec@${rpi} mkdir ~/projects/LedStripeWithSensors
scp -r DevicesAndSensors\RpiLedStripeDevice\LedStripeWithSensors\bin\Debug\net10.0\publish\linux-arm64\* mciec@${rpi}:~/projects/LedStripeWithSensors
$secrets = dotnet user-secrets --id 1c8133fb-92ec-49d1-8df3-ea9190fbddff list
$secretsCommand = "export DOTNET_LEDSTRIPEWITHSENSORS_" + $secrets.Replace(":", "__").Replace(" ", "")
Write-Host $secretsCommand
$sshRunCommand = $secretsCommand + " && cd ~/projects/LedStripeWithSensors && ~/.dotnet/dotnet LedStripeWithSensors.dll"
Write-Host $sshRunCommand
ssh mciec@${rpi} $sshRunCommand
