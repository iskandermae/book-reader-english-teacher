#!/usr/bin/env bash
# Starts the API (http://localhost:5027) and the UI (http://localhost:4200). Ctrl+C stops both.
set -e
root="$(cd "$(dirname "$0")" && pwd)"

[ -d "$root/web/node_modules" ] || (cd "$root/web" && npm ci)

dotnet run --project "$root/src/BookReader.Api" --launch-profile http &
api=$!
trap 'kill $api 2>/dev/null' EXIT

cd "$root/web" && npm start
