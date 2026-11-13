# Proposal

## Why

`ob-api` exports nothing yet. Each project that calls OpenBoxes writes its own client. For example, UNICEF-TJK-scripts has an axios-based `OBApi` that works only in Node, does not wrap errors, and needs a manual `login()` before each job to recover from stale sessions. A shared generic client removes this duplication and gives the typed endpoints a base to build on.

## Goals

- Supply a generic client that calls any OpenBoxes endpoint with `get`, `post`, `put`, `patch` and `delete`.
- Keep the public API close to d2-api's `D2ApiGeneric`, so code moves easily between the two libraries.
- Manage the OpenBoxes session in the client: log in on the first request, and log in again once when the session expires.
- Run in Node and in the browser with one `fetch` backend. The generic client needs no runtime dependencies.

## Non-goals

- Typed endpoints (for example `api.products.get(...)`). They come in a later change.
- Unwrapping the OpenBoxes `{ data }` response envelope.
- Logging inside the library.
- A shared package for `CancelableResponse` and `HttpClientRepository` with d2-api.
- Settling the browser server setup (same domain or CORS with cookies).

## What Changes

- Add `OBApi`, a generic client with a synchronous constructor: `new OBApi({ baseUrl, auth, locationId?, timeout?, apiPath? })`.
- Add the request methods `get(url, params)`, `post(url, params, data)`, `put(url, params, data)`, `patch(url, params, data)` and `delete(url, params)`. Each returns a `CancelableResponse`.
- Add lazy login: the first request logs in to `<apiPath>/login`. Add a public `login(locationId?)` to refresh the session or to change the location.
- Add one retry on a `401` response, after one shared login.
- Add `HttpError { request, response? }` for failed requests.
- Add `HttpClientRepository`, `CancelableResponse` (copied from d2-api, without `getMockAdapter`) and `FetchHttpClientRepository` (native `fetch`; keeps the session cookie in Node).
- Export the public API from `src/index.ts` and document it in `README.md`.

## Capabilities

### New Capabilities

- `api-client`: generic requests to any OpenBoxes endpoint — methods and argument order, URL building with `apiPath`, query parameters, request and response bodies, timeout, cancellation and errors.
- `api-session`: the OpenBoxes login session — lazy login, explicit `login(locationId?)`, the session cookie in Node and in the browser, and the single retry on `401`.

### Modified Capabilities

None.

## User impact

- Scripts and apps create a client with `new OBApi(...)` and call endpoints with short paths, for example `api.get("/products")`.
- Long-running scripts do not need a manual `login()` workaround for stale sessions.

## Compatibility

There is no earlier release of `ob-api`, so nothing breaks. Projects that migrate from the UNICEF-TJK-scripts client must make these edits:

| UNICEF-TJK-scripts `OBApi`                                   | `ob-api` `OBApi`                                    |
| ------------------------------------------------------------ | --------------------------------------------------- |
| `await OBApi.create({ baseUrl, auth, locationId, timeout })` | `new OBApi({ baseUrl, auth, locationId, timeout })` |
| `api.get("openboxes/api/products")`                          | `api.get("/products")`                              |
| `api.patch(url, data, params)`                               | `api.patch(url, params, data)`                      |
| Errors are axios errors                                      | Errors are `HttpError`                              |
| Manual `login()` before each job for stale sessions          | Not necessary; `login(locationId?)` stays available |

## Rollback plan

The change only adds code to an unreleased library. To roll back, revert the commits. Do not publish a release until the change is complete.

## Impact

- Code: new files in `src/api/`, `src/repositories/`, `src/data/` and `src/utils/`; `src/index.ts` exports the public API.
- Dependencies: the generic client adds no runtime dependencies. Node 22 supplies `fetch`, `AbortController` and `Headers.getSetCookie()`.
- Docs: `README.md` gets usage examples.
