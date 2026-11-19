# Proposal

## Why

The Samaritan's Purse (SP) project will use ob-api. On 2026-11-10, Geonina listed the OpenBoxes resources that SP needs. Most of them are writes (create, update, delete), and ob-api types only reads and the UNICEF receipt flow. The team decided to finish all typed endpoints on `feature/typed-endpoints` (PR #2) before the SDK layer starts, so the SDK builds on one complete low-level layer.

## What Changes

The new endpoints follow the `low-level-v1` rules: 1 request for each method, the OpenBoxes names and structure, only mechanical changes (dotted keys to nested objects, `null` to `undefined`, a `Date` input to the OpenBoxes string). Each one is in the endpoint map, so `api.request` checks it too. The source is OpenBoxes `v0.9.7` (the test server). The SP server version is not known yet.

- **Stock movements (writes).** Create a movement, update its items, requisition and shipment, change its status, create and validate the picklist, and delete it. A stock request is a stock movement with a requisition: OpenBoxes has no separate stock request API, and its "Stock Request" pages use the stock movement controller.
- **Stock adjustments.** Create adjustments at a location (`POST /stockAdjustments`).
- **Stock transfers.** List, read, create, update and delete, send the shipment, and roll back.
- **Locations.** Read, create, update and delete one location, and list the location types.
- **Products.** Create a product (`POST /products`). Update and delete through the generic API, because `/products` has no update or delete.
- **Categories.** List, read, create, update and delete.
- **Product packages.** Create (`POST /productPackages`). Read, update and delete through the generic API.
- **Purchase orders.** List, read, delete and roll back (`/purchaseOrders`). Create through the generic API (`order`), because `/purchaseOrders` has no create.
- **`api.generic` namespace.** Every resource that uses the OpenBoxes generic API (`/api/generic/{resource}`) moves under `api.generic`, with a plural name: `api.generic.products`, `api.generic.productPackages`, `api.generic.orders`, and the existing resources.
- **BREAKING:** the 4 existing generic resources move. ob-api has no consumers yet, so the move costs nothing now.

Old and new public names:

| Old                           | New                                   |
| ----------------------------- | ------------------------------------- |
| `api.transactionTypes.list()` | `api.generic.transactionTypes.list()` |
| `api.inventories.list()`      | `api.generic.inventories.list()`      |
| `api.transactions.create(…)`  | `api.generic.transactions.create(…)`  |
| `api.people.search(…)`        | `api.generic.people.search(…)`        |

The OpenBoxes paths of these 4 do not change.

## Goals

- Every item of Geonina's priority list, plus purchase orders, has a typed method and a typed `request` endpoint.
- The generic API has one place in the client, and each generic resource has its own literal path (`/generic/product/{id}`), so TypeScript checks its body and its answer.

## Non-goals

- Workflows that send more than 1 request (for example: create a movement, add items, then dispatch). They belong in the SDK layer.
- Version detection and capability flags (SDK layer).
- Stock transfer candidates and status options, location and product imports (CSV), and other endpoints that SP did not list.
- PurchaseOrder update and order items. Geonina put purchase orders in "later"; this change covers only list, read, create, delete and roll back.

## Capabilities

### New Capabilities

- `api-stock-adjustments`: create stock adjustments at a location.
- `api-stock-transfers`: list, read, create, update, delete, send and roll back stock transfers.
- `api-categories`: list, read, create, update and delete product categories.
- `api-product-packages`: create product packages, and read, update and delete them through the generic API.
- `api-purchase-orders`: list, read, delete and roll back purchase orders, and create them through the generic API.

### Modified Capabilities

- `api-client`: adds the `api.generic` namespace rule (generic resources, literal paths for each resource).
- `api-stock-movements`: adds the write endpoints (create, update items, requisition and shipment, status, picklist, delete).
- `api-locations`: adds read, create, update and delete of one location, and the location types.
- `api-products`: adds product create, and product update and delete through the generic API.
- `api-inventory-transactions`: the methods move to `api.generic.transactionTypes`, `api.generic.inventories` and `api.generic.transactions`.
- `api-people`: the search moves to `api.generic.people`.

## User impact

The SP project gets typed calls for its whole priority flow. A wrong path, parameter or body field is a TypeScript error, and a wrong answer from OpenBoxes is an `HttpError` that names the field.

## Compatibility

Breaking for the 4 moved generic resources (table above). PR #2 already has breaking changes and no consumers, so this goes in the same PR. Every other existing method is unchanged.

## Rollback plan

The change is additive except for the namespace move. To roll back, revert its commits on `feature/typed-endpoints`. The archived `low-level-v1` state is the fallback.

## Impact

- New files in `src/api/`: one for each new resource (`stockAdjustments.ts`, `stockTransfers.ts`, `categories.ts`, `productPackages.ts`, `purchaseOrders.ts`) and `generic.ts` for the namespace.
- Changed: `endpoints.ts` (about 38 new keys), `OBApi.ts`, `stockMovements.ts`, `locations.ts`, `products.ts`, `index.ts`, the README "Typed endpoints" section and `DEVELOPMENT.md`.
- Tests: a spec file for each new resource, and live checks on the OpenBoxes test server as the non-admin user `obapi-test`.
- The test server gets new test data (transfers, adjustments, a category, a product, a purchase order).
