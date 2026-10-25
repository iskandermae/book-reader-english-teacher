# API contract

`openapi.json` is the contract between backend and frontend. It is **generated, never edited by hand**, and committed.

## Regenerate

Run after any change to endpoints, requests, responses or errors:

```powershell
$env:UPDATE_OPENAPI = "1"; dotnet test --filter OpenApiContractTests; Remove-Item Env:UPDATE_OPENAPI
```

```bash
UPDATE_OPENAPI=1 dotnet test --filter OpenApiContractTests
```

Then commit `api/openapi.json`. The test `Committed_contract_matches_generated_one` fails in a normal `dotnet test` run when the file is stale.
