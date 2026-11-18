# api-client Specification

## Purpose

Lets scripts and apps call any OpenBoxes REST endpoint with one generic client, whose API stays close to d2-api's `D2ApiGeneric` so code moves easily between the two libraries.

## Requirements

### Requirement: Request methods and argument order

The client SHALL supply `get(url, params)`, `post(url, params, data)`, `put(url, params, data)`, `patch(url, params, data)` and `delete(url, params)`. `params` is always the second argument. Each method SHALL return a cancelable response that gives the response data.

#### Scenario: Get with parameters

- **WHEN** the caller runs `get("/products", { max: 10 })`
- **THEN** the client sends a `GET` request to the products endpoint with the query `max=10`

#### Scenario: Post with a body

- **WHEN** the caller runs `post("/products", undefined, { name: "Gloves" })`
- **THEN** the client sends a `POST` request with the JSON body `{"name":"Gloves"}`

### Requirement: Patch uses JSON Patch

A `patch` request SHALL send the `Content-Type: application/json-patch+json` header.

#### Scenario: Patch content type

- **WHEN** the caller runs `patch("/products/1", undefined, [{ op: "replace", path: "/name", value: "X" }])`
- **THEN** the client sends a `PATCH` request with the header `Content-Type: application/json-patch+json` and the operations as the JSON body

### Requirement: URLs are relative to the API path

The client SHALL build each request URL from `baseUrl`, then `apiPath`, then the request URL. `apiPath` SHALL default to `openboxes/api`. The client SHALL join the parts with exactly one `/` between them. When a request sets `skipApiPrefix: true`, the client SHALL build the URL from `baseUrl` and the request URL only. The login URL SHALL always use `apiPath`.

#### Scenario: Default API path

- **WHEN** `baseUrl` is `https://ob.example.org` and the caller runs `get("/products")`
- **THEN** the client requests `https://ob.example.org/openboxes/api/products`

#### Scenario: Custom API path

- **WHEN** `apiPath` is `api` and `baseUrl` is `https://ob.example.org/` and the caller runs `get("products")`
- **THEN** the client requests `https://ob.example.org/api/products`

#### Scenario: Skip the API path

- **WHEN** `baseUrl` is `https://ob.example.org` and the caller runs `post("openboxes/stockMovement/uploadDocument/1", undefined, formData, { skipApiPrefix: true })`
- **THEN** the client requests `https://ob.example.org/openboxes/stockMovement/uploadDocument/1`
- **AND** the login request still goes to `https://ob.example.org/openboxes/api/login`

### Requirement: Query parameter encoding

The client SHALL encode query parameter values. It SHALL repeat the key for each value of an array parameter. It SHALL leave out parameters whose value is `undefined`. When the URL already has a query string, the client SHALL add the parameters to it.

#### Scenario: Array parameter

- **WHEN** the caller runs `get("/products", { id: ["1", "2"] })`
- **THEN** the query is `id=1&id=2`

#### Scenario: Undefined parameter

- **WHEN** the caller runs `get("/products", { q: undefined, max: 5 })`
- **THEN** the query is `max=5`

#### Scenario: URL with a query string

- **WHEN** the caller runs `get("/products/1/availableItems?location.id=2", { max: 5 })`
- **THEN** the query is `location.id=2&max=5`

### Requirement: Response data is returned as received

The client SHALL return the parsed response body without changes. It SHALL NOT unwrap an OpenBoxes `{ data }` envelope.

#### Scenario: Wrapped response

- **WHEN** the server responds `{"data":[{"id":"1"}]}`
- **THEN** the response data is `{ data: [{ id: "1" }] }`

### Requirement: Failed requests raise an HTTP error

When the response status is not 2xx, when a body sent as JSON does not parse, or when the request fails without a response, the client SHALL reject with an HTTP error. The error SHALL contain the request and, when the server responded, the response status, headers and body.

#### Scenario: Server error

- **WHEN** the server responds with status `500` and a body
- **THEN** the request rejects with an HTTP error that contains the request, the status `500` and the body

#### Scenario: Network failure

- **WHEN** the server cannot be reached
- **THEN** the request rejects with an HTTP error that contains the request and no response

#### Scenario: Invalid JSON body

- **WHEN** the server responds with status `200`, a JSON content type and a body that is not valid JSON
- **THEN** the request rejects with an HTTP error that contains the status `200` and the body as text

### Requirement: Timeout

When a `timeout` in milliseconds is set, the client SHALL abort a request that takes longer and reject with an HTTP error.

#### Scenario: Slow server

- **WHEN** `timeout` is `1000` and the server does not respond within 1000 ms
- **THEN** the client aborts the request and rejects with an HTTP error

### Requirement: Cancellation

The caller SHALL be able to cancel a request that is in progress, with an optional message. A canceled request SHALL reject, and the caller SHALL be able to tell a cancellation from other errors. The error SHALL keep the cancel message.

#### Scenario: Cancel a request

- **WHEN** the caller cancels a request before the server responds
- **THEN** the request rejects with an error that the library identifies as a cancellation

#### Scenario: Cancel with a message

- **WHEN** the caller runs `cancel("Page closed")` before the server responds
- **THEN** the request rejects with a cancellation whose message is `Page closed`

### Requirement: Form and binary bodies are sent as they are

The client SHALL send a `FormData`, `Blob`, `URLSearchParams`, `ArrayBuffer` or typed-array body without a change, whatever `requestBodyType` is. For these bodies the client SHALL NOT set `Content-Type`, so the runtime sets it (for `FormData`, with the multipart boundary). Other bodies SHALL follow `requestBodyType` as before.

#### Scenario: Post form data

- **WHEN** the caller runs `post("/upload", undefined, formData)` with no other option
- **THEN** the client sends `formData` as the request body
- **AND** the request has no `Content-Type` header set by the client

#### Scenario: A plain object is still sent as JSON

- **WHEN** the caller runs `post("/products", undefined, { name: "Gloves" })`
- **THEN** the client sends the JSON body `{"name":"Gloves"}` with a JSON `Content-Type`

### Requirement: Typed endpoints check the response

A typed endpoint (for example `api.products.list()`) SHALL check the response body against the fields it returns. A field that it returns and that is missing or has a wrong type SHALL reject the request with an HTTP error that keeps the response and names the endpoint and the problem. Fields that the endpoint does not return SHALL be ignored, so fields that a newer OpenBoxes adds do not cause an error.

#### Scenario: Missing field

- **WHEN** a product in the response of `api.products.list()` has no `productCode`
- **THEN** the request rejects with an HTTP error that keeps the response, and its message names `GET …/products` and `productCode`

#### Scenario: Extra field

- **WHEN** a product in the response has a field that the endpoint does not return, for example `color`
- **THEN** the request succeeds and the result does not contain that field

### Requirement: Typed request

`api.request({ method, path, pathParams, params, data })` SHALL send a request to a typed OpenBoxes endpoint. `method` and `path` SHALL select the endpoint, for example `get` and `/stockMovements/{id}`. The types of `pathParams`, `params` and `data` SHALL come from that endpoint, with the OpenBoxes names. The result SHALL be the response body as OpenBoxes sends it (its `data` envelope, dotted keys and `null` values), checked at runtime against the endpoint's fields.

#### Scenario: Typed path

- **WHEN** the caller runs `api.request({ method: "get", path: "/stockMovements/{id}", pathParams: { id: "sm-1" } })`
- **THEN** the client requests `…/openboxes/api/stockMovements/sm-1`
- **AND** the result is the checked response body, for example `{ data: { id: "sm-1", … } }`

#### Scenario: Lowercase method

- **WHEN** the caller writes `method: "GET"`
- **THEN** TypeScript reports an error, because methods are lowercase, as in `requestUntyped`

#### Scenario: Path parameters are encoded

- **WHEN** a path parameter has a `/` or a space
- **THEN** the client encodes it in the URL

### Requirement: Typed request rejects unknown endpoints at compile time

A `method` and `path` pair that is not a typed endpoint SHALL be a TypeScript error. A param, a body field or a path parameter that the endpoint does not take, or that has a wrong type, SHALL also be a TypeScript error.

#### Scenario: Typo in a path

- **WHEN** the caller writes `api.request({ method: "get", path: "/stockMovments" })`
- **THEN** TypeScript reports an error

#### Scenario: Wrong method

- **WHEN** the caller writes `api.request({ method: "delete", path: "/stockMovements" })`
- **THEN** TypeScript reports an error

### Requirement: Untyped request

`api.requestUntyped(options)` SHALL send any request, with the options that `request` took before this change: `method`, `url`, `params`, `data`, `headers`, `responseDataType` and `skipApiPrefix`. It SHALL NOT check the response. `get`, `post`, `put`, `patch` and `delete` SHALL stay untyped. They are the way to call endpoints that ob-api does not type, for example custom data models.

#### Scenario: Endpoint that is not typed

- **WHEN** the caller runs `api.requestUntyped({ method: "get", url: "/customModel" })`
- **THEN** the client sends the request and returns the response data as received

### Requirement: Typed results follow the OpenBoxes structure

The result of a resource method (for example `api.stockMovements.get()`) SHALL keep the OpenBoxes field names and nesting, with only these changes: a dotted key becomes a nested object (`"product.id"` → `product: { id }`), `null` becomes `undefined`, and fields that the endpoint does not type are left out. A list result SHALL be `{ objects }`, or `{ objects, total }` when OpenBoxes sends `totalCount`.

#### Scenario: Dotted keys

- **WHEN** OpenBoxes answers an item with `"product.id": "p1"` and `"product.name": "Amoxicillin"`
- **THEN** the result item has `product: { id: "p1", name: "Amoxicillin" }`

#### Scenario: Null value

- **WHEN** OpenBoxes answers a field with `null`
- **THEN** the result has that field `undefined`

### Requirement: Typed inputs follow the OpenBoxes body

The params and the write inputs of a resource method SHALL use the OpenBoxes names and nesting, for example `transactionType: { id }`. A `Date` input SHALL be sent in the date format that the endpoint accepts. An absent optional value SHALL be left out, or sent as `null` when OpenBoxes needs `null` to clear the field. Dotted query parameters SHALL be nested objects in the input (`location: { id }` is sent as `location.id`).

#### Scenario: Nested query parameter

- **WHEN** an endpoint takes the query parameter `location.id` and the caller gives `location: { id: "1" }`
- **THEN** the client sends `location.id=1`
