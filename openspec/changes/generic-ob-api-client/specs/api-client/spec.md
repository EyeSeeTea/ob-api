# Spec Delta

## Purpose

Lets scripts and apps call any OpenBoxes REST endpoint with one generic client, whose API stays close to d2-api's `D2ApiGeneric` so code moves easily between the two libraries.

## ADDED Requirements

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

The client SHALL build each request URL from `baseUrl`, then `apiPath`, then the request URL. `apiPath` SHALL default to `openboxes/api`. The client SHALL join the parts with exactly one `/` between them.

#### Scenario: Default API path

- **WHEN** `baseUrl` is `https://ob.example.org` and the caller runs `get("/products")`
- **THEN** the client requests `https://ob.example.org/openboxes/api/products`

#### Scenario: Custom API path

- **WHEN** `apiPath` is `api` and `baseUrl` is `https://ob.example.org/` and the caller runs `get("products")`
- **THEN** the client requests `https://ob.example.org/api/products`

### Requirement: Query parameter encoding

The client SHALL encode query parameter values. It SHALL repeat the key for each value of an array parameter. It SHALL leave out parameters whose value is `undefined`.

#### Scenario: Array parameter

- **WHEN** the caller runs `get("/products", { id: ["1", "2"] })`
- **THEN** the query is `id=1&id=2`

#### Scenario: Undefined parameter

- **WHEN** the caller runs `get("/products", { q: undefined, max: 5 })`
- **THEN** the query is `max=5`

### Requirement: Response data is returned as received

The client SHALL return the parsed response body without changes. It SHALL NOT unwrap an OpenBoxes `{ data }` envelope.

#### Scenario: Wrapped response

- **WHEN** the server responds `{"data":[{"id":"1"}]}`
- **THEN** the response data is `{ data: [{ id: "1" }] }`

### Requirement: Failed requests raise an HTTP error

When the response status is not 2xx, or the request fails without a response, the client SHALL reject with an HTTP error. The error SHALL contain the request and, when the server responded, the response status, headers and body.

#### Scenario: Server error

- **WHEN** the server responds with status `500` and a body
- **THEN** the request rejects with an HTTP error that contains the request, the status `500` and the body

#### Scenario: Network failure

- **WHEN** the server cannot be reached
- **THEN** the request rejects with an HTTP error that contains the request and no response

### Requirement: Timeout

When a `timeout` in milliseconds is set, the client SHALL abort a request that takes longer and reject with an HTTP error.

#### Scenario: Slow server

- **WHEN** `timeout` is `1000` and the server does not respond within 1000 ms
- **THEN** the client aborts the request and rejects with an HTTP error

### Requirement: Cancellation

The caller SHALL be able to cancel a request that is in progress. A canceled request SHALL reject, and the caller SHALL be able to tell a cancellation from other errors.

#### Scenario: Cancel a request

- **WHEN** the caller cancels a request before the server responds
- **THEN** the request rejects with an error that the library identifies as a cancellation
