# Design

## Context

See proposal.md (Why). Current state:

- A request goes `OBApi` (adds `apiPath`) → session (login, retry on `401`) → `FetchHttpClientRepository` (adds `baseUrl`, sends with `fetch`). `OBApi.get<Data>()` casts the parsed body to `Data` (the exception in `.est_ai/rules/project/http-boundary-cast.md`).
- `CancelableResponse.map(mapper)` gives the mapper the whole response (status, headers, data). When the mapper throws, the request rejects with that error. `flatMap` chains a second request, and `cancel()` stops both.
- Facts checked on the UNICEF server (`0.9.7-SNAPSHOT`, GET only) and in the OpenBoxes source (`v0.9.9`):
    - `GET /products` answers `{ data, totalCount }`; `max`, `offset` and `q` work (`q` searches name, code and other fields).
    - `GET /locations` answers `{ data }`, ignores `max`, and filters by `locationTypeCode`. The list depends on the user's roles.
    - `GET /products/availableItems` and `GET /products/{id}/availableItems` answer `{ data }` with the same item shape (`AvailableItem.toJson`). The product id is only in `product.id`; there is no `"product.id"` key. `lotNumber`, `expirationDate` and `binLocation` can be `null`. `status` is one of 5 values (`AvailableItemStatus`).
    - OpenBoxes sends `null` for absent values.
- `purify-ts` 2.1.4: `Codec.interface` drops keys it does not declare; a failed decode gives a message with the path of the problem and the whole received object.

## Goals / Non-Goals

**Goals:**

- One pattern that later endpoints (stock movements, generic API) copy: typed params → generic request → check → map to a plain type.
- No `as` casts in the typed layer.

**Non-Goals:**

- Parallel requests for `availableItems` chunks.
- `GET /products/{id}/availableItems` (one product). `availableItems({ productIds: [id] })` gives the same items.
- Removing the `http-boundary-cast` exception: the generic methods still cast.

## Decisions

### 1. Endpoints are factory functions, exposed as `OBApi` properties

`createProducts(api)` and `createLocations(api)` return `Readonly<{ list, … }>`. `OBApi` sets `readonly products` and `readonly locations` in its constructor. The endpoints call the public `api.get()`, so they get the session and `apiPath` for free.

- Why: the same style as `createSession` (functions and closures, no class hierarchy), and each endpoint file depends only on the public `OBApi` methods.
- Alternative: classes like d2-api's resource classes. Rejected: more code for the same result, and the project prefers composition.

### 2. Check with a `purify-ts` codec of the OpenBoxes shape, then map with a pure function

Each endpoint has a codec for the raw response (OpenBoxes names, `null` allowed), and a pure function that changes the decoded value into the public type:

- `null` → `undefined` (project rule: no `null` past the boundary).
- Dotted keys → camelCase (`"inventoryItem.id"` → `inventoryItemId`); nested `product.id` → `productId`.
- Only the declared fields stay (`Codec.interface` drops the rest), so fields a newer OpenBoxes adds are ignored.

The endpoint calls `api.get<unknown>(path, params).map(response => …)`. It does not rely on the generic cast.

- Why `purify-ts`: decided with the user; it is the EST standard in practice (48 EST repos).
- Why a separate public type instead of `GetType<typeof codec>`: the public shape is different (no `null`, no dotted keys), and the public API must not expose `purify-ts` types. Apps with another `purify-ts` version (UNICEF-TJK-app has `^1`) then have no conflict.
- Alternative: decode straight into the public shape with codec transforms. Rejected: `purify-ts` codecs do not rename keys, and a mapper function is easier to read and test.

### 3. A check failure is an `HttpError` that keeps the response

A shared helper decodes the body. On failure it throws `HttpError("GET <url> returned an unexpected response: <problem>", { request, response })`. The problem text is cut to 300 characters, because `purify-ts` includes the whole received object; the full body stays in `error.response`.

- Why: the same behavior as an invalid JSON body (`HttpError` with the response), so apps handle one error type.
- Alternative: a new `ResponseCheckError` class. Rejected for now: apps would need a second error check for the same kind of problem.

### 4. `status` is a union from a `const` array

`OB_AVAILABLE_ITEM_STATUSES = ["AVAILABLE", "PICKED", "RECALLED", "HOLD", "NOT_AVAILABLE"] as const`; the type and the codec (`exactly(...)`) both come from it (rule: derive unions from `const` arrays).

- Trade-off: a new status in a later OpenBoxes fails the check. This is option A (decided): fail clearly, then update ob-api.

### 5. `availableItems` sends chunks of 50, one after another

A pure `chunk(array, size)` helper (`src/utils/`) splits `productIds`. The requests are chained with `flatMap`, and the items are joined in order with new arrays (no mutation). `cancel()` stops the current request and the ones not sent yet. An empty list returns a resolved `CancelableResponse` without a request.

- Why 50: UNICEF-TJK-scripts uses 50 to stay under URL length limits.
- Why one after another: `CancelableResponse` has no parallel combinator yet. Most calls are 1 or 2 chunks.
- Alternative: parallel requests (UNICEF uses 4 at a time). Kept for later, if it is slow.

### 6. Result shapes

- `Paginated<T> = Readonly<{ objects: ReadonlyArray<T>; total: number }>` for `products.list()`.
- `ListResult<T> = Readonly<{ objects: ReadonlyArray<T> }>` for the lists that OpenBoxes does not page.
- `objects` is the name d2-api uses, so apps that use both libraries read results the same way.
- `expirationDate` stays the OpenBoxes string (`MM/dd/yyyy`). Alternative: a `Date`. Rejected: the string has no time zone, so the conversion is an app decision.

### 7. Files

```
src/api/
  products.ts         createProducts, OBProduct, OBAvailableItem, statuses, params, codecs
  locations.ts        createLocations, OBLocation, params, codecs
  responseCheck.ts    decode helper (HttpError on failure), nullable-field codec helper
  results.ts          Paginated, ListResult
src/utils/arrays.ts   chunk
```

## Data flow

1. `api.products.list({ max: 2 })` → `api.get<unknown>("/products", { max: 2 })`.
2. `OBApi.request()` adds `apiPath` → session logs in when necessary → `FetchHttpClientRepository` sends `GET <baseUrl>/openboxes/api/products?max=2` and parses the JSON.
3. `map`: the codec checks `{ data: Product[], totalCount }` → on failure, `HttpError` with the response.
4. The mapper builds `{ objects: OBProduct[], total }` with `undefined` for absent values.
5. `getData()` gives the result to the app.

## Risks / Trade-offs

- [OpenBoxes sends a type we do not expect, for example a number as a string] → The check fails with the path of the field. The unit tests use bodies copied from the UNICEF server, and the live check runs the endpoints there.
- [`locations.list()` depends on the user's roles] → README says so. ob-api does not filter.
- [`q` matches several product fields, not only the code] → README says so; apps filter for an exact code.
- [A new OpenBoxes version adds a status or renames a field] → The check fails with a clear message (option A). Types per version are for the SDK part.
- [`purify-ts` adds a runtime dependency] → One dependency (`@types/json-schema`), works in Node and the browser.

## Migration Plan

None in this repository: the change only adds. Moving UNICEF-TJK-scripts to these endpoints is a separate task. That task also fixes its `item["product.id"]` bug.
