# Design

## Context

`low-level-v1` set the rules for the low layer: 1 request for each method, the OpenBoxes names and structure, and only mechanical changes. It also made `api.request` typed, with an endpoint map (`src/api/endpoints.ts`) from `"<method> <path>"` to the params, the body and the response codec. This change adds about 38 endpoints to that map, and the resource methods on top of them. See `proposal.md` for the motivation and the scope.

The source of the request and response shapes is OpenBoxes `v0.9.7` (`UrlMappings.groovy`, the `*ApiController` classes, `BootStrap.groovy` marshallers, the domain `toJson` methods). The test server runs `0.9.7-SNAPSHOT`. The SP server version is not known.

## Goals / Non-Goals

**Goals:**

- One way to add an endpoint: a key in the endpoint map, a codec, and a resource method that reshapes the result. No new mechanism in the request path.
- Each answer shape that differs from `{ data }` is in the codec of its endpoint, not in a special case in the client.

**Non-Goals:**

- Typing every field that OpenBoxes sends. Each codec checks the fields that the specs name; the client ignores the others, as in `low-level-v1`.
- A generic `/generic/{resource}` endpoint with a free resource name. It cannot type the body or the answer (see decision 2).

## Decisions

### 1. Data flow

The flow is the same as in `low-level-v1`:

resource method (`api.stockTransfers.create`) → builds the OpenBoxes body (`Date` to the OpenBoxes string) → `api.request` (finds the key in the endpoint map, builds the path, checks the answer with the codec) → `requestUntyped` → session → `HttpClientRepository`.

The resource method then makes the mechanical changes to the result: dotted keys (`"origin.id"`) to nested objects, `null` and `""` to `undefined`, and the envelope to `{ objects, total }`.

### 2. `api.generic` with a literal path for each resource

`src/api/generic.ts` builds `api.generic` from small resource factories: `products`, `productPackages`, `orders`, and the moved `transactionTypes`, `inventories`, `transactions` and `people`. Each resource has its own keys in the endpoint map, for example `"put /generic/product/{id}"`.

- **Why:** the body and the answer depend on the resource. A key with a free `{resource}` parameter could only type them as `unknown`.
- **Alternative:** `api.generic.update("product", id, body)` with a resource-name parameter. It is shorter, but TypeScript cannot check the body, and the caller must know the Grails class names.
- **Name rule:** the namespace name is plural (`products`); the path has the Grails class name with a lowercase first letter (`/generic/product`), because `GenericApiService.getDomainClass` capitalizes it to find the class.

The existing generic-based files (`inventoryTransactions.ts`, `people.ts`) keep their code. Only `OBApi` changes the place where it exposes them.

### 3. Empty answers

12 of the new endpoints answer with no body: deletes (`204`), `sendShipment`, `rollback`, `status`, `updateShipment` and the picklist calls (`200`). The fetch client gives `""` for an empty body (`FetchHttpClientRepository.ts:120`). One shared codec, `emptyResponseCodec`, accepts only `""`. The resource method maps it to `undefined`.

- **Alternative:** `responseDataType: "raw"` for these calls. It would skip the check, so an unexpected JSON answer (for example an error page with status `200`) would pass without a sign.

### 4. Answers without the `{ data }` envelope

The codec of each endpoint describes the real envelope:

| Endpoint                                                     | Answer                                                                                        |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `POST /products`                                             | `{ product }`                                                                                 |
| `GET`, `POST`, `PUT /categories/{id}` and `POST /categories` | the category itself                                                                           |
| `POST /productPackages`                                      | `{ data }` with the product supplier, not the package                                         |
| `GET /stockTransfers` and `GET /purchaseOrders`              | `{ data, totalCount }` (and `totalPrice` for orders)                                          |
| `POST /stockMovements/{id}/updateRequisition`                | a redirect to the movement; `fetch` follows it and the answer is `{ data }` with the movement |

### 5. Calls that change data with `GET`

OpenBoxes maps `createPickList` and `validatePicklist` to `GET`. The endpoint map uses `get`, as OpenBoxes does. The method names (`createPicklist`, `validatePicklist`) and the README say that they change data.

### 6. `""` as an absent value

`StockTransfer.toJson` sends `""` for absent `dateShipped`, `expectedDeliveryDate`, `trackingNumber`, `driverName`, `comments` and `documents`. The codec accepts `string`, and the resource method maps `""` to `undefined`, the same mechanical change as `null`. A helper `emptyToUndefined` goes next to `nullish` in `responseCheck.ts`.

### 7. Live checks

Each new write endpoint gets one live check on the test server as `obapi-test` (Manager at `ob-api test`), with the session location set. The checks create their own data (a category, a product, a location, a transfer, an adjustment, an inbound movement, a purchase order), and the delete checks remove it again where OpenBoxes allows it. The results go in `.local/write-test-data.md`.

## Risks / Trade-offs

- [The SP server runs a different OpenBoxes version] → The shapes come from 0.9.7. The codecs fail with an `HttpError` that names the field, so a difference shows on the first call. The version detection of the SDK layer handles it later.
- [The generic API binds any field of the domain class (`domainObject.properties = jsonObject`)] → The input types allow only the fields of the specs, so a typed call cannot set other fields by mistake. `requestUntyped` stays available for other fields.
- [`PUT /categories/{id}` binds `params`, not the JSON body (`CategoryApiController.save`)] → With `parseRequest: true`, Grails puts the JSON fields in `params`. The live check confirms it. If it fails, the update sends the fields as query parameters, and the spec scenario changes.
- [The generic create of an `Order` needs an origin and a destination with an organization] → The spec says so. The live check uses the supplier of the test data, which has an organization.
- [About 38 new endpoint keys make `endpoints.ts` long] → The map stays one table, grouped by resource with a comment line for each group. The codecs stay in the resource files.

## Migration Plan

1. Move the 4 generic resources under `api.generic` (breaking, no consumers).
2. Add the resources one by one, each with its tests and its live check.
3. Update the README "Typed endpoints" tables and `DEVELOPMENT.md`.

Rollback: revert the commits of this change on `feature/typed-endpoints`.

## Open Questions

- Does `POST /stockAdjustments` answer the adjustments with an `id`? The marshalled `StockAdjustment` is not a domain class. The live check decides which fields the codec checks; the spec needs only `{ objects }`.
- Does `DELETE /generic/product/{id}` work for a product that has stock or transactions? The live check uses a new product without stock.
