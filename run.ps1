# Starts the API (http://localhost:5027) and the UI (http://localhost:4200). Ctrl+C stops both.
# The API is published (Debug) into <repo>/bin and runs from there, so `dotnet build`/`dotnet test`
# never lock the running DLLs. Data lives in <repo>/bin/data; publish never deletes it.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$bin = "$root/bin"
$apiExe = [IO.Path]::GetFullPath("$bin/BookReader.Api.exe")

if (-not (Test-Path "$root/web/node_modules")) {
    Push-Location "$root/web"; npm ci; Pop-Location
}

# A previous instance running from bin would lock the files we are about to overwrite.
Get-Process BookReader.Api -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -eq $apiExe } |
    ForEach-Object { Stop-Process -Id $_.Id -Force; Wait-Process -Id $_.Id -Timeout 10 -ErrorAction SilentlyContinue }

dotnet publish "$root/src/BookReader.Api" -c Debug -o $bin --nologo -v q
if ($LASTEXITCODE -ne 0) { throw 'dotnet publish failed' }

$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:ASPNETCORE_URLS = 'http://localhost:5027'
$api = Start-Process $apiExe -WorkingDirectory $bin -PassThru -NoNewWindow
try {
    Push-Location "$root/web"
    npm start
} finally {
    Pop-Location
    Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue
}
