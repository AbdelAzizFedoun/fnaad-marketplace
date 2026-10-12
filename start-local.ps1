$workspaceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

$lanIp = @(
    foreach ($adapter in [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
        if ($adapter.OperationalStatus -ne [System.Net.NetworkInformation.OperationalStatus]::Up -or
            $adapter.NetworkInterfaceType -eq [System.Net.NetworkInformation.NetworkInterfaceType]::Loopback -or
            -not $adapter.GetIPProperties().GatewayAddresses) {
            continue
        }

        foreach ($address in $adapter.GetIPProperties().UnicastAddresses) {
            $ip = $address.Address
            if ($ip.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
                -not $ip.ToString().StartsWith('169.254.')) {
                $ip.ToString()
            }
        }
    }
) | Select-Object -First 1

if (-not $lanIp) {
    throw "No active IPv4 network connection was found. Connect to Wi-Fi or Ethernet, then run this script again."
}

$apiOrigin = "http://${lanIp}:8000"

function Set-EnvValue {
    param([string]$Path, [string]$Name, [string]$Value)

    $content = Get-Content -LiteralPath $Path -Raw
    $entry = "${Name}=${Value}"
    if ($content -match "(?m)^$([regex]::Escape($Name))=") {
        $content = [regex]::Replace($content, "(?m)^$([regex]::Escape($Name))=.*$", $entry)
    } else {
        $content = $content.TrimEnd() + [Environment]::NewLine + $entry + [Environment]::NewLine
    }
    Set-Content -LiteralPath $Path -Value $content -NoNewline
}

Set-EnvValue "$workspaceRoot\fnaad-frontend\.env" "EXPO_PUBLIC_API_BASE_URL" "$apiOrigin/api"
Set-EnvValue "$workspaceRoot\fnaad-frontend\.env" "EXPO_PUBLIC_API_ORIGIN" $apiOrigin
Set-EnvValue "$workspaceRoot\fnaad-admin\.env" "VITE_API_BASE_URL" "$apiOrigin/api"

Write-Host "Using local network address: $apiOrigin"

Start-Process powershell.exe -ArgumentList @(
    '-NoExit',
    '-Command',
    "`$env:SITE_BASE_URL='$apiOrigin'; Set-Location '$workspaceRoot\fnaad-backend'; .\venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000"
)

Start-Process powershell.exe -ArgumentList @(
    '-NoExit',
    '-Command',
    "Set-Location '$workspaceRoot\fnaad-frontend'; npx.cmd expo start -c"
)

Start-Process powershell.exe -ArgumentList @(
    '-NoExit',
    '-Command',
    "Set-Location '$workspaceRoot\fnaad-admin'; npx.cmd vite --host 0.0.0.0"
)
