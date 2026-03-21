$job = Start-Job -ScriptBlock {
    param($path)
    Set-Location $path
    $env:ASPNETCORE_ENVIRONMENT = "Development"
    dotnet run --launch-profile https 2>&1
} -ArgumentList 'D:\shared\repos\HomeControl\HomeControlBackEnd'

Start-Sleep -Seconds 15

$output = Receive-Job -Job $job
Write-Host "=== JOB OUTPUT ==="
$output | ForEach-Object { Write-Host $_ }
Write-Host "=== JOB STATE ==="
$job | Format-List Name, State, HasMoreData
Stop-Job $job
Remove-Job $job
