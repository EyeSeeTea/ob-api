# Proposal

## Why

On 2026-11-13, the meeting with Arnau split ob-api into 2 layers:

- A low-level layer ("v1") that mirrors the OpenBoxes API: 1 request per method, the OpenBoxes names and structure, and full types.
- A separate SDK layer, built later, for multi-step workflows, multi-version support and retries.

The 14 typed endpoints from `typed-endpoints-unicef` do not follow these rules yet. They rename fields (`productId`), flatten structures (the receipt `items`, the stock movement `associations`), and `products.availableItems` sends more than 1 request. Also, `request` is not typed. Change this now: there are no consumers yet, and the SP endpoints (the next change) must follow the same rules from the start.

## What Changes

- **New: a typed `request`.** A map from method and path to the params, the body and the response of each typed endpoint. A wrong method, path, param or body is a TypeScript error. The response is checked at runtime with the endpoint's codec. The resource methods call it.
- **BREAKING: the untyped `request` is renamed to `requestUntyped`.** `get`, `post`, `put`, `patch` and `delete` stay untyped, as the escape hatch for endpoints that are not typed (as in d2-api).
- **BREAKING: the response types follow the OpenBoxes structure.** Only mechanical changes are allowed: dotted keys become nested objects (`"product.id"` → `product: { id }`), `null` becomes `undefined`, and untyped fields are left out. There are no renames and no flattening.
    - Partial receipts keep `containers[].shipmentItems[]`, instead of the flattened `items`.
    - Stock movements keep `associations: { shipment, documents }`, instead of `shipmentId` and `documents`.
    - Available items, receipt items, inventories and transaction types use nested objects, instead of `…Id` fields.
- **BREAKING: the params and the write inputs follow the OpenBoxes body.** For example, a transaction input has `transactionType: { id }` and `transactionEntries`, a receipt input has `containers`, and the stock movement list takes `receiptStatusCode`. A `Date` is still accepted, and is sent in the OpenBoxes date format.
- **BREAKING: `products.availableItems` sends 1 request.** The chunks of 50 products move to the SDK layer.
- **BREAKING: `people.search` takes the OpenBoxes `searchAttributes`**, instead of `{ email }`.
- No change: the session, the location handling, cancelation, `uploadDocument`, `downloadDocument` and `chooseLocation`.

Old vs new public interface:

| Old                                                                                                      | New                                                                               |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `api.request<T>(options)`                                                                                | `api.request({ method, path, … })`, typed; `api.requestUntyped<T>(options)`       |
| `OBAvailableItem.inventoryItemId`, `.productId`                                                          | `.inventoryItem.id`, `.product.id`                                                |
| `OBPartialReceipt.items[]`, with `productId`, `productCode`, `productName`, `containerId`, `recipientId` | `.containers[].shipmentItems[]`, with `product`, `container`, `recipient` objects |
| `OBStockMovement.shipmentId`, `.documents`                                                               | `.associations.shipment.id`, `.associations.documents`                            |
| `OBInventory.warehouseId`                                                                                | `.warehouse.id`                                                                   |
| `OBTransactionType.transactionCode: "DEBIT"`                                                             | `.transactionCode.name: "DEBIT"`                                                  |
| `stockMovements.list({ receiptStatusCodes })`                                                            | `stockMovements.list({ receiptStatusCode })`                                      |
| `products.availableItems({ locationId, productIds })`: N requests                                        | `products.availableItems({ location: { id }, product: { id } })`: 1 request       |
| `PartialReceiptInput { recipientId, items }`                                                             | `{ containers: [{ shipmentItems }] }`, with `recipient` on each item              |
| `TransactionInput { transactionTypeId, inventoryId, entries }`                                           | `{ transactionType: { id }, inventory: { id }, transactionEntries }`              |
| `people.search({ email })`                                                                               | `people.search({ searchAttributes })`                                             |

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `api-client`: the typed `request`, the `requestUntyped` escape hatch, and the shape rules for the typed endpoints.
- `api-products`: available items with nested objects, in 1 request.
- `api-stock-movements`: `associations` in the result, and `receiptStatusCode` as the list param.
- `api-partial-receipts`: `containers` in the result and in the input, with nested objects.
- `api-inventory-transactions`: nested objects in the results and in the input.
- `api-people`: search with `searchAttributes`.

## Goals

- The low-level layer matches the OpenBoxes API, so the Grails source and real responses map 1 to 1 to the types.
- A typo in a method, a path or a param is a TypeScript error.

## Non-goals

- The SDK layer (workflows, chunking, version detection, retries). It comes in a later change.
- New endpoints. The SP endpoints come in the next change.
- Typed entries for the calls outside the JSON API (`uploadDocument`, `downloadDocument`, `chooseLocation`). They stay as they are.
- Detecting the OpenBoxes version.

## User impact

There are no consumers yet: ob-api is not published, and UNICEF-TJK-scripts does not use it. The breaking changes cost nothing now. Later, they would need a major version.

## Compatibility

All listed changes are breaking for the typed endpoints. The untyped helpers `get`, `post`, `put`, `patch` and `delete` do not change.

## Rollback plan

Revert the commits of this change on `feature/typed-endpoints`. Nothing is published, and no data is migrated.

## Impact

- Code: `src/api/OBApi.ts`, `src/api/responseCheck.ts`, a new endpoint map module, and the 6 resource modules in `src/api/`; `src/index.ts` (exports).
- Tests: the specs of the 6 modules and `responseCheck`, plus type tests for the typed `request`.
- Docs: the README "Typed endpoints" section, and DEVELOPMENT.md (layout).
- The live check scripts (read and write) must run again on the test server.
