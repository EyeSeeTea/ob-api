# Design

## Context

See proposal.md for the motivation. The repository is empty: `src/index.ts` exports nothing. Two existing clients shape the approach:

- **d2-api** (`D2ApiGeneric`, `FetchHttpClientRepository`, `CancelableResponse`): the public API and layout to follow. Its `HttpClientRepository` interface contains `getMockAdapter()`, which ties it to axios. Its fetch backend uses `cross-fetch`, `abort-controller`, `btoa`, `lodash` and `qs`. It sends Basic auth, which OpenBoxes does not use.
- **UNICEF-TJK-scripts `OBApi`**: logs in once with `POST openboxes/api/login` and `{ username, password, location? }`, and keeps the `JSESSIONID` cookie in a `tough-cookie` jar through axios. It works only in Node. It has no session recovery, so the composition root calls `login()` before each job.

Constraints:

- The library runs in Node 22 and in the browser. Node 22 supplies `fetch`, `AbortController`, `URLSearchParams` and `Headers.getSetCookie()`.
- A browser does not expose `Set-Cookie` to scripts, and it ignores a `Cookie` request header set by a script.
- Code rules: functional style and immutable data. Mutable state is allowed only where it is necessary.

## Goals / Non-Goals

**Goals:**

- One request path for Node and the browser, with no environment detection.
- Keep all mutable session state (session cookie, login promise, location) in one small place.
- Unit tests that do not need a server or an HTTP mocking library.

**Non-Goals:**

- A general cookie jar (paths, domains, expiry). One client talks to one server.
- Optional `auth` for browser apps that reuse an existing OpenBoxes session. `auth` is required in v1. Revisit this when a browser project starts (see DEVELOPMENT.md).
- Retry for any status other than `401`, or retry with backoff.

## Data flow

```
  caller
    |  api.get("/products", params)
    v
  +--------------------------------------------------------------+
  | src/api/OBApi                                                |
  |  - builds HttpRequest: url = joinPath(apiPath, url)          |
  |  - sends it through the session                              |
  +--------------------------------------------------------------+
    |
    v
  +--------------------------------------------------------------+
  | src/api/session                                              |
  |  1. no session?  await shared login promise                  |
  |  2. send request                                             |
  |  3. 401 on first attempt? -> shared re-login -> send again   |
  |  state: loginPromise, locationId                             |
  +--------------------------------------------------------------+
    |  HttpClientRepository.request(HttpRequest)
    v
  +--------------------------------------------------------------+
  | src/data/FetchHttpClientRepository                           |
  |  - full URL = joinPath(baseUrl, url) + query string          |
  |  - adds "Cookie" header when the cookie store is not empty   |
  |  - fetch(..., { credentials: "include", signal })            |
  |  - reads res.headers.getSetCookie() into the cookie store    |
  |  - non-2xx -> HttpError; timeout -> HttpError                |
  +--------------------------------------------------------------+
    |
    v
  OpenBoxes  <baseUrl>/openboxes/api/...
```

Layer map (matches d2-api):

| Folder | Contents |
| --- | --- |
| `src/repositories/` | `HttpClientRepository` interface, `HttpRequest`, `HttpClientResponse`, `HttpError`, `CancelableResponse`, `isCancel` |
| `src/data/` | `FetchHttpClientRepository` |
| `src/api/` | `OBApi`, the session logic, `OBApiOptions` |
| `src/utils/` | `joinPath`, query string building, `Set-Cookie` parsing |

## Decisions

### 1. Copy the d2-api interface, without `getMockAdapter`

`HttpClientRepository` has one method, `request<Data>(HttpRequest): CancelableResponse<Data>`. `Method` adds `"patch"`. Tests give `OBApi` a fake repository that records requests and returns scripted responses.

- Alternative: keep `getMockAdapter()`. Rejected: it needs axios and `axios-mock-adapter` as dependencies only for tests.

### 2. One fetch path for Node and the browser

The repository always sends `credentials: "include"`. It always reads `res.headers.getSetCookie()` and keeps each `name=value` pair. It adds a `Cookie` header only when it holds cookies.

- In Node, `getSetCookie()` returns the login cookie, so later requests send it. Node ignores `credentials`.
- In the browser, `getSetCookie()` returns an empty list, so the repository never sets `Cookie`. The browser handles the cookie because of `credentials: "include"`.
- Alternative: detect the environment (`typeof window`). Rejected: two code paths, and detection fails in workers and test runners.
- Alternative: `tough-cookie`. Rejected: a runtime dependency for a single session cookie.

The cookie store lives in the repository, not in `OBApi`, because cookies are a transport concern. The store is a map from cookie name to value; a new `Set-Cookie` for the same name replaces the old value. It is the one mutable field in the data layer.

### 3. Session logic in `src/api/`, through the repository interface

The session wraps calls to the repository. It keeps:

- `loginPromise: Promise<void> | undefined` — the login in progress or done. All requests that need a login wait for the same promise, so concurrent requests cause one login.
- `locationId` — set from the options and replaced by `login(locationId)`.

Flow of one request:

1. When `loginPromise` is `undefined`, start a login and store the promise.
2. Wait for `loginPromise`, then send the request.
3. When the response is an `HttpError` with status `401` and this is the first attempt, start a new login only when no newer login is in progress (compare with the promise that the failed request waited for), wait for it, and send the request once more.
4. A failed login clears `loginPromise`, so the next request tries again. The login request itself goes directly to the repository and is never retried.

`CancelableResponse.flatMap` only chains on success, so the retry cannot use it. The session builds the result with `CancelableResponse.build`, and its `cancel` cancels whichever inner request is active (login, first attempt or retry).

- Alternative: put the session in the fetch repository. Rejected: a second repository (for example axios, later) would have to copy the login and retry rules.
- Alternative: eager login in an async factory, as UNICEF does. Rejected: the constructor differs from d2-api, and it does not solve expired sessions.

### 4. URL building

`OBApi` prefixes the request URL with `apiPath` (default `openboxes/api`). The repository prefixes `baseUrl`. `joinPath` trims slashes at each join, so `baseUrl` and `apiPath` work with or without leading and trailing `/`. The query string uses `URLSearchParams`; array values repeat the key and `undefined` values are left out.

### 5. Errors, timeout and cancellation

- Non-2xx response: reject with `HttpError { request, response: { status, data, headers } }`. The body is parsed as JSON when the content type is JSON, otherwise kept as text.
- Network failure: reject with `HttpError { request }`.
- Timeout: one `AbortController` per request. The timeout calls `controller.abort(timeoutReason)`, and the repository rejects with `HttpError { request }` and a timeout message.
- Cancel: `cancel()` calls `controller.abort()` with no reason. The repository rethrows the `AbortError` without wrapping it. `isCancel(error)` returns `true` for it. This keeps cancellation and timeout apart, which d2-api does not do.
- The library does not log. Callers decide what to log.

### 6. Raw response body

The generic client returns the body as received. Typed endpoints added later unwrap `{ data }` where OpenBoxes uses it. This keeps the generic client correct for endpoints that do not wrap.

## Risks / Trade-offs

- [OpenBoxes may answer an expired session with a redirect to the login page (HTML, status 200) instead of `401`] → Verify on a real server before release. When it redirects, add `redirect: "manual"` and treat the redirect as `401`, in a follow-up change.
- [The simple cookie store ignores path, domain and expiry] → One client talks to one server, and OpenBoxes uses one session cookie. A server that sets many cookies with different paths needs a real jar later.
- [Retry sends a `POST` twice] → A `401` means the server rejected the request before it ran, so the retry does not apply a change twice.
- [Copied `CancelableResponse` drifts from d2-api] → Keep the public shape the same. A shared package can replace both copies later.
- [Browser apps cannot use the client without credentials] → Accepted for v1; see Non-Goals.

## Migration Plan

No migration in this repository: nothing is released. UNICEF-TJK-scripts can migrate later with the edits in proposal.md → Compatibility. Rollback: revert the commits; no release happens until the change is complete.

## Open Questions

- Does OpenBoxes send `401` or a redirect for an expired session on `/openboxes/api/*`? See the first risk. This change covers `401` only. When the server redirects, a follow-up change extends the `api-session` retry requirement to the redirect.
