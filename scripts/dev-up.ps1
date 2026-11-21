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

# Windows (Hyper-V / WSL / Docker Desktop) reserves port ranges that nobody can
# bind, and Vite then fails with EACCES. Say so plainly instead of failing silently.
function Test-Excluded([int]$Port) {
  $out = netsh int ipv4 show excludedportrange protocol=tcp 2>$null
  foreach ($line in $out) {
    if ($line -match '^\s*(\d+)\s+(\d+)') { if ($Port -ge [int]$Matches[1] -and $Port -le [int]$Matches[2]) { return $true } }
  }
  return $false
}
foreach ($k in 'PEMO_GO_API_PORT','PEMO_GO_WEB_PORT','PEMO_GO_PORTAL_PORT','PEMO_GO_DEMO_PORT') {
  if (Test-Excluded $ports[$k]) {
    throw "[pemo-go] port $($ports[$k]) ($k) is inside a range Windows has reserved (netsh int ipv4 show excludedportrange protocol=tcp). Pick a free port in scripts\ports.env and the matching vite.config.ts."
  }
}

# The API needs database\dev\.env and the database; the UIs and the demo
# server do not (the UIs read their fixture corpus, the demo server is in memory).
$startApi = $true
if (-not (Test-Path 'database\dev\.env')) {
  Write-Warning "[pemo-go] database\dev\.env is missing - starting WITHOUT the API (copy database\dev\.env.example and set the passwords to get it)"
  $startApi = $false
} elseif (-not (Test-Listening $ports.PEMO_GO_DB_PORT)) {
  Write-Warning "[pemo-go] no database on 127.0.0.1:$($ports.PEMO_GO_DB_PORT) - starting WITHOUT the API. Start it: docker compose --env-file database\dev\.env -f database\dev\docker-compose.yml up -d ; then backend\bin\pemo.exe bootstrap --with-seed"
  $startApi = $false
}
if ($startApi) { Require-Free $ports.PEMO_GO_API_PORT 'api' }
Require-Free $ports.PEMO_GO_DEMO_PORT 'demo'
if (-not $NoUi) { Require-Free $ports.PEMO_GO_WEB_PORT 'management-web'; Require-Free $ports.PEMO_GO_PORTAL_PORT 'resident-portal' }

# The UIs need Node 22.6+ and pnpm. Check before starting anything, and use
# pnpm through corepack (bundled with Node) when pnpm itself is not installed.
$Pnpm = @()
if (-not $NoUi) {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw '[pemo-go] Node.js is not installed (needed for the web UIs). Install the LTS from https://nodejs.org, open a NEW PowerShell window and run this again. (Backend only: add -NoUi)'
  }
  $nodeVer = (node -v) -replace '^v',''
  if ([version]$nodeVer -lt [version]'22.6.0') { throw "[pemo-go] Node $nodeVer is too old for the UIs; 22.6+ is required. Install the LTS from https://nodejs.org" }
  if (Get-Command pnpm -ErrorAction SilentlyContinue) { $Pnpm = @('pnpm') }
  elseif (Get-Command corepack -ErrorAction SilentlyContinue) { $Pnpm = @('corepack', 'pnpm'); Write-Host '[pemo-go] pnpm not on PATH - using it through corepack' }
  else { $Pnpm = @('npx', '--yes', 'pnpm@11'); Write-Host '[pemo-go] pnpm not on PATH - using it through npx' }
}

if (Get-Command go -ErrorAction SilentlyContinue) {
  Write-Host '[pemo-go] building backend'
  Push-Location backend; go build -o bin\ ./cmd/...; Pop-Location
} elseif (-not (Test-Path 'backend\bin\pemo-api.exe')) {
  throw '[pemo-go] Go is not installed and backend\bin\pemo-api.exe is missing'
} else { Write-Host '[pemo-go] Go not found - using the prebuilt backend\bin\*.exe' }

function Start-Logged([string]$Name, [string]$File, [string[]]$ArgList, [hashtable]$Env = @{}) {
  foreach ($k in $Env.Keys) { Set-Item "env:$k" $Env[$k] }
  # Start-Process refuses an empty -ArgumentList, so pass it only when there are arguments.
  $sp = @{ FilePath = $File; PassThru = $true; WindowStyle = 'Hidden'
          RedirectStandardOutput = (Join-Path $Run "$Name.log"); RedirectStandardError = (Join-Path $Run "$Name.err.log") }
  if ($ArgList -and $ArgList.Count -gt 0) { $sp.ArgumentList = $ArgList }
  $p = Start-Process @sp
  Set-Content (Join-Path $Run "$Name.pid") $p.Id
  Write-Host "[pemo-go] $Name started (pid $($p.Id), log .run\$Name.log)"
}
if ($startApi) { Start-Logged 'api' 'backend\bin\pemo-api.exe' @('-root', "$Repo") @{ PEMO_HTTP_PORT = "$($ports.PEMO_GO_API_PORT)" } }
Start-Logged 'demo' 'backend\bin\pemo-demo.exe' $null              @{ PEMO_DEMO_PORT = "$($ports.PEMO_GO_DEMO_PORT)" }
if (-not $NoUi) {
  if (-not (Test-Path 'node_modules')) {
    Write-Host '[pemo-go] installing UI packages (first run, a few minutes)'
    $rest = @($Pnpm | Select-Object -Skip 1) + @('install', '--no-frozen-lockfile')
    & $Pnpm[0] @rest
    if ($LASTEXITCODE -ne 0) { throw '[pemo-go] pnpm install failed - see the output above' }
  }
  Start-Logged 'management-web'  'cmd.exe' (@('/c') + $Pnpm + @('-C', 'apps\management-web', 'dev'))
  Start-Logged 'resident-portal' 'cmd.exe' (@('/c') + $Pnpm + @('-C', 'apps\resident-portal', 'dev'))
}

# Wait for each port and show the log of anything that did not come up.
function Wait-Port([int]$Port, [string]$Name, [int]$Seconds) {
  for ($i = 0; $i -lt $Seconds; $i++) { if (Test-Listening $Port) { Write-Host "[pemo-go] $Name up      http://127.0.0.1:$Port"; return }; Start-Sleep 1 }
  Write-Warning "[pemo-go] $Name did NOT come up on $Port. Last log lines:"
  foreach ($f in "$Name.log", "$Name.err.log") { $p = Join-Path $Run $f; if (Test-Path $p) { Get-Content $p -Tail 15 | ForEach-Object { "    $_" } } }
}
if ($startApi) { Wait-Port $ports.PEMO_GO_API_PORT 'api' 15 }
Wait-Port $ports.PEMO_GO_DEMO_PORT 'demo' 10
if (-not $NoUi) { Wait-Port $ports.PEMO_GO_WEB_PORT 'management-web' 90; Wait-Port $ports.PEMO_GO_PORTAL_PORT 'resident-portal' 90 }
