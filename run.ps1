# Starts the API (http://localhost:5027) and the UI (http://localhost:4200). Ctrl+C stops both.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

if (-not (Test-Path "$root/web/node_modules")) {
    Push-Location "$root/web"; npm ci; Pop-Location
}

$api = Start-Process dotnet -ArgumentList 'run', '--project', "$root/src/BookReader.Api", '--launch-profile', 'http' -PassThru -NoNewWindow
try {
    Push-Location "$root/web"
    npm start
} finally {
    Pop-Location
    # /T also kills the child process tree (dotnet run spawns the real server).
    taskkill /PID $api.Id /T /F | Out-Null
}
