#!/usr/bin/env bash
# Starts the API (http://localhost:5027) and the UI (http://localhost:4200). Ctrl+C stops both.
# The API is published (Debug) into <repo>/bin and runs from there, so `dotnet build`/`dotnet test`
# never lock the running DLLs. Data lives in <repo>/bin/data; publish never deletes it.
set -e
root="$(cd "$(dirname "$0")" && pwd)"
bin="$root/bin"

[ -d "$root/web/node_modules" ] || (cd "$root/web" && npm ci)

# A previous instance running from bin would lock the files we are about to overwrite.
# Anchored pattern: only the API process, not e.g. an editor that has the path in its arguments.
if pkill -f "^$bin/BookReader\.Api( |\$)" 2>/dev/null; then
    for _ in $(seq 50); do pgrep -f "^$bin/BookReader\.Api( |\$)" >/dev/null || break; sleep 0.2; done
fi

dotnet publish "$root/src/BookReader.Api" -c Debug -o "$bin" --nologo -v q

ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://localhost:5027 "$bin/BookReader.Api" &
api=$!
trap 'kill $api 2>/dev/null' EXIT

cd "$root/web" && npm start
