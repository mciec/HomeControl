ssh mciec@rpi0-2 pkill -f 'LedStripeChristmasTree.dll'
ssh mciec@rpi0-2 rm -f -r -d ~/projects/LedStripeChristmasTree
ssh mciec@rpi0-2 mkdir ~/projects
ssh mciec@rpi0-2 mkdir ~/projects/LedStripeChristmasTree
scp -r bin\Debug\net8.0\publish\linux-arm64\* mciec@rpi0-2:~/projects/LedStripeChristmasTree
$secrets = dotnet user-secrets --id 1642040a-dd0e-4797-a968-d0e638a2eec7 list
$secretsCommand = "export DOTNET_LEDSTRIPECHRISTMASTREE_" + $secrets.Replace(":", "__").Replace(" ", "")
Write-Host $secretsCommand
$sshRunCommand = $secretsCommand + " && cd ~/projects/LedStripeChristmasTree && /opt/dotnet/dotnet LedStripeChristmasTree.dll"
Write-Host $sshRunCommand
ssh mciec@rpi0-2 $sshRunCommand
