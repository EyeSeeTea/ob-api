## ADDED Requirements

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
