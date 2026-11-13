# Design

## Context

A request goes `OBApi` (adds `apiPath`) → session (login, retry on `401`) → `FetchHttpClientRepository` (adds `baseUrl`, builds the body, sends with `fetch`). The two gaps are in the first and the last step.

## Decisions

### `skipApiPrefix` lives in `OBApi`, not in `HttpRequest`

`OBApi.request()` takes `OBApiRequest = HttpRequest & { skipApiPrefix?: boolean }`. It removes `skipApiPrefix` and joins `apiPath` only when the flag is not `true`. The session and the repository still get a plain `HttpRequest`.

Why: `apiPath` is an `OBApi` concept. The repository only knows `baseUrl`. d2-api does the same: `D2ApiGeneric.request()` reads `skipApiPrefix` and picks the connection.

Alternative: put the flag in `HttpRequest`. Rejected: every `HttpClientRepository` would have to know about a path it does not own.

The login URL is not affected: the session builds it from `apiPath` when `OBApi` is created.

### Detect binary bodies in `getBody`

`getBody` already has `isBodyInit`. A body is sent as it is when it is a `FormData`, `Blob`, `URLSearchParams`, `ArrayBuffer` or typed array, whatever `requestBodyType` says. Other values follow `requestBodyType` as before: `json` sends `JSON.stringify(data)`.

A `string` body with `requestBodyType: "json"` is still sent as a JSON string. Strings are valid JSON values, so sending them as they are would change existing behavior.

The JSON `Content-Type` header is added only when the body is sent as JSON. For a binary body, `fetch` sets the header itself; for `FormData` this includes the multipart boundary, which the caller cannot know.

Alternative: keep `requestBodyType: "raw"` as the only way. Rejected: `post(url, undefined, formData)` would still send `{}`, silently. The UNICEF axios client sent `FormData` without an option.

## Data flow

1. `api.post("stockMovement/uploadDocument/1", undefined, formData, { skipApiPrefix: true })`
2. `OBApi.request()` → URL `stockMovement/uploadDocument/1` (no `apiPath`) → session.
3. Session → logs in if necessary (login URL still uses `apiPath`) → repository.
4. Repository → URL `<baseUrl>/stockMovement/uploadDocument/1`, body `formData` as it is, no JSON `Content-Type`.

With `baseUrl` `https://ob.example.org`, the caller writes `openboxes/stockMovement/uploadDocument/1` to reach `/openboxes/stockMovement/…`.

## Risks / Trade-offs

- [`skipApiPrefix` URLs include the `openboxes` context path] → The caller writes the path after `baseUrl`. README shows an example.
- [A caller who sent a `Blob` with `requestBodyType: "json"` on purpose] → `JSON.stringify(blob)` is `{}`, so no working caller depends on it.
- [An expired session on a path outside `apiPath`] → OpenBoxes (`SecurityInterceptor`, `RequestUtil.isAjax`) answers `401` to any request that accepts JSON, on every path. The client always sends `Accept: application/json, text/plain`, so the retry works. A test protects this header. A caller who sets `Accept` without `application/json` gets the HTML login page with `200` and no retry; README warns about it.

## Live check

2026-11-05, UNICEF OpenBoxes server (`0.9.7-SNAPSHOT`), GET requests and logins only:

1. `GET openboxes/info` with `skipApiPrefix` → `200`, version `0.9.7-SNAPSHOT`.
2. Expired session, `GET openboxes/stockMovement/list` with `skipApiPrefix` → `401`, login, retry → `200`.
3. The same with `Accept: text/html` → redirected to `/openboxes/auth/login`, `200` HTML, no login. This is the case README warns about.

The upload itself (`POST stockMovement/uploadDocument`) was not sent: it writes data on the UNICEF server.
