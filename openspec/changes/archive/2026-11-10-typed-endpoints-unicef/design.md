# Design

## Context

See proposal.md (Why). Current state:

- A request goes `OBApi` (adds `apiPath`) → session (login, retry on `401`) → `FetchHttpClientRepository` (adds `baseUrl`, sends with `fetch`). `OBApi.get<Data>()` casts the parsed body to `Data` (the exception in `.est_ai/rules/project/http-boundary-cast.md`).
- `CancelableResponse.map(mapper)` gives the mapper the whole response (status, headers, data). When the mapper throws, the request rejects with that error. `flatMap` chains a second request, and `cancel()` stops both.
- Facts checked on the UNICEF server (`0.9.7-SNAPSHOT`, GET only) and in the OpenBoxes source (`v0.9.9`):
    - `GET /products` answers `{ data, totalCount }`; `max`, `offset` and `q` work (`q` searches name, code and other fields).
    - `GET /locations` answers `{ data }`, ignores `max`, and filters by `locationTypeCode`. The list depends on the user's roles.
    - `GET /products/availableItems` and `GET /products/{id}/availableItems` answer `{ data }` with the same item shape (`AvailableItem.toJson`). The product id is only in `product.id`; there is no `"product.id"` key. `lotNumber`, `expirationDate` and `binLocation` can be `null`. `status` is one of 5 values (`AvailableItemStatus`).
    - `GET /stockMovements` answers `{ data, totalCount }`; list items have the same shape as `GET /stockMovements/{id}` (`data`), except that they have no documents (found in the human review, see Live check). `statusCode` has values outside `StockMovementStatusCode` (`ISSUED` seen on the server). Dates come in 3 formats (`MM/dd/yyyy`, `MM/dd/yyyy HH:mm Z`, ISO). Documents (`associations.documents`) have no `id`, and their `uri` is an absolute URL on the OpenBoxes server.
    - `GET /partialReceiving/{shipmentId}` answers `{ data }` with `containers[].shipmentItems[]`, items with dotted keys (`"product.id"`, `"binLocation.id"`). `receiptStatus` is `PartialReceiptStatus` (4 values). UNICEF-TJK-scripts notes that the `POST` accepts dates only as `MM/dd/yyyy HH:mm Z` (UTC), and it sends `null` to clear item fields.
    - The generic API (`GenericApiController`): list → `{ data: [...] }`; `search` (GET or POST) → `{ data: [...] }`; create → status `201`, `{ data: <object> }`. `TransactionType.transactionCode` is `{ enumType, name }`, `name` one of `TransactionCode` (4 values). `inventory` items have `warehouse: { id }`.
    - `GET /chooseLocation/{id}` changes the location of the server session.
    - OpenBoxes sends `null` for absent values.
- `purify-ts` 2.1.4: `Codec.interface` drops keys it does not declare; a failed decode gives a message with the path of the problem and the whole received object.

## Goals / Non-Goals

**Goals:**

- One pattern for every endpoint: typed params or input → generic request → check → map to a plain type.
- No `as` casts in the typed layer.

**Non-Goals:**

- Parallel requests for `availableItems` chunks.
- `GET /products/{id}/availableItems` (one product). `availableItems({ productIds: [id] })` gives the same items.
- Removing the `http-boundary-cast` exception: the generic methods still cast.
- Checking the response of `uploadDocument`: UNICEF-TJK-scripts ignores it, and it is not JSON data we use.

## Decisions

### 1. Endpoints are factory functions, exposed as `OBApi` properties

`createProducts(api)`, `createLocations(api)` and one factory for each other resource return `Readonly<{ list, … }>`. `OBApi` sets one `readonly` property for each resource in its constructor. The endpoints call the public `api.get()`, so they get the session and `apiPath` for free.

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

### 4. Closed status sets are unions from `const` arrays; open ones are strings

A status that is a closed OpenBoxes enum gets a `const` array, and the type and the codec (`exactly(...)`) both come from it (rule: derive unions from `const` arrays): available item `status` (5), `shipmentStatus` (5), `receiptStatus` (4), `transactionCode` (4).

Stock movement `statusCode` is a `string`: the server sends `ISSUED`, which is not in `StockMovementStatusCode`, so a union would reject real data.

- Trade-off: a new value of a closed set fails the check. This is option A (decided): fail clearly, then update ob-api.

### 5. `availableItems` sends chunks of 50, one after another

A pure `chunk(array, size)` helper (`src/utils/`) splits `productIds`. The requests are chained with `flatMap`, and the items are joined in order with new arrays (no mutation). `cancel()` stops the current request and the ones not sent yet. An empty list returns a resolved `CancelableResponse` without a request.

- Fix in `CancelableResponse.flatMap` (found while implementing): a `cancel()` that came before the first response arrived did not stop the second request, because its canceler did not exist yet. `flatMap` now remembers the cancel and applies it when the second request starts. Without the fix, a chunk chain canceled early would still send its next chunk.
- Why 50: UNICEF-TJK-scripts uses 50 to stay under URL length limits.
- Why one after another: `CancelableResponse` has no parallel combinator yet. Most calls are 1 or 2 chunks.
- Alternative: parallel requests (UNICEF uses 4 at a time). Kept for later, if it is slow.

### 6. Result shapes

- `Paginated<T> = Readonly<{ objects: ReadonlyArray<T>; total: number }>` for `products.list()`.
- `ListResult<T> = Readonly<{ objects: ReadonlyArray<T> }>` for the lists that OpenBoxes does not page.
- `objects` is the name d2-api uses, so apps that use both libraries read results the same way.
- `expirationDate` stays the OpenBoxes string (`MM/dd/yyyy`). Alternative: a `Date`. Rejected: the string has no time zone, so the conversion is an app decision.

### 7. Inputs use ids and `Date`; ob-api builds the OpenBoxes body

Write inputs use plain ids (`productId`, `inventoryId`) and `Date` values. A pure function builds the OpenBoxes body:

- `{ id }` objects for references, only when the id is given (`binLocation`, `recipient`, `product` in a receipt item).
- Receipt `dateDelivered`: UTC `MM/dd/yyyy HH:mm Z`, the only format the `POST` accepts. Transaction `transactionDate`: ISO 8601, as UNICEF-TJK-scripts sends it.
- Receipt items: `null` for absent `receiptId`, `receiptItemId`, `lotNumber` and `expirationDate`. OpenBoxes needs `null` to clear a field, so `null` exists only in the body builder (project rule: `null` only where an external API needs it).

- Why: callers get the OpenBoxes format rules wrong (UNICEF-TJK-scripts has its own date formatter and `?? null` for each field). The rules then live in one tested place.
- Alternative: inputs in the OpenBoxes shape. Rejected: callers would still have to know the date format and `null` rules.

### 8. A partial receipt flattens the containers

`partialReceipts.get()` returns `items` from all `containers[].shipmentItems`, in order, with `containerId` on each item. `save()` sends all items in one container.

- Why: UNICEF-TJK-scripts reads and writes the items this way. The container is still on each item.
- Alternative: keep `containers` in the result. Rejected for now: no caller needs the nesting, and `save` would need the same nesting as input.

### 9. Document download is limited to the OpenBoxes server

A document `uri` is an absolute URL. `downloadDocument(uri)` strips `baseUrl` from it and sends the rest with `skipApiPrefix: true` and `responseDataType: "raw"`. A `uri` that does not start with `baseUrl` rejects before any request.

- Why: the request goes through the session (login, retry on `401`), and the session cookie never goes to another server.
- Alternative: let the HTTP repository accept absolute URLs. Rejected: every request would then be able to send the session cookie to any host.

### 10. Upload goes through the generic `post`

`uploadDocument(id, file, fileName)` builds `FormData` (`fileContents`) and calls `api.post` with `skipApiPrefix: true` on `<contextPath>/stockMovement/uploadDocument/{id}`. `contextPath` is `apiPath` without its last `api` segment, so a custom `apiPath` also moves the upload. It ignores the response body and resolves with no value. A non-2xx status still rejects (generic behavior).

### 11. `chooseLocation` is a session operation

`session.chooseLocation(id)` sends `GET <apiPath>/chooseLocation/{id}` with `send()` (lazy login, retry on `401`). On success it sets the session's location, so later automatic logins send `location: id`. On failure the location does not change.

- Why: a plain `api.get("/chooseLocation/…")` changes the server session, but the next automatic login would go back to the old location.
- Alternative: tell callers to use `api.login(id)`. Kept: `login` already does this with a new login; `chooseLocation` keeps the current session.

### 12. Generic domain API: one resource per use

`transactionTypes.list()`, `inventories.list()`, `transactions.create()` and `people.search({ email })` each have exact types (decided). They share no code beyond `getChecked` and a `postChecked` helper.

- `transactions.create()` returns only `{ id }`: UNICEF-TJK-scripts uses nothing else, and the full transaction shape is large.

### 13. Files

```
src/api/
  products.ts           products: list, availableItems
  locations.ts          locations: list
  stockMovements.ts     stockMovements: list, get, uploadDocument, downloadDocument
  partialReceipts.ts    partialReceipts: get, save
  inventoryTransactions.ts  transactionTypes, inventories, transactions
  people.ts             people: search
  openboxesDates.ts     UTC MM/dd/yyyy HH:mm Z formatter
  responseCheck.ts      getChecked, postChecked (HttpError on failure), nullish codec helper
  results.ts            Paginated, ListResult
  session.ts            + chooseLocation
src/utils/arrays.ts     chunk
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
- [The write endpoints are not run live (decided)] → Unit tests send the bodies that UNICEF-TJK-scripts sends today, field by field. The first real run is the UNICEF-TJK-scripts migration; test it on a non-production server first.
- [The receipt date format is UTC only] → UNICEF-TJK-scripts sends UTC today. README states it.
- [`people.search` is a `POST`] → It does not change data, but the live check runs GET requests only, so it is covered by unit tests.

## Migration Plan

None in this repository: the change only adds. Moving UNICEF-TJK-scripts to these endpoints is a separate task. That task also fixes its `item["product.id"]` bug and its document `id` type.

## Live check

### Products and locations

2026-11-09, UNICEF OpenBoxes server (`0.9.7-SNAPSHOT`), GET requests and logins only:

| Step                                                    | Result                                                                                          |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `products.list({ max: 2, offset: 0 })`                  | 2 objects, `total` 16                                                                           |
| `products.list({ max: 100 })`                           | 16 of 16 products pass the check                                                                |
| `products.list({ q: <code> })`                          | 1 match                                                                                         |
| `products.availableItems` at location `1`, all products | 17 items, 17 with `productId`, statuses `AVAILABLE`, `PICKED`, `HOLD`, 6 without a bin location |
| `products.availableItems` at the second location        | 3 items, 3 with `productId`                                                                     |
| `locations.list()`                                      | 11 of 11 locations pass the check, 1 without a number                                           |
| `locations.list({ locationTypeCode: "DEPOT" })`         | 5 depots                                                                                        |

### Stock movements, receipts and the generic API

2026-11-09, the same server, GET requests and logins only:

| Step                                                                               | Result                                                                                         |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `stockMovements.list` inbound at location `1`, all pages of 20                     | 35 of 35 movements pass the check; status pairs include `ISSUED/SHIPPED` and `ISSUED/RECEIVED` |
| `stockMovements.list` with `receiptStatusCodes: ["SHIPPED", "PARTIALLY_RECEIVED"]` | 5 movements, all with one of those shipment statuses                                           |
| `stockMovements.get` of each listed movement                                       | 35 pass the check, 35 with `shipmentId`, 273 documents, none with an `id`                      |
| `partialReceipts.get` of each shipment                                             | 35 receipts, 45 items, 3 without a bin location, all `PENDING`                                 |
| `stockMovements.downloadDocument`                                                  | the CSV export, 248 bytes, `text/csv`                                                          |
| `stockMovements.downloadDocument` on another host                                  | rejected, no request                                                                           |
| `transactionTypes.list`                                                            | 10 types, `Consumption` is `DEBIT`                                                             |
| `inventories.list`                                                                 | 18 inventories, 16 with `warehouseId`, one for location `1`                                    |
| `chooseLocation` with the current location                                         | accepted; the next request works                                                               |

Found on the way:

- `receiptStatusCode` values outside `ShipmentStatusCode` (for example `DISPATCHED`) make OpenBoxes answer `500`. The parameter type accepts only `OB_SHIPMENT_STATUSES`.
- A list without `direction` (and with no different `origin` and `destination`) gets `400`. README states it.

Not run live (decided): `partialReceipts.savePending` and `complete`, `transactions.create`, `stockMovements.uploadDocument`, `people.search`.

Found in the human review (2026-11-10): `stockMovements.list` gave `documents: []` for a movement that has documents. OpenBoxes sends no documents in the list, so the empty array was wrong data. `list()` now returns `OBStockMovementSummary` (`OBStockMovement` without `documents`), and the compiler makes callers use `get(id)` for documents.

Found in the OpenBoxes source after the human review (2026-11-10): `PartialReceivingApiController.update` answers a `COMPLETED` save with `{ data: {} }`, not the receipt. The single `save` method checked every response as a receipt, so a successful completion would reject. `save` is now `savePending` (returns the receipt, with the `receiptItemId` values) and `complete` (returns nothing). The unit tests had used the receipt shape for both, because the write endpoints are not run live.
