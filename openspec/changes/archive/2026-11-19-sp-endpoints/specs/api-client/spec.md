## ADDED Requirements

### Requirement: Generic API resources

Every typed resource that uses the OpenBoxes generic API (`<apiPath>/generic/{resource}`) SHALL be under `api.generic`, with a plural name (`api.generic.products` for `/generic/product`). Each resource SHALL have its own literal path in the typed request (`/generic/product/{id}`), so that the body and the response are checked for that resource. A resource with a dedicated OpenBoxes API (for example `/products`) SHALL stay at the top level.

#### Scenario: Generic and dedicated product endpoints

- **WHEN** the caller uses `api.products.create(…)` and `api.generic.products.update(id, …)`
- **THEN** the first sends `POST …/openboxes/api/products` and the second sends `PUT …/openboxes/api/generic/product/{id}`

#### Scenario: Typed generic request

- **WHEN** the caller runs `api.request({ method: "put", path: "/generic/product/{id}", pathParams: { id: "p1" }, data: { name: "Gloves" } })`
- **THEN** TypeScript accepts it and the client sends `PUT …/openboxes/api/generic/product/p1`

#### Scenario: Resource that is not typed

- **WHEN** the caller runs `api.request({ method: "get", path: "/generic/{resource}" })`
- **THEN** TypeScript rejects it; the caller uses `requestUntyped` for a generic resource that ob-api does not type

### Requirement: Write endpoints without a body in the answer

A typed endpoint that OpenBoxes answers with an empty body (status `200` or `204`) SHALL resolve with no value. Any status that is not `2xx` SHALL reject with an HTTP error, as for the other requests.

#### Scenario: Delete

- **WHEN** OpenBoxes answers a `DELETE` with status `204` and no body
- **THEN** the request resolves with no value

### Requirement: Empty path parameters

The typed `request` SHALL reject a path parameter that is missing or empty (`""`), before any request, with an error that names the endpoint and the parameter. An empty id gives a path to a different endpoint (`DELETE /stockMovements/` instead of `DELETE /stockMovements/{id}`).

#### Scenario: Empty id

- **WHEN** the caller runs `api.request({ method: "get", path: "/stockMovements/{id}", pathParams: { id: "" } })`
- **THEN** the request rejects with "Missing path parameters for get /stockMovements/{id}: id"
- **AND** the client sends no request
