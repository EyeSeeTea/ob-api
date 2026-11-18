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

#### Read

| Method                                                                                          | Request                              | Result                                         |
| ----------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------- |
| `products.list({ max?, offset?, q? })`                                                          | `GET /products`                      | `{ objects: OBProduct[], total }`              |
| `products.availableItems({ location: { id }, product: { id: [...] } })`                         | `GET /products/availableItems`       | `{ objects: OBAvailableItem[] }`               |
| `locations.list({ locationTypeCode? })`                                                         | `GET /locations`                     | `{ objects: OBLocation[] }`                    |
| `stockMovements.list({ direction, origin and/or destination, receiptStatusCode?, max?, offset? })` | `GET /stockMovements`                | `{ objects: OBStockMovementSummary[], total }` |
| `stockMovements.get(id)`                                                                        | `GET /stockMovements/{id}`           | `OBStockMovement`                              |
| `stockMovements.downloadDocument(uri)`                                                          | `GET <uri>`                          | `Blob`                                         |
| `partialReceipts.get(shipmentId)`                                                               | `GET /partialReceiving/{shipmentId}` | `OBPartialReceipt`                             |
| `transactionTypes.list()`                                                                       | `GET /generic/TransactionType`       | `{ objects: OBTransactionType[] }`             |
| `inventories.list()`                                                                            | `GET /generic/inventory`             | `{ objects: OBInventory[] }`                   |
| `people.search({ searchAttributes })`                                                           | `POST /generic/person/search`        | `{ objects: OBPerson[] }`                      |

#### Write

| Method                                              | Request                                                         | Result             |
| --------------------------------------------------- | --------------------------------------------------------------- | ------------------ |
| `stockMovements.uploadDocument(id, file, fileName)` | `POST /openboxes/stockMovement/uploadDocument/{id}` (form data) | nothing            |
| `partialReceipts.savePending(shipmentId, receipt)`  | `POST /partialReceiving/{shipmentId}` (`PENDING`)               | `OBPartialReceipt` |
| `partialReceipts.complete(shipmentId, receipt)`     | `POST /partialReceiving/{shipmentId}` (`COMPLETED`)             | nothing            |
| `transactions.create(transaction)`                  | `POST /generic/transaction`                                     | `{ id }`           |
| `chooseLocation(locationId)`                        | `GET /chooseLocation/{locationId}`                              | nothing            |

Results:

- A list result is `{ objects }`, or `{ objects, total }` when OpenBoxes sends `totalCount`. `total` is the number of matches on the server. `objects` is one page.
- A reference from dotted keys is `undefined` when OpenBoxes sends no id: `"binLocation.id": null` gives `binLocation: undefined`.
- Dates are the strings OpenBoxes sends: `MM/dd/yyyy`, `MM/dd/yyyy HH:mm Z` or ISO 8601, without conversion.
- A partial receipt has `containers`, each with its `container` (`id`, `name`) and its `shipmentItems`, in the order that OpenBoxes sends.
- A stock movement has `associations: { shipment, documents }`. `stockMovements.list` returns `associations` without `documents`, because OpenBoxes does not send them in the list. Use `stockMovements.get(id)` to read them.
- Stock movement `statusCode` is a string, because OpenBoxes sends values outside its own list (for example `ISSUED`).
- After `complete`, a new `partialReceipts.get` shows `receiptStatus: "PENDING"` again: it is an empty receipt for a next partial receipt. To check that a shipment is received, read the stock movement `shipmentStatus` (`RECEIVED`).

Parameters and inputs:

- Inputs use the OpenBoxes names and nesting: `{ id }` objects (`transactionType: { id }`), `containers` for a receipt, `transactionEntries` for a transaction.
- `q` is a search: OpenBoxes matches it against the name, the code and other fields. Filter the result for an exact code.
- `availableItems` sends all the product ids in 1 request. Keep the list short (for example 50 ids), so the URL stays under the server limit. For more products, call it once for each group of ids. An empty list gives no items and sends no request, because OpenBoxes answers `500` without `product.id`.
- `locations.list` returns the locations the user can see. OpenBoxes does not page this list.
- `locationTypeCode` is one of `OB_LOCATION_TYPE_CODES`, the `LocationTypeCode` enum of OpenBoxes. OpenBoxes answers `500` for other values.
- `stockMovements.list` needs `direction` and at least one of `origin` and `destination`, or OpenBoxes answers `400`. The type requires them. `origin` and `destination` must also be different: OpenBoxes answers `400` when they are the same. `receiptStatusCode` accepts only shipment statuses (`OB_SHIPMENT_STATUSES`); OpenBoxes answers `500` for other values.
- `savePending` and `complete` send `dateDelivered` in UTC as `MM/dd/yyyy HH:mm Z`, the only format OpenBoxes accepts. They send `null` for absent receipt ids, lots and expiry dates, so OpenBoxes clears them. Each item needs `lotNumber` and `expirationDate`: OpenBoxes receives the stock into the lot of the body, not of the shipment, so copy them from `get()`. `undefined` receives the stock without a lot. `complete` rejects an answer that is not the empty `{ data: {} }`.
- `people.search` takes the generic OpenBoxes search body. `operator` is `eq` (exact), `like` or `ilike` (ignores case); `like` and `ilike` take `%` as the wildcard. `search` rejects an attribute with an empty `property` or `value` before the request, because OpenBoxes answers `500` for it.
- `uploadDocument` posts outside `apiPath`, to the OpenBoxes web app path: `apiPath` without its last `api` segment (`openboxes/api` gives `openboxes`).
- `downloadDocument` accepts only a URI on the OpenBoxes server (it starts with `baseUrl`), so the session cookie goes nowhere else. For another URI, it rejects without a request.
- `chooseLocation` changes the location of the current session, and later automatic logins use it. `login(locationId)` does the same with a new login.

The session location also controls permissions. A user with a role only at a location must have the session at that location to write there: set `locationId`, or call `chooseLocation`. Otherwise OpenBoxes answers `403`.

The client checks each response. When a field it returns is missing or has a wrong type, the request rejects with an `HttpError` that names the request and the field, and keeps the response. Fields that the client does not return are ignored, so new fields in a newer OpenBoxes do not cause an error. A new value in a closed status set (the `OB_*` arrays) fails the check.

For endpoints that ob-api does not type, use `requestUntyped` or the generic methods. They send any request and do not check the response.

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
