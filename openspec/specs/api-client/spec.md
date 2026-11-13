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
