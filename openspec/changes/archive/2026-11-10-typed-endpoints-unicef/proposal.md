# Proposal

## Why

With the generic client (v1), each app writes the URL, the parameter names and the response type of each OpenBoxes call, and nothing checks the response at runtime. A wrong field shows only when the app uses it.

Real examples, found while planning this change, in UNICEF-TJK-scripts:

- It reads `item["product.id"]` from `GET /products/availableItems`. OpenBoxes never sends that key (it sends `product: { id, … }`), so every item gets `productId: undefined`.
- It types stock movement documents with `id: string`. OpenBoxes sends no `id` for them.

Typed endpoints make these compile errors, and checked responses make them clear runtime errors.

This change covers every OpenBoxes endpoint that UNICEF-TJK-scripts uses. The exploration and decisions are in `.local/typed-endpoints-exploration.md` (scope, naming, `purify-ts`, OpenBoxes versions).

## Goals

- Typed methods for all the OpenBoxes calls of UNICEF-TJK-scripts (14 calls, 8 resources).
- Typed parameters and request bodies, so a wrong name is a compile error.
- Checked responses: a response with a missing or wrong field rejects with a clear error.
- Plain result types that apps can use without a validation library.
- The OpenBoxes format rules that callers get wrong are handled once, in ob-api: the receipt date format, `null` to clear a field, the document URL.

## Non-goals

- Endpoints that UNICEF-TJK-scripts does not use.
- A generic typed wrapper for `/generic/{domain}`: one resource per use (decided).
- Types per OpenBoxes version (option B). Considered later, in the SDK part.
- App entities. The types describe OpenBoxes data; apps still map them to their own entities.
- Changes to the generic client: `api.get()` and the other methods stay as they are.
- Live tests of the endpoints that change data (decided: unit tests, and a live check with GET requests only).

## What Changes

New resources on `OBApi`:

| Method                                                                                           | OpenBoxes request                                                                  | Result                              |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ----------------------------------- |
| `products.list({ max?, offset?, q? })`                                                           | `GET /products`                                                                    | `Paginated<OBProduct>`              |
| `products.availableItems({ locationId, productIds })`                                            | `GET /products/availableItems` (50 products per request)                           | `ListResult<OBAvailableItem>`       |
| `locations.list({ locationTypeCode? })`                                                          | `GET /locations`                                                                   | `ListResult<OBLocation>`            |
| `stockMovements.list({ direction?, origin?, destination?, receiptStatusCodes?, max?, offset? })` | `GET /stockMovements`                                                              | `Paginated<OBStockMovementSummary>` |
| `stockMovements.get(id)`                                                                         | `GET /stockMovements/{id}`                                                         | `OBStockMovement`                   |
| `stockMovements.uploadDocument(id, file, fileName)`                                              | `POST /openboxes/stockMovement/uploadDocument/{id}` (form data, outside `apiPath`) | nothing                             |
| `stockMovements.downloadDocument(uri)`                                                           | `GET <uri>` (raw bytes, same server only)                                          | `Blob`                              |
| `partialReceipts.get(shipmentId)`                                                                | `GET /partialReceiving/{shipmentId}`                                               | `OBPartialReceipt`                  |
| `partialReceipts.savePending(shipmentId, receipt)`                                               | `POST /partialReceiving/{shipmentId}` (`PENDING`)                                  | `OBPartialReceipt`                  |
| `partialReceipts.complete(shipmentId, receipt)`                                                  | `POST /partialReceiving/{shipmentId}` (`COMPLETED`)                                | nothing                             |
| `transactionTypes.list()`                                                                        | `GET /generic/TransactionType`                                                     | `ListResult<OBTransactionType>`     |
| `inventories.list()`                                                                             | `GET /generic/inventory`                                                           | `ListResult<OBInventory>`           |
| `transactions.create(transaction)`                                                               | `POST /generic/transaction`                                                        | `{ id }`                            |
| `people.search({ email })`                                                                       | `POST /generic/person/search`                                                      | `ListResult<OBPerson>`              |
| `chooseLocation(locationId)`                                                                     | `GET /chooseLocation/{locationId}`                                                 | nothing                             |

- Each result is checked at runtime. The result types use `undefined` for absent values (OpenBoxes sends `null`), and camelCase names for dotted keys (`"inventoryItem.id"` → `inventoryItemId`).
- Request bodies are typed in the same style (ids, not `{ id }` objects), and ob-api builds the OpenBoxes body. Dates are `Date` values; ob-api formats them as OpenBoxes expects.
- An unexpected response rejects with an `HttpError` that keeps the response, as an invalid JSON body already does.
- `chooseLocation` goes through the session, so later automatic logins keep the chosen location.
- New dependency: `purify-ts`. ob-api uses it internally; the public types do not expose it.
- README: a "Typed endpoints" section.

## User impact

Apps can replace hand-written calls:

```ts
// before
const res = await api
    .get<{ data: OBProductResponseData[]; totalCount: number }>("/products")
    .getData();

// after
const { objects, total } = await api.products.list({ max: 50 }).getData();
```

## Compatibility

Additions only. Existing calls keep their behavior. Public interface, old vs new:

|                    | Old                                                         | New                                                                                                                                 |
| ------------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `OBApi` properties | none                                                        | `products`, `locations`, `stockMovements`, `partialReceipts`, `transactionTypes`, `inventories`, `transactions`, `people`           |
| `OBApi` methods    | `login`, `request`, `get`, `post`, `put`, `patch`, `delete` | the same, plus `chooseLocation`                                                                                                     |
| Exports            | —                                                           | the result, parameter and input types of each resource, `Paginated`, `ListResult`, and the `const` arrays of the closed status sets |

## Rollback plan

Remove the new properties and `chooseLocation`. No app uses them yet, and the generic client does not change.

## Capabilities

### New Capabilities

- `api-products`: typed product list and product availability.
- `api-locations`: typed location list.
- `api-stock-movements`: typed stock movement list and details, document upload and download.
- `api-partial-receipts`: typed read and save of a partial receipt.
- `api-inventory-transactions`: typed transaction types, inventories and transaction creation.
- `api-people`: typed person search by email.

### Modified Capabilities

- `api-client`: an unexpected response from a typed endpoint rejects with an HTTP error.
- `api-session`: `chooseLocation` changes the session location and keeps it for later logins.

## Impact

- Code: new files under `src/api/` (one per resource, response checks, results, OpenBoxes dates), `src/api/OBApi.ts` (properties and `chooseLocation`), `src/api/session.ts` (`chooseLocation`), `src/index.ts` (exports), `src/utils/arrays.ts` (`chunk`), and a fix in `src/repositories/CancelableResponse.ts` (`flatMap` cancel before the second request starts).
- Dependency: `purify-ts` (runtime, 1 dependency, Node and browser).
- Docs: `README.md`, `DEVELOPMENT.md` (layout).
- Read endpoints verified on the UNICEF OpenBoxes server (`0.9.7-SNAPSHOT`) with GET requests only. Write endpoints: unit tests with bodies taken from UNICEF-TJK-scripts.
