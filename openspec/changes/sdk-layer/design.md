# Design

## Context

See proposal.md (Why). The facts that shape the approach:

- `OBApi` has 1 session for each client. The session holds the location on the server (`login`, `chooseLocation`). It logs in again on `401` with the last location that OpenBoxes accepted (`src/api/session.ts`).
- Every low-level method returns a `CancelableResponse` (`map`, `flatMap`, `build`; `resolvedResponse` for a result that needs no request).
- A failed request rejects with `HttpError`. A network error or a timeout is an `HttpError` without `response`. A cancel is an `AbortError` (`isCancel`). A failed response check is an `HttpError` with the `200` response.
- `GET /api/getAppContext` answers `{ data: { appVersion, buildNumber, buildDate, … } }` with a session location, and `500` without one (checked on the test server on 2026-11-20: `0.9.7-SNAPSHOT`).
- OpenBoxes receives the stock into the lot of the save body, not of the shipment (`write-test-data.md`, 2026-11-18). A caller who builds the body by hand can lose the lot.
- `src/` has no concurrency or retry helper to reuse.

## Goals / Non-Goals

**Goals:**

- The SDK uses only the public `OBApi` surface, so the low-level layer has no knowledge of the SDK.
- Each building block (lock, retry, concurrency, version parse, mapper selection) is a small pure or closure-based function with its own tests, and the workflows compose them.

**Non-Goals:**

- A shared session pool or 1 session per location.
- Restore of the earlier session location after a workflow.

## Data flow

```
caller
  └─ sdk.shipments.receive(input)            src/sdk/shipments.ts
       └─ lock.run(...)                      src/sdk/locationLock.ts   (only workflows with a locationId)
            ├─ withRetry(() => api.chooseLocation(id))                (a GET that changes only the session)
            ├─ withRetry(() => api.partialReceipts.get(id))           src/sdk/retry.ts (GET only)
            ├─ toPendingBody(receipt, items)  (pure)
            ├─ api.partialReceipts.savePending(...)
            ├─ toCompletedBody(pending, items) (pure)
            └─ api.partialReceipts.complete(...)
                 └─ OBApi resource → typed request → session → HttpClientRepository
```

`listWithDocuments` follows the same path without the lock: `withRetry(list)`, then `mapWithConcurrency(ids, n, id => withRetry(() => get(id)))`. `serverVersion({ locationId? })` calls `withRetry(() => api.appContext.get())` once and keeps the promise. With a `locationId`, it runs `chooseLocation` and the read inside `lock.run`.

## Decisions

### 1. `OBSdk` wraps an `OBApi` (composition)

`new OBSdk({ api })` takes an existing client. The resource factories (`createSdkStockMovements(deps)`, `createSdkShipments(deps)`) take only what they use: the `OBApi` parts (a `Pick<OBApi, …>`), the lock, the retry policy and the concurrency. Tests give them fakes, as the low-level factories take `EndpointApi`.

- Alternative: `OBSdk extends OBApi`. Rejected: it mixes the 2 layers that Arnau asked to keep apart, and a caller cannot share 1 session between the 2 layers on purpose.
- Alternative: the SDK creates its own `OBApi` from the options. Rejected: the caller then cannot use one session for SDK and low-level calls.

### 2. Workflows return `CancelableResponse`

Each workflow returns a `CancelableResponse`, the same type as the low-level layer, so apps wrap both layers the same way (as d2-api). A small runner (`src/sdk/workflow.ts`) builds it: it owns an `AbortController`, gives the workflow body an `await step(response)` function that registers the cancel of the request in progress, and rejects with the abort reason when the caller cancels. The response data is the workflow result, with `status: 200` and no headers, as `resolvedResponse` does.

- Alternative: `Promise<T>` with an optional `AbortSignal`. Simpler, but a second async style in one library.
- Alternative: chains of `flatMap`. Rejected: they do not express loops, the lock or retries.

### 3. Location lock: a promise queue for each `OBSdk`

`createLocationLock()` returns `run(task)`. It keeps the tail promise of the queue in a closure, as the session keeps its login promise. Each task starts when the earlier one settles (resolved or rejected). A task canceled while it waits settles without running. The lock does not cover direct `api.chooseLocation` calls: the README tells callers to give the SDK its own `OBApi` when they also change the location directly.

- Alternative: skip `chooseLocation` when the session is already at the location. Rejected for now: the session does not expose its location, and 1 extra `GET` is cheap.
- Alternative: let the caller own the location. Rejected by the developer on 2026-11-20.

### 4. Retries only for `GET`, only for temporary failures

`withRetry(send, policy, signal)` calls `send()` again on a network error (`HttpError` without `response`) or status `429`, `502`, `503`, `504`. It waits `delayMs × 2^(n − 1)` between attempts, and the wait stops on cancel. The SDK uses it only around its `GET` calls, `chooseLocation` included: that `GET` changes only the session, so a second attempt is safe. Writes are not retried: a `POST` that timed out may have changed the server. There is no jitter: the SDK sends few requests, and a fixed delay is easy to test with fake timers.

- Alternative: retry in the session, for all calls. Rejected: it changes the low-level contract ("1 method, 1 request").

### 5. Version: kept promise, cleared on failure

`serverVersion()` keeps the first promise and clears it when it rejects, as the session does with `loginPromise`. It returns a `Promise`, not a `CancelableResponse`: callers share the kept read, so a cancel by 1 caller must not stop it for the others. `getAppContext` needs a session location, so `serverVersion({ locationId })` chooses the location in the lock before the read; without `locationId`, it uses the current session location. A kept version sends no request, also with a `locationId`. `parseVersion` is pure: it reads `^(\d+)\.(\d+)\.(\d+)` and ignores the suffix. A `500` gets an SDK error that says that the read needs a session location, with the `HttpError` as `cause`. `capabilities()` maps a table `{ flag: "major.minor.patch" }` with a pure `isAtLeast`. The first table holds the flags that the workflows of this change need: none. The mechanism is tested with a test table, and the first real flag comes with the first workflow that depends on the version.

### 6. Reference version and version mappers (as the d2 SDK plan)

This follows the plan for the d2-api SDK ([Explore d2-api and SDK](https://app.clickup.com/t/869djwjh1), 2026-06-05): 1 stable interface, anchored to 1 reference version, and declarative mappers outside the workflows for the other versions.

- **Reference version: OpenBoxes `v0.9.7`** (the test server, the only version that ob-api checks). The SDK input and result types follow it on every server. A caller never sees a version difference.
- **Version mappers** (`src/sdk/versionMappers.ts`). A mapper table for 1 workflow step is a list of entries `{ versions: { from?, to? }, toRequest?, fromResponse? }` (`from` inclusive, `to` exclusive). `selectMapper(table, version)` is pure: it returns the entry whose range has the server version, else the identity mapper (reference behavior). Each step calls `toRequest` on the body that it built with the reference shape, and `fromResponse` on the low-level answer, before the reference code reads it. The workflow code has no version checks.
- **No mappers in this change.** No version difference is known yet: the SP server version is not known, and only `v0.9.7` is checked. So the workflows do not read the server version, and they send no `getAppContext` request. A workflow reads the version only when its first mapper table gets an entry.
- **Flags and mappers.** Capability flags (decision 5) tell the caller whether a feature exists on the server. Mappers change shapes inside the SDK. Both come from `serverVersion()`.

- Alternative: versions at compile time, 1 import or branch for each version, as the raw d2-api does (`@eyeseetea/d2-api/2.42`, branches `2.40` to `2.43`). Rejected for the SDK: the version is known only at run time, and the caller wants 1 shape. It fits the low-level layer later ("v2" in the Arnau meeting).
- Alternative: `if (capabilities.x)` inside the workflows. Rejected: it spreads version logic over the workflows, which the d2 SDK plan also avoids.

### 7. `listWithDocuments`: 1 page, fail fast

It reads the page that `params` asks for, as `list` does, so its cost is visible: 1 + page size requests. `mapWithConcurrency(items, limit, fn)` (`src/sdk/concurrency.ts`) keeps the order of the input, and on the first failure it cancels the requests in progress and starts no new one. Default limit `4`, as UNICEF-TJK-scripts uses.

- Alternative: a result for each movement with its error. Rejected for now: no consumer needs partial results, and it is easy to add as a second method.

### 8. `receive`: the SDK builds the body from the `get` receipt

The caller gives only `shipmentItemId`, the quantity and the optional fields. The SDK copies `product`, `lotNumber` and `expirationDate` from the `get` receipt, so the caller cannot lose the lot. It sends the `receiptId` of the `get` receipt and the `receiptItemId` of each `get` receipt item: after a failed completion, the receipt stays `PENDING`, and a new `receive` call continues it with the same receipt items, not new duplicates. It leaves out the containers that have no given item. The pure functions `toPendingInput(receipt, items)` and `toCompletedInput(pending, items)` build the 2 bodies and are tested alone.

## Risks / Trade-offs

- [A caller changes the location with `api.chooseLocation` while an SDK workflow runs on the same `OBApi`] → The README says to give the SDK its own `OBApi` in that case. The spec states that the lock does not cover direct calls.
- [After a workflow, the session stays at its location, so later low-level calls that read the session location (for example stock movement create) run there] → Stated in the spec and the README.
- [`receive` fails after the `PENDING` save] → The receipt stays `PENDING` on the server; a second `receive` with the same items continues it, because the SDK sends the `receiptId` and the `receiptItemId` values of the `get` receipt. Task 5.4 checks this live.
- [Sending only the given items may behave differently on other OpenBoxes versions] → Checked live on `v0.9.7` (task 5.4). Other versions are checked when a consumer uses them.
- [Retries make a failing call slower: 3 attempts take at least 1.5 s] → `retry.attempts: 1` turns them off.
- [Only 1 OpenBoxes server version is available for tests, so a mapper cannot be checked live on its version] → Unit tests with recorded answers of that version. Functional tests for each version (as the d2 SDK plan) start when a server of a second version is available.
- [A server older or newer than every mapper range runs the reference code, and can fail] → It fails with the HTTP or response-check error of the step, as today. A minimum supported version can come with the first mapper.

## Migration Plan

No migration: the change only adds. Rollback: revert the commit.

## Open Questions

- Which version-dependent capability or mapper comes first. It can wait: the tables grow without a change to the specs.
- Whether the SDK must refuse servers older than a minimum version. It can wait until the first mapper exists.
