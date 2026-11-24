# Proposal

## Why

The low-level layer is complete: each method sends 1 OpenBoxes request, with the OpenBoxes names and shapes. Consumers still repeat OpenBoxes protocols by hand. UNICEF-TJK-scripts reads movement documents with 1 `get` per movement, and it receives a shipment in 4 requests (choose the location, read, save as `PENDING`, complete with the new ids). In the meeting of 2026-11-13, Arnau asked for a separate SDK layer for this logic: multi-step workflows, multi-version support and retries. The SP project starts soon, so the SDK must exist before its first workflow.

## What Changes

- **New SDK layer.** A new `OBSdk` class in `src/sdk/` wraps an `OBApi` client. It is exported from `@eyeseetea/ob-api`. Calls have the shape `sdk.<resource>.<workflow>(...)`. The low-level layer does not change, and it does not depend on the SDK.
- **Server version and capability flags.** The SDK reads `appVersion` from `GET /api/getAppContext` once, keeps it, and turns it into capability flags. The caller can give the version, and then the SDK sends no request. The read needs a session location, so the caller can give a `locationId` for it.
- **Stock movements with documents.** `sdk.stockMovements.listWithDocuments(params)` lists 1 page, then reads each movement to get its documents. It runs at most 4 reads at the same time (configurable). If one read fails, the call fails.
- **Receive a shipment.** `sdk.shipments.receive(...)` sets the session location, reads the receipt, saves it as `PENDING`, and completes it with the `receiptItemId` values from the `PENDING` answer. The caller gives the items and quantities. The caller keeps the business rules (which items, the date check, "skip if already received").
- **Session location lock.** A workflow that needs a location takes a `locationId` and calls `chooseLocation` itself. The SDK runs these workflows one at a time for each `OBSdk`, so 2 workflows cannot change the location of each other.
- **Retries.** The SDK retries a failed read (`GET`) when the failure is temporary: a network error, status `429`, `502`, `503` or `504`. It waits longer before each new attempt. It never retries a write.
- **Reference version and version mappers.** As in the plan for the d2-api SDK ([Explore d2-api and SDK](https://app.clickup.com/t/869djwjh1)), the SDK has 1 stable interface: the shapes of OpenBoxes `v0.9.7`, on every server. A version difference goes in a declarative mapper for that workflow step, chosen by the server version, not in the workflow code. This change adds the mechanism, but no mapper: no version difference is known yet.
- **Low-level: `api.appContext.get()`.** A new typed endpoint for `GET /api/getAppContext`, so the SDK uses the typed layer for version detection.

Public interface: no old surface changes. New surface:

| New                                                                       | Layer     |
| ------------------------------------------------------------------------- | --------- |
| `new OBSdk({ api, version?, retry?, ... })`                               | SDK       |
| `sdk.serverVersion({ locationId? })`, `sdk.capabilities({ locationId? })` | SDK       |
| `sdk.stockMovements.listWithDocuments(...)`                               | SDK       |
| `sdk.shipments.receive(...)`                                              | SDK       |
| `api.appContext.get()`, `"get /getAppContext"`                            | low-level |

## Goals

- The SDK holds the OpenBoxes protocols that need more than 1 request, so each consumer does not write them again.
- The method name tells the caller that it sends several requests (`listWithDocuments`, not a flag inside `list`).
- Parallel workflows on one `OBSdk` cannot break each other through the session location.
- Version-dependent code has one place to read the server version.
- A caller gets the same SDK shapes on every OpenBoxes version, as in the d2-api SDK plan.

## Non-goals

- Workflows for SP (for example: create a movement, add items, dispatch). They come in a later change, when the SP flows are known.
- Fallbacks to another endpoint when one fails. Add them when a version difference needs one.
- A separate npm package. The SDK can move to its own package later.
- Retries of writes. A write that times out may have succeeded on the server.
- A lock that also covers direct `api.chooseLocation` calls on the same `OBApi`.

## User impact

None for current callers: the change only adds. A consumer who wants the workflows creates an `OBSdk` from its `OBApi`.

## Compatibility

No breaking change. `appContext` is a new low-level resource, and `OBSdk` is a new export. The workflows were checked against OpenBoxes `v0.9.7` (the test server). The version detection needs `appVersion`, which OpenBoxes has since `v0.8.23`.

## Rollback plan

Revert the commit. Nothing outside `src/sdk/`, `src/api/appContext.ts`, the endpoint map and the exports depends on the change.

## Capabilities

### New Capabilities

- `sdk-client`: the `OBSdk` client: creation from an `OBApi`, server version detection, capability flags, the reference version and the version mappers, the session location lock, and retries of temporary read failures.
- `sdk-stock-movements`: SDK workflows on stock movements, starting with `listWithDocuments`.
- `sdk-shipments`: SDK workflows on shipments, starting with `receive`.
- `api-app-context`: the typed low-level endpoint `GET /api/getAppContext`.

### Modified Capabilities

None. The low-level specs keep their requirements.

## Impact

- New code: `src/sdk/` (client, lock, retry, version, resources), `src/api/appContext.ts`.
- Changed code: `src/api/endpoints.ts` (new key), `src/api/OBApi.ts` (new resource), `src/index.ts` (exports).
- Docs: `README.md` (new "SDK" section), `DEVELOPMENT.md` (architecture: the SDK layer), the GitHub wiki (new `appContext` page and an SDK page).
- No new dependency.
