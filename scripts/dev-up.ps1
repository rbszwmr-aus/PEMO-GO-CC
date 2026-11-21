# Start the PEMO Go stack on Windows, on its own ports, refusing to touch a
# port that is already taken (another project's service is never stopped).
#
#   powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1            # API, demo, both UIs
#   powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1 -NoUi      # backend only
#   powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1 -Stop      # stop what it started
param([switch]$NoUi, [switch]$Stop)
$ErrorActionPreference = 'Stop'
$Repo = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $Repo
$ports = @{}
Get-Content (Join-Path $PSScriptRoot 'ports.env') | Where-Object { $_ -match '^\s*([A-Z_]+)=(\d+)' } | ForEach-Object { $ports[$Matches[1]] = [int]$Matches[2] }
$Run = Join-Path $Repo '.run'; New-Item -ItemType Directory -Force $Run | Out-Null

if ($Stop) {
  Get-ChildItem $Run -Filter *.pid -ErrorAction SilentlyContinue | ForEach-Object {
    $id = [int](Get-Content $_.FullName); Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
    Write-Host "[pemo-go] stopped $($_.BaseName) ($id)"; Remove-Item $_.FullName
  }
  exit 0
}

function Test-Listening([int]$Port) { [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) }
function Require-Free([int]$Port, [string]$What) {
  if (Test-Listening $Port) { throw "[pemo-go] port $Port ($What) is already in use - not ours, refusing to start. Free it or change scripts\ports.env." }
}

if (-not (Test-Path 'database\dev\.env')) { throw "[pemo-go] database\dev\.env is missing: copy database\dev\.env.example and set the passwords" }
if (-not (Test-Listening $ports.PEMO_GO_DB_PORT)) {
  throw "[pemo-go] no database on 127.0.0.1:$($ports.PEMO_GO_DB_PORT). Start it: docker compose --env-file database\dev\.env -f database\dev\docker-compose.yml up -d ; then backend\bin\pemo.exe bootstrap --with-seed"
}
Require-Free $ports.PEMO_GO_API_PORT 'api'
Require-Free $ports.PEMO_GO_DEMO_PORT 'demo'
if (-not $NoUi) { Require-Free $ports.PEMO_GO_WEB_PORT 'management-web'; Require-Free $ports.PEMO_GO_PORTAL_PORT 'resident-portal' }

if (Get-Command go -ErrorAction SilentlyContinue) {
  Write-Host '[pemo-go] building backend'
  Push-Location backend; go build -o bin\ ./cmd/...; Pop-Location
} elseif (-not (Test-Path 'backend\bin\pemo-api.exe')) {
  throw '[pemo-go] Go is not installed and backend\bin\pemo-api.exe is missing'
} else { Write-Host '[pemo-go] Go not found - using the prebuilt backend\bin\*.exe' }

function Start-Logged([string]$Name, [string]$File, [string[]]$ArgList, [hashtable]$Env = @{}) {
  foreach ($k in $Env.Keys) { Set-Item "env:$k" $Env[$k] }
  $p = Start-Process -FilePath $File -ArgumentList $ArgList -PassThru -WindowStyle Hidden `
       -RedirectStandardOutput (Join-Path $Run "$Name.log") -RedirectStandardError (Join-Path $Run "$Name.err.log")
  Set-Content (Join-Path $Run "$Name.pid") $p.Id
  Write-Host "[pemo-go] $Name started (pid $($p.Id), log .run\$Name.log)"
}
Start-Logged 'api'  'backend\bin\pemo-api.exe'  @('-root', "$Repo") @{ PEMO_HTTP_PORT = "$($ports.PEMO_GO_API_PORT)" }
Start-Logged 'demo' 'backend\bin\pemo-demo.exe' @()                @{ PEMO_DEMO_PORT = "$($ports.PEMO_GO_DEMO_PORT)" }
if (-not $NoUi) {
  if (-not (Test-Path 'node_modules')) { pnpm install }
  Start-Logged 'management-web'  'cmd.exe' @('/c', 'pnpm', '-C', 'apps\management-web', 'dev')
  Start-Logged 'resident-portal' 'cmd.exe' @('/c', 'pnpm', '-C', 'apps\resident-portal', 'dev')
}
Start-Sleep 2
try { Invoke-RestMethod "http://127.0.0.1:$($ports.PEMO_GO_API_PORT)/ready" | Out-Null; Write-Host "[pemo-go] API ready  http://127.0.0.1:$($ports.PEMO_GO_API_PORT)" }
catch { Write-Host "[pemo-go] API not ready yet - see .run\api.log / api.err.log" }
Write-Host "[pemo-go] demo       http://127.0.0.1:$($ports.PEMO_GO_DEMO_PORT)"
if (-not $NoUi) { Write-Host "[pemo-go] UIs        http://127.0.0.1:$($ports.PEMO_GO_WEB_PORT) (management)  http://127.0.0.1:$($ports.PEMO_GO_PORTAL_PORT) (portal)" }
