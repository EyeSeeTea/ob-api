# ob-api

TypeScript library to call the [OpenBoxes](https://openboxes.com/) REST API. It runs in Node and in the browser.

## Usage

```ts
import { OBApi } from "@eyeseetea/ob-api";

const api = new OBApi({
    baseUrl: "https://ob.example.org",
    auth: { username: process.env.OB_USERNAME ?? "", password: process.env.OB_PASSWORD ?? "" },
    locationId: "8a8a9e9665c4f59d0165c54ec6b10027", // optional
    timeout: 30_000, // optional, in milliseconds
});

const products = await api.get<{ data: Product[] }>("/products", { max: 10 }).getData();
```

The methods have the same argument order as d2-api: `params` is always the second argument.

| Method                       | Request                                                        |
| ---------------------------- | -------------------------------------------------------------- |
| `get(url, params?)`          | `GET`                                                          |
| `post(url, params?, data?)`  | `POST` with a JSON body                                        |
| `put(url, params?, data?)`   | `PUT` with a JSON body                                         |
| `patch(url, params?, data?)` | `PATCH` with a JSON Patch body (`application/json-patch+json`) |
| `delete(url, params?)`       | `DELETE`                                                       |

Each method returns a `CancelableResponse`. Call `getData()` for the body, `response()` for the status, headers and body, or `cancel()` to stop the request.

The client returns the body as OpenBoxes sends it. It does not remove the `{ data }` wrapper.

### Typed endpoints

The [endpoints wiki](https://github.com/EyeSeeTea/ob-api/wiki) is the team guide: it tells you which method to use for each task, with workflows and the known OpenBoxes issues.

ob-api has 2 typed levels. Both send 1 request for each call, and both check the response.

**1. Resource methods.** They keep the OpenBoxes names and structure, and make only mechanical changes: a dotted key becomes a nested object (`"product.id"` → `product: { id }`), `null` becomes `undefined`, and a `Date` input is sent in the format that OpenBoxes accepts.

```ts
const { objects: products, total } = await api.products.list({ max: 50, offset: 0 }).getData();

const { objects: inbound } = await api.stockMovements
    .list({ direction: "INBOUND", destination: locationId, receiptStatusCode: ["SHIPPED"] })
    .getData();

const receipt = await api.partialReceipts.get(shipmentId).getData();

const pending = await api.partialReceipts
    .savePending(shipmentId, {
        dateDelivered: new Date(),
        containers: receipt.containers.map(({ shipmentItems }) => ({
            shipmentItems: shipmentItems.map(item => ({
                shipmentItemId: item.shipmentItemId,
                lotNumber: item.lotNumber,
                expirationDate: item.expirationDate,
                quantityReceiving: item.quantityRemaining,
                cancelRemaining: false,
            })),
        })),
    })
    .getData();
// Then `complete(shipmentId, …)` with `receiptId: pending.receiptId` and the `receiptItemId` of each item.
```

**2. `request`.** It takes the OpenBoxes method and path, and returns the body exactly as OpenBoxes sends it (the `data` envelope, dotted keys, `null`). A wrong method, path, path parameter, query parameter or body field is a TypeScript error. Methods are lowercase, as in d2-api.

```ts
const body = await api
    .request({ method: "get", path: "/stockMovements/{id}", pathParams: { id: movementId } })
    .getData();
// body.data.associations?.shipment?.id

api.request({ method: "get", path: "/stockMovments" }); // TypeScript error: no such endpoint
```

The paths are relative to `apiPath`. "nothing" means that the request resolves with `undefined`.

#### Products, locations and categories

| Method                                                                  | Request                                                            | Result                                |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------- |
| `products.list({ max?, offset?, q? })`                                  | `GET /products`                                                    | `{ objects: OBProduct[], total }`     |
| `products.availableItems({ location: { id }, product: { id: [...] } })` | `GET /products/availableItems`                                     | `{ objects: OBAvailableItem[] }`      |
| `products.create(product)`                                              | `POST /products`                                                   | `OBCreatedProduct`                    |
| `productPackages.create(command)`                                       | `POST /productPackages`                                            | `{ id }` of the product supplier      |
| `locations.list({ locationTypeCode? })`                                 | `GET /locations`                                                   | `{ objects: OBLocation[] }`           |
| `locations.get(id)`, `create(location)`, `update(id, fields)`           | `GET /locations/{id}`, `POST /locations`, `POST /locations/{id}`   | `OBLocation`                          |
| `locations.delete(id)`                                                  | `DELETE /locations/{id}`                                           | nothing                               |
| `locations.locationTypes()`                                             | `GET /locations/locationTypes`                                     | `{ objects: OBLocationTypeDetail[] }` |
| `categories.list()`                                                     | `GET /categories`                                                  | `{ objects: OBCategory[] }`           |
| `categories.get(id)`, `create(category)`, `update(id, fields)`          | `GET /categories/{id}`, `POST /categories`, `PUT /categories/{id}` | `OBCategory`                          |
| `categories.delete(id)`                                                 | `DELETE /categories/{id}`                                          | nothing                               |

#### Stock movements, receipts and transfers

| Method                                                                                             | Request                                                                        | Result                                         |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------- |
| `stockMovements.list({ direction, origin and/or destination, receiptStatusCode?, max?, offset? })` | `GET /stockMovements`                                                          | `{ objects: OBStockMovementSummary[], total }` |
| `stockMovements.get(id)`                                                                           | `GET /stockMovements/{id}`                                                     | `OBStockMovement`                              |
| `stockMovements.create(movement)`                                                                  | `POST /stockMovements`                                                         | `OBStockMovement`                              |
| `stockMovements.updateItems(id, { lineItems, removeEmptyItems? })`                                 | `POST /stockMovements/{id}/updateItems`                                        | `OBStockMovement`                              |
| `stockMovements.updateRequisition(id, fields)`                                                     | `POST /stockMovements/{id}/updateRequisition`                                  | `OBStockMovement`                              |
| `stockMovements.updateShipment(id, fields)`                                                        | `POST /stockMovements/{id}/updateShipment`                                     | nothing                                        |
| `stockMovements.updateStatus(id, { status, rollback?, statusOnly?, clearPicklist? })`              | `POST /stockMovements/{id}/status`                                             | nothing                                        |
| `stockMovements.createPicklist(id)`                                                                | `GET /stockMovements/createPickList/{id}`                                      | nothing                                        |
| `stockMovements.validatePicklist(id)`                                                              | `GET /stockMovements/{id}/validatePicklist`                                    | nothing                                        |
| `stockMovements.delete(id)`                                                                        | `DELETE /stockMovements/{id}`                                                  | nothing                                        |
| `stockMovements.uploadDocument(id, file, fileName)`                                                | `POST /openboxes/stockMovement/uploadDocument/{id}` (form data)                | nothing                                        |
| `stockMovements.downloadDocument(uri)`                                                             | `GET <uri>`                                                                    | `Blob`                                         |
| `partialReceipts.get(shipmentId)`                                                                  | `GET /partialReceiving/{shipmentId}`                                           | `OBPartialReceipt`                             |
| `partialReceipts.savePending(shipmentId, receipt)`                                                 | `POST /partialReceiving/{shipmentId}` (`PENDING`)                              | `OBPartialReceipt`                             |
| `partialReceipts.complete(shipmentId, receipt)`                                                    | `POST /partialReceiving/{shipmentId}` (`COMPLETED`)                            | nothing                                        |
| `stockTransfers.list({ location, max?, offset? })`                                                 | `GET /stockTransfers`                                                          | `{ objects: OBStockTransferSummary[], total }` |
| `stockTransfers.get(id)`, `create(transfer)`, `update(id, transfer)`                               | `GET /stockTransfers/{id}`, `POST /stockTransfers`, `PUT /stockTransfers/{id}` | `OBStockTransfer`                              |
| `stockTransfers.delete(id)`, `sendShipment(id)`, `rollback(id)`                                    | `DELETE /stockTransfers/{id}`, `POST …/sendShipment`, `POST …/rollback`        | nothing                                        |

#### Purchase orders and session

| Method                                      | Request                                                             | Result                                                    |
| ------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------- |
| `purchaseOrders.list({ max?, offset? })`    | `GET /purchaseOrders`                                               | `{ objects: OBPurchaseOrderSummary[], total }`            |
| `purchaseOrders.get(id)`                    | `GET /purchaseOrders/{id}`                                          | `OBPurchaseOrder`                                         |
| `purchaseOrders.delete(id)`, `rollback(id)` | `DELETE /purchaseOrders/{id}`, `POST /purchaseOrders/{id}/rollback` | nothing                                                   |
| `chooseLocation(locationId)`                | `GET /chooseLocation/{locationId}`                                  | nothing                                                   |
| `appContext.get()`                          | `GET /getAppContext` (`500` without a session location)             | `OBAppContext` (`appVersion`, `buildNumber`, `buildDate`) |

#### Generic API (`api.generic`)

OpenBoxes also has a generic API, `/generic/{resource}`, for its domain classes. The resources that ob-api reads or writes through it are under `api.generic`. Each one has its own path, so `api.request` checks its body and its answer. A resource with a dedicated API stays at the top level: `api.products.create` uses `/products`, and `api.generic.products.update` uses `/generic/product/{id}`, because `/products` has no update.

| Method                                                                            | Request                                                                   | Result                             |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------- |
| `generic.products.get(id)`, `update(id, fields)`                                  | `GET`, `PUT /generic/product/{id}`                                        | `OBGenericProduct`                 |
| `generic.products.delete(id)`                                                     | `DELETE /generic/product/{id}`                                            | nothing                            |
| `generic.productPackages.get(id)`, `create(productPackage)`, `update(id, fields)` | `GET`, `PUT /generic/productPackage/{id}`, `POST /generic/productPackage` | `OBProductPackage`                 |
| `generic.productPackages.delete(id)`                                              | `DELETE /generic/productPackage/{id}`                                     | nothing                            |
| `generic.orders.create(order)`                                                    | `POST /generic/order`                                                     | `OBPurchaseOrder`                  |
| `generic.transactionTypes.list()`                                                 | `GET /generic/TransactionType`                                            | `{ objects: OBTransactionType[] }` |
| `generic.inventories.list()`                                                      | `GET /generic/inventory`                                                  | `{ objects: OBInventory[] }`       |
| `generic.transactions.create(transaction)`                                        | `POST /generic/transaction`                                               | `{ id }`                           |
| `generic.people.search({ searchAttributes })`                                     | `POST /generic/person/search`                                             | `{ objects: OBPerson[] }`          |

```ts
const product = await api.products
    .create({ name: "Gloves", category: { id: categoryId }, productType: { id: "DEFAULT" } })
    .getData();
await api.generic.products.update(product.id, { description: "Nitrile, size M" }).getData();

// The same update, at the low level:
await api
    .request({
        method: "put",
        path: "/generic/product/{id}",
        pathParams: { id: product.id },
        data: { description: "Nitrile, size M" },
    })
    .getData();
```

For a generic resource that ob-api does not type, use `requestUntyped`, for example `api.requestUntyped({ method: "get", url: "/generic/productSupplier/ps-1" })`.

Results:

- A list result is `{ objects }`, or `{ objects, total }` when OpenBoxes sends `totalCount`. `total` is the number of matches on the server. `objects` is one page.
- A reference from dotted keys is `undefined` when OpenBoxes sends no id: `"binLocation.id": null` gives `binLocation: undefined`.
- Dates are the strings OpenBoxes sends: `MM/dd/yyyy`, `MM/dd/yyyy HH:mm Z` or ISO 8601, without conversion.
- A partial receipt has `containers`, each with its `container` (`id`, `name`) and its `shipmentItems`, in the order that OpenBoxes sends.
- A stock movement has `associations: { shipment, documents }`. `stockMovements.list` returns `associations` without `documents`, because OpenBoxes does not send them in the list. Use `stockMovements.get(id)` to read them.
- Stock movement `statusCode` is a string, because OpenBoxes sends values outside its own list (for example `ISSUED`).
- OpenBoxes does not answer every call with `{ data }`. ob-api reads the real answer of each endpoint: `products.create` reads `{ product }`, and the category read and save read the category itself. `productPackages.create` returns the product supplier, because OpenBoxes answers with it, not with the package.
- A stock transfer sends `""` for some absent strings (`dateShipped`). The result has `undefined` for them, as for `null`.
- A purchase order of the list has `origin` and `destination` as location names, as OpenBoxes sends them.
- After `complete`, a new `partialReceipts.get` shows `receiptStatus: "PENDING"` again: it is an empty receipt for a next partial receipt. To check that a shipment is received, read the stock movement `shipmentStatus` (`RECEIVED`).

Parameters and inputs:

- Inputs use the OpenBoxes names and nesting: `{ id }` objects (`transactionType: { id }`), `containers` for a receipt, `transactionEntries` for a transaction.
- `q` is a search: OpenBoxes matches it against the name, the code and other fields. Filter the result for an exact code.
- `availableItems` sends all the product ids in 1 request. Keep the list short (for example 50 ids), so the URL stays under the server limit. For more products, call it once for each group of ids. An empty list gives no items and sends no request, because OpenBoxes answers `500` without `product.id`.
- `locations.list` returns the locations the user can see. OpenBoxes does not page this list.
- `locationTypeCode` is one of `OB_LOCATION_TYPE_CODES`, the `LocationTypeCode` enum of OpenBoxes. OpenBoxes answers `500` for other values.
- `stockMovements.list` needs `direction` and at least one of `origin` and `destination`, or OpenBoxes answers `400`. The type requires them. `origin` and `destination` must also be different: OpenBoxes answers `400` when they are the same. `receiptStatusCode` accepts only shipment statuses (`OB_SHIPMENT_STATUSES`); OpenBoxes answers `500` for other values.
- `savePending` and `complete` send `dateDelivered` in UTC as `MM/dd/yyyy HH:mm Z`, the only format OpenBoxes accepts. They send `null` for absent receipt ids, lots and expiry dates, so OpenBoxes clears them. Each item needs `lotNumber` and `expirationDate`: OpenBoxes receives the stock into the lot of the body, not of the shipment, so copy them from `get()`. `undefined` receives the stock without a lot. `complete` rejects an answer that is not the empty `{ data: {} }`.
- A stock request is a stock movement with a requisition. OpenBoxes has no separate stock request API, so use the `stockMovements` methods: `create`, `updateItems`, `updateStatus`, the picklist methods and `updateShipment`. Each method sends 1 request; the order of the requests (a workflow) is the caller's job.
- `stockMovements.create` sends `dateRequested` as `MM/dd/yyyy` in UTC. `updateShipment` sends `dateShipped` and `expectedDeliveryDate` in UTC as `MM/dd/yyyy HH:mm Z`. `stockTransfers.create` and `update` send `dateShipped` as `MM/dd/yyyy`.
- `createPicklist` and `validatePicklist` change data, but OpenBoxes maps them to `GET`, so ob-api sends `GET`.
- ob-api has no stock adjustment method: `POST /stockAdjustments` answers `500` on OpenBoxes 0.9.7 up to `develop` (checked on 2026-11-19), because its controller sets a field that does not exist (`AdjustStockCommand.quantity`). To change stock, use `generic.transactions.create` with an adjustment transaction type.
- `stockTransfers.list` needs `location`, or OpenBoxes answers `400`. It returns summaries (`orderNumber`, location names). Use `get(id)` for the items. `stockTransfers.create` and `update` need a session location. `update` also sends the `id` in the body, because OpenBoxes reads it from there and creates a new transfer without it.
- `products.create` needs `productType`: OpenBoxes rejects a product without one. A new server has `{ id: "DEFAULT" }`.
- `locations.create` needs `organization` for most location types (for example a depot), or OpenBoxes answers `400`.
- `locations.delete` rejects on OpenBoxes 0.9.7 although the location is deleted: OpenBoxes answers `404` after the delete. ob-api does not hide the status. To confirm the delete, call `locations.get(id)`: it rejects, because OpenBoxes answers `{ data: null }` for a deleted location.
- `categories.update` sends the fields as query parameters, because OpenBoxes ignores the body of a category update.
- A generic delete (`generic.products.delete`, `generic.productPackages.delete`) answers `500` ("existing association") while other records point to the record. Delete them first, or unset the link (for example the `defaultProductPackage` of a product supplier).
- `purchaseOrders.get` and `generic.orders.create` give `status` as `{ name }`, as OpenBoxes sends it. The create answer has no `orderNumber`, because OpenBoxes gives the number later. Read it with `purchaseOrders.get`.
- `generic.orders.create` needs an `origin` and a `destination` that have an organization. `purchaseOrders.delete` works only for a `PENDING` order; OpenBoxes answers `400` for other orders.
- An update sends only the fields that you give (`locations.update`, `categories.update`, the generic `update` methods).
- `generic.people.search` takes the generic OpenBoxes search body. `operator` is `eq` (exact), `like` or `ilike` (ignores case); `like` and `ilike` take `%` as the wildcard. `search` rejects an attribute with an empty `property` or `value` before the request, because OpenBoxes answers `500` for it.
- `uploadDocument` posts outside `apiPath`, to the OpenBoxes web app path: `apiPath` without its last `api` segment (`openboxes/api` gives `openboxes`).
- `downloadDocument` accepts only a URI on the OpenBoxes server (it starts with `baseUrl`), so the session cookie goes nowhere else. For another URI, it rejects without a request.
- `chooseLocation` changes the location of the current session, and later automatic logins use it. `login(locationId)` does the same with a new login.

The session location also controls permissions. A user with a role only at a location must have the session at that location to write there: set `locationId`, or call `chooseLocation`. Otherwise OpenBoxes answers `403`.

The client checks each response. When a field it returns is missing or has a wrong type, the request rejects with an `HttpError` that names the request and the field, and keeps the response. Fields that the client does not return are ignored, so new fields in a newer OpenBoxes do not cause an error. A new value in a closed status set (the `OB_*` arrays) fails the check.

For endpoints that ob-api does not type, use `requestUntyped` or the generic methods. They send any request and do not check the response.

### SDK

The SDK runs OpenBoxes protocols that need more than 1 request. It is a separate layer on top of the client: `OBSdk` sends every request through the `OBApi` that you give it, so both use 1 session. The method names tell you that a call sends several requests.

```ts
import { OBApi, OBSdk } from "@eyeseetea/ob-api";

const api = new OBApi({ baseUrl, auth });
const sdk = new OBSdk({ api });

// 1 + page size requests: the list, then 1 read for each movement, for its documents.
const { objects: movements, total } = await sdk.stockMovements
    .listWithDocuments({ direction: "INBOUND", destination: locationId, max: 20 })
    .getData();

// chooseLocation, read the receipt, save it as PENDING, then complete it.
await sdk.shipments
    .receive({
        shipmentId,
        locationId, // the destination of the shipment
        dateDelivered: new Date(),
        items: [{ shipmentItemId, quantityReceiving: 5 }],
    })
    .getData();
```

- **Workflows.** Each workflow returns a `CancelableResponse`. `cancel()` stops the request in progress and sends no later request.
- **`listWithDocuments`** reads 1 page, as `stockMovements.list` does. It sends at most 4 reads at the same time (`concurrency` option). When 1 read fails, the call fails.
- **`receive`** copies the product, the lot and the expiry of each item from the receipt, because OpenBoxes receives the stock into the lot of the save body. It sends only the items that you give. Give each `shipmentItemId` once: the call rejects a repeated one before any request. It keeps the ids of a receipt that is already `PENDING`, so a second call after a failed completion continues the same receipt. While a receipt is `PENDING`, the receipt has only its saved items: continue it with those items. You decide which items, how many, and whether the shipment is already received.
- **Session location.** A workflow with a `locationId` calls `chooseLocation` first. The workflows of 1 `OBSdk` that take a `locationId` run one at a time, so 2 receipts for 2 locations cannot change the location of each other. After the workflow, the session stays at that location. The lock does not cover your own `api.chooseLocation` or `api.login` calls: if you also change the location directly, give the SDK its own `OBApi`.
- **Retries.** The SDK sends a failed `GET` again after a network error or status `429`, `502`, `503` or `504`: 3 attempts, with a wait of 500 ms, then 1000 ms. It never sends a write again. Set `retry: { attempts: 1 }` to turn the retries off, or change `delayMs`. `new OBSdk` throws a `RangeError` when `retry.attempts` or `concurrency` is not an integer of 1 or more, or when `delayMs` is less than 0.

**Server version.** `sdk.serverVersion()` reads `appVersion` from `getAppContext` once and keeps it. It returns a `CancelableResponse`, as the workflows do. The callers share the read, so a cancel stops only the wait of its caller. OpenBoxes answers that read with `500` when the session has no location, so give a `locationId`, or give the version yourself:

```ts
const version = await sdk.serverVersion({ locationId }).getData(); // { appVersion: "0.9.7-SNAPSHOT", major: 0, minor: 9, patch: 7 }

const sdkForKnownServer = new OBSdk({ api, version: "0.9.7" }); // sends no request for the version
```

The SDK has 1 interface for every OpenBoxes version: its inputs and results have the shapes of the reference version, `v0.9.7` (`OB_REFERENCE_VERSION`). When a server version needs other shapes, a version mapper inside the SDK changes them, and you still see the `v0.9.7` shapes. No mapper exists yet, and `sdk.capabilities()` returns `{}`: no workflow depends on the server version, so the workflows do not read it.

### URLs

Request URLs are relative to `<baseUrl>/<apiPath>`. `apiPath` is `openboxes/api` by default. `api.get("/products")` requests `https://ob.example.org/openboxes/api/products`. Set `apiPath` when OpenBoxes uses a different path.

A URL can already have a query string. The client adds `params` to it: `api.get("/products/1/availableItems?location.id=2", { max: 5 })` requests `…/availableItems?location.id=2&max=5`.

Some OpenBoxes paths are not under `apiPath`. Set `skipApiPrefix: true` to make the URL relative to `baseUrl`. `post()` takes it in its last argument, and `requestUntyped()` takes it in its options. The login still uses `apiPath`.

```ts
await api
    .post("openboxes/stockMovement/uploadDocument/1", undefined, formData, { skipApiPrefix: true })
    .getData();
```

### Request and response bodies

The client sends a plain body (object, array, string) as JSON. It sends a `FormData`, `Blob`, `URLSearchParams`, `ArrayBuffer` or typed-array body as it is, and does not set `Content-Type`: the runtime sets it, with the multipart boundary for `FormData`.

To get the body without parsing, use `requestUntyped({ method: "get", url, responseDataType: "raw" })`. The data is a `Blob`. If you migrate from a client that gave an `ArrayBuffer`, call `await blob.arrayBuffer()`; in Node, `Buffer.from(await blob.arrayBuffer())`.

### Session

You do not log in yourself. The first request logs in to `<apiPath>/login` and the client keeps the session:

- In Node, the client keeps the session cookie and sends it with each request.
- In the browser, the browser keeps the cookie. The app and OpenBoxes must share a domain, or OpenBoxes must allow cross-domain requests with cookies.
- When a request gets status `401` (the session expired), the client logs in again and sends the request one more time.

OpenBoxes answers an expired session with `401` only when the request accepts JSON. The client sends `Accept: application/json, text/plain` on every request. If you set your own `Accept` header, keep `application/json` in it. If you do not, OpenBoxes sends its HTML login page with status `200`: the request looks successful and the client does not log in again.

To change the location, or to refresh the session, call `login`:

```ts
await api.login("8a8a9e9665c4f59d0165c54ec6b10028"); // when it succeeds, later logins use this location
```

When the login fails (for example, the user has no access to that location), `login` rejects and the client keeps the location of the last successful login.

### Errors and cancellation

A failed request rejects with an `HttpError`. It holds the `request` and, when the server responded, the `response` (`status`, `headers`, `data`). A timeout, and a response body that claims to be JSON but does not parse, also reject with an `HttpError`. For an invalid JSON body, `response.data` holds the body as text.

A canceled request rejects with an error that `isCancel` accepts. `cancel(message)` sets the message of that error.

```ts
import { HttpError, isCancel } from "@eyeseetea/ob-api";

async function getProducts(): Promise<unknown> {
    try {
        return await api.get("/products").getData();
    } catch (error) {
        if (isCancel(error)) return undefined;
        if (error instanceof HttpError) console.error(error.response?.status, error.response?.data);
        throw error;
    }
}
```

## Setup

```bash
nvm use
corepack enable
yarn install
```

## Development

| Task                                        | Command         |
| ------------------------------------------- | --------------- |
| Run all checks (types, lint, format, tests) | `yarn check`    |
| Run tests                                   | `yarn test`     |
| Format code                                 | `yarn prettify` |
| Build into `build/`                         | `yarn build`    |

## Release

1. Set `version` in `package.json`. Use a `-beta.N` suffix to publish with the `beta` tag.
2. Run `yarn release`. It builds, publishes `build/` to npm, and pushes a `v<version>` git tag.

See [DEVELOPMENT.md](DEVELOPMENT.md) for the architecture and the conventions.
