# Proposal

## Why

UNICEF-TJK-scripts calls two kinds of requests that the generic client cannot send cleanly. These gaps were found while exploring typed endpoints (2026-11-04), and they block the move of UNICEF-TJK-scripts to ob-api:

- `POST /openboxes/stockMovement/uploadDocument/{id}` is not under `/openboxes/api`, but the client always adds `apiPath`.
- That request sends `FormData`. The client sends every body as JSON by default, so `post(url, undefined, formData)` sends `{}`.

## Goals

- Send a request to a path outside `apiPath`.
- Send `FormData`, `Blob`, `URLSearchParams` and binary bodies as they are, without an extra option.

## Non-goals

- Typed endpoints.
- Changes to the session (login, retry on `401`).

## What Changes

- Add `skipApiPrefix?: boolean` to the request options of `request()` and to the last argument of `post()`. When it is `true`, the URL is relative to `baseUrl`. The name and behavior copy d2-api.
- Send a `FormData`, `Blob`, `URLSearchParams`, `ArrayBuffer` or typed-array body as it is. The client does not set `Content-Type` for these bodies, so `fetch` sets it (for example the multipart boundary).
- README: document both, and add a migration note: a raw response is a `Blob`, not an `ArrayBuffer`.

Public interface, old vs new:

|                                    | Old                              | New                                                           |
| ---------------------------------- | -------------------------------- | ------------------------------------------------------------- |
| `request(options)`                 | `options: HttpRequest`           | `options: OBApiRequest` (`HttpRequest` plus `skipApiPrefix?`) |
| `post(url, params, data, request)` | `request?: Partial<HttpRequest>` | `request?: Partial<OBApiRequest>`                             |
| `post(url, undefined, formData)`   | Sends `{}` as JSON               | Sends the form data                                           |

Both changes are additions. Existing calls keep their behavior, except a `FormData` (or other binary) body, which was sent wrongly before.

## Capabilities

### New Capabilities

### Modified Capabilities

- `api-client`: URLs can skip the API path; form and binary bodies are sent as they are.

## Impact

- Code: `src/api/OBApi.ts`, `src/repositories/HttpClientRepository.ts`, `src/data/FetchHttpClientRepository.ts`, `src/index.ts`.
- Docs: `README.md`.
- No new dependencies. No release yet, so no migration in this repository.
