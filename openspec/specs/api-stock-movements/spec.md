# api-stock-movements Specification

## Purpose

Typed access to OpenBoxes stock movements: the paged list, the details of one movement, and the upload and download of its documents.

## Requirements

### Requirement: List stock movements

`api.stockMovements.list(params)` SHALL request `GET <apiPath>/stockMovements` with the optional parameters `direction` (`INBOUND` or `OUTBOUND`), `origin`, `destination` (location ids), `receiptStatusCodes` (sent as repeated `receiptStatusCode`), `max` and `offset`. It SHALL return `{ objects, total }`, with `total` from `totalCount`. The objects SHALL NOT have `documents`, because OpenBoxes sends none in the list.

#### Scenario: Inbound movements of a location

- **WHEN** the caller runs `api.stockMovements.list({ direction: "INBOUND", destination: "1", receiptStatusCodes: ["SHIPPED", "PENDING"], max: 20, offset: 0 })`
- **THEN** the client requests `…/openboxes/api/stockMovements?direction=INBOUND&destination=1&receiptStatusCode=SHIPPED&receiptStatusCode=PENDING&max=20&offset=0`
- **AND** the result has the movements of the page and the server total

#### Scenario: No documents in the list

- **WHEN** the caller lists stock movements
- **THEN** the objects have no `documents` field, so the caller uses `get(id)` to read them

### Requirement: Get a stock movement

`api.stockMovements.get(id)` SHALL request `GET <apiPath>/stockMovements/{id}` and return the movement from `data`.

#### Scenario: One movement

- **WHEN** the caller runs `api.stockMovements.get("sm-1")`
- **THEN** the client requests `…/openboxes/api/stockMovements/sm-1` and returns the movement

### Requirement: Stock movement fields

Each stock movement SHALL have `id`, `identifier`, `name`, `statusCode`, `origin` and `destination` (`id`, `name`, and MAY have `locationNumber`). It MAY have `description`, `shipmentId`, `shipmentType` (`id`, `name`), `requestedBy` (`id`, `name`), `trackingNumber`, `dateRequested`, `dateShipped`, `expectedDeliveryDate` and `lastUpdated`. Dates SHALL be the strings OpenBoxes sends.

#### Scenario: Shipment id from the associations

- **WHEN** OpenBoxes answers a movement with `associations: { shipment: { id: "sh-1" } }`
- **THEN** the result has `shipmentId` `"sh-1"`

### Requirement: Stock movement statuses

`statusCode` SHALL be a string, because OpenBoxes sends values outside its own status list (for example `ISSUED`). `shipmentStatus` is optional and SHALL be one of `CREATED`, `PENDING`, `SHIPPED`, `PARTIALLY_RECEIVED` and `RECEIVED`.

#### Scenario: Status outside the OpenBoxes list

- **WHEN** OpenBoxes answers a movement with `statusCode: "ISSUED"`
- **THEN** the result has `statusCode` `"ISSUED"`

#### Scenario: Unknown shipment status

- **WHEN** OpenBoxes answers a movement with `shipmentStatus: "LOST"`
- **THEN** the request rejects with an HTTP error that names `shipmentStatus`

### Requirement: Stock movement documents

A stock movement from `get(id)` SHALL have `documents`, from `associations.documents` (empty when OpenBoxes sends none). Each document SHALL have `name` and `uri`, and MAY have `documentType` and `contentType`. OpenBoxes sends no document id.

#### Scenario: Movement without documents

- **WHEN** OpenBoxes answers a movement without `associations.documents`
- **THEN** the result has `documents` `[]`

### Requirement: Upload a stock movement document

`api.stockMovements.uploadDocument(id, file, fileName)` SHALL send `POST <baseUrl>/<contextPath>/stockMovement/uploadDocument/{id}` (outside `apiPath`). `contextPath` is `apiPath` without its last `api` segment: `openboxes` for the default `openboxes/api` with a form data body that has the file in the field `fileContents`. It SHALL resolve with no value when OpenBoxes answers with a success status.

#### Scenario: Upload with a custom apiPath

- **WHEN** the client has `apiPath: "ob/api"` and the caller runs `api.stockMovements.uploadDocument("sm-1", blob, "a.pdf")`
- **THEN** the client sends a `POST` to `<baseUrl>/ob/stockMovement/uploadDocument/sm-1`

#### Scenario: Upload

- **WHEN** the caller runs `api.stockMovements.uploadDocument("sm-1", blob, "delivery-note.pdf")`
- **THEN** the client sends a `POST` to `…/openboxes/stockMovement/uploadDocument/sm-1` with form data whose `fileContents` is the file named `delivery-note.pdf`

### Requirement: Download a stock movement document

`api.stockMovements.downloadDocument(uri)` SHALL request the document `uri` and return its bytes as a `Blob`. The `uri` is an absolute URL from a document. The client SHALL send the request only when the `uri` starts with the client's `baseUrl`, so the session cookie goes only to the OpenBoxes server. For another `uri`, it SHALL reject without a request.

#### Scenario: Document on the same server

- **WHEN** `baseUrl` is `https://ob.example.org` and the caller runs `downloadDocument("https://ob.example.org/openboxes/stockMovement/exportCsv/sm-1")`
- **THEN** the client requests `https://ob.example.org/openboxes/stockMovement/exportCsv/sm-1` and returns the body as a `Blob`

#### Scenario: Document on another server

- **WHEN** the caller runs `downloadDocument("https://other.example.org/file.pdf")`
- **THEN** the request rejects with an error that names the URL, and the client sends no request
