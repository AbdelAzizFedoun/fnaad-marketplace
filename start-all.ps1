# One-command startup for FNAAD: PostgreSQL + Django backend + ngrok tunnel.
# Run from anywhere:  powershell -File .\start-all.ps1
#
# Then start the frontends yourself:
#   cd fnaad-frontend ; npx expo start -c
#   cd fnaad-admin    ; npx vite

$workspaceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pgBin = "C:\Users\FEDOUN ABDEL-AZIZ\pgsql\pgsql\bin"
$pgData = "C:\Users\FEDOUN ABDEL-AZIZ\pgsql\data"
$pgLog = "C:\Users\FEDOUN ABDEL-AZIZ\pgsql\pg.log"
$ngrok = "C:\Users\FEDOUN ABDEL-AZIZ\AppData\Roaming\npm\node_modules\ngrok\bin\ngrok.exe"
$siteUrl = "https://4115-51-178-86-160.ngrok-free.app"

function Set-EnvValue {
    param([string]$Path, [string]$Name, [string]$Value)
    $content = Get-Content -LiteralPath $Path -Raw
    $entry = "$Name=$Value"
    if ($content -match "(?m)^$([regex]::Escape($Name))=") {
        $content = [regex]::Replace($content, "(?m)^$([regex]::Escape($Name))=.*$", $entry)
    } else {
        $content = $content.TrimEnd() + [Environment]::NewLine + $entry + [Environment]::NewLine
    }
    Set-Content -LiteralPath $Path -Value $content -NoNewline
}

# 1. PostgreSQL — start only if not already running
$pgStatus = & "$pgBin\pg_ctl.exe" -D $pgData status 2>&1 | Out-String
if ($pgStatus -match "server is running") {
    Write-Host "PostgreSQL: already running"
} else {
    & "$pgBin\pg_ctl.exe" -D $pgData -l $pgLog start
    Write-Host "PostgreSQL: started"
}
Start-Sleep -Seconds 2

# 2. Django backend — MUST use the venv Python (system python lacks psycopg)
$backendRunning = $false
try {
    $test = Invoke-WebRequest -Uri "http://localhost:8000/api/catalog/products/" -UseBasicParsing -TimeoutSec 5
    $backendRunning = $true
} catch { }
if ($backendRunning) {
    Write-Host "Backend: already running on :8000"
} else {
    Start-Process powershell.exe -ArgumentList @(
        '-NoExit', '-Command',
        "Set-Location '$workspaceRoot\fnaad-backend'; .\venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000"
    )
    Write-Host "Backend: starting on :8000 (keep that window open)"
}
Start-Sleep -Seconds 6

# 3. ngrok tunnel — reuse if already up, otherwise start
$tunnelUp = $false
try {
    $t = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -TimeoutSec 3
    if ($t.tunnels.Count -gt 0) {
        $siteUrl = $t.tunnels[0].public_url
        $tunnelUp = $true
    }
} catch { }

if ($tunnelUp) {
    Write-Host "ngrok: already tunneling at $siteUrl"
} else {
    Start-Process $ngrok -ArgumentList "http", "8000"
    Start-Sleep -Seconds 5
    try {
        $t = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -TimeoutSec 3
        if ($t.tunnels.Count -gt 0) {
            $siteUrl = $t.tunnels[0].public_url
        }
    } catch { }
    Write-Host "ngrok: started tunnel at $siteUrl"
}

# 4. Point both frontends and backend at the public ngrok URL
Set-EnvValue "$workspaceRoot\fnaad-frontend\.env" "EXPO_PUBLIC_API_BASE_URL" "$siteUrl/api"
Set-EnvValue "$workspaceRoot\fnaad-frontend\.env" "EXPO_PUBLIC_API_ORIGIN" $siteUrl
Set-EnvValue "$workspaceRoot\fnaad-admin\.env" "VITE_API_BASE_URL" "$siteUrl/api"
Set-EnvValue "$workspaceRoot\fnaad-backend\.env" "SITE_BASE_URL" $siteUrl

Write-Host ""
Write-Host "Ready:"
Write-Host "  API (local): http://localhost:8000/api"
Write-Host "  API (public): $siteUrl/api"
Write-Host "  Next: cd fnaad-frontend; npx expo start -c"
Write-Host "        cd fnaad-admin; npx vite"
