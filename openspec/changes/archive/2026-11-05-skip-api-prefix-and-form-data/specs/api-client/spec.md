## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Form and binary bodies are sent as they are

The client SHALL send a `FormData`, `Blob`, `URLSearchParams`, `ArrayBuffer` or typed-array body without a change, whatever `requestBodyType` is. For these bodies the client SHALL NOT set `Content-Type`, so the runtime sets it (for `FormData`, with the multipart boundary). Other bodies SHALL follow `requestBodyType` as before.

#### Scenario: Post form data

- **WHEN** the caller runs `post("/upload", undefined, formData)` with no other option
- **THEN** the client sends `formData` as the request body
- **AND** the request has no `Content-Type` header set by the client

#### Scenario: A plain object is still sent as JSON

- **WHEN** the caller runs `post("/products", undefined, { name: "Gloves" })`
- **THEN** the client sends the JSON body `{"name":"Gloves"}` with a JSON `Content-Type`
