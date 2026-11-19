# api-stock-movements Specification

## Purpose

Typed access to OpenBoxes stock movements: the paged list, the details of one movement, and the upload and download of its documents.

## Requirements

### Requirement: List stock movements

`api.stockMovements.list(params)` SHALL request `GET <apiPath>/stockMovements` with the parameter `direction` (`INBOUND` or `OUTBOUND`), at least one of `origin` and `destination` (location ids), and the optional parameters `receiptStatusCode` (an array, sent as a repeated key), `max` and `offset`. It SHALL return `{ objects, total }`, with `total` from `totalCount`. The `associations` of the objects SHALL NOT have `documents`, because OpenBoxes sends none in the list.

#### Scenario: Inbound movements of a location

- **WHEN** the caller runs `api.stockMovements.list({ direction: "INBOUND", destination: "1", receiptStatusCode: ["SHIPPED", "PENDING"], max: 20, offset: 0 })`
- **THEN** the client requests `…/openboxes/api/stockMovements?direction=INBOUND&destination=1&receiptStatusCode=SHIPPED&receiptStatusCode=PENDING&max=20&offset=0`
- **AND** the result has the movements of the page and the server total

#### Scenario: No documents in the list

- **WHEN** the caller lists stock movements
- **THEN** the `associations` of the objects have no `documents` field, so the caller uses `get(id)` to read them

#### Scenario: List without a direction or a location

- **WHEN** the caller writes `api.stockMovements.list({ destination: "1" })` or `api.stockMovements.list({ direction: "INBOUND" })`
- **THEN** the call does not compile, because OpenBoxes answers `400` for these requests

### Requirement: Get a stock movement

`api.stockMovements.get(id)` SHALL request `GET <apiPath>/stockMovements/{id}` and return the movement from `data`.

#### Scenario: One movement

- **WHEN** the caller runs `api.stockMovements.get("sm-1")`
- **THEN** the client requests `…/openboxes/api/stockMovements/sm-1` and returns the movement

### Requirement: Stock movement fields

Each stock movement SHALL have `id`, `identifier`, `name`, `statusCode`, `origin` and `destination` (`id`, `name`, and MAY have `locationNumber`). It MAY have `description`, `associations`, `shipmentType` (`id`, `name`), `requestedBy` (`id`, `name`), `trackingNumber`, `dateRequested`, `dateShipped`, `expectedDeliveryDate` and `lastUpdated`. `associations` MAY have `shipment` (`id`). Dates SHALL be the strings OpenBoxes sends.

#### Scenario: Shipment id from the associations

- **WHEN** OpenBoxes answers a movement with `associations: { shipment: { id: "sh-1" } }`
- **THEN** the result has `associations.shipment.id` `"sh-1"`

### Requirement: Stock movement statuses

`statusCode` SHALL be a string, because OpenBoxes sends values outside its own status list (for example `ISSUED`). `shipmentStatus` is optional and SHALL be one of `CREATED`, `PENDING`, `SHIPPED`, `PARTIALLY_RECEIVED` and `RECEIVED`.

#### Scenario: Status outside the OpenBoxes list

- **WHEN** OpenBoxes answers a movement with `statusCode: "ISSUED"`
- **THEN** the result has `statusCode` `"ISSUED"`

#### Scenario: Unknown shipment status

- **WHEN** OpenBoxes answers a movement with `shipmentStatus: "LOST"`
- **THEN** the request rejects with an HTTP error that names `shipmentStatus`

### Requirement: Stock movement documents

The `associations` of a stock movement from `get(id)` SHALL have `documents` (empty when OpenBoxes sends none). Each document SHALL have `name` and `uri`, and MAY have `documentType` and `contentType`. OpenBoxes sends no document id.

#### Scenario: Movement without documents

- **WHEN** OpenBoxes answers a movement without `associations.documents`
- **THEN** the result has `associations.documents` `[]`

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

### Requirement: Create a stock movement

`api.stockMovements.create(movement)` SHALL send `POST <apiPath>/stockMovements` and return the new movement (`id`, and the stock movement fields). The input has `origin`, `destination` and `requestedBy` (`{ id }`) and `dateRequested` (a `Date`, sent as `MM/dd/yyyy`). It MAY have `description` and `stocklist` (`{ id }`). A stock request is a stock movement: OpenBoxes has no separate stock request API.

#### Scenario: Inbound movement

- **WHEN** the caller creates `{ origin: { id: "sup-1" }, destination: { id: "loc-2" }, requestedBy: { id: "u1" }, dateRequested: new Date("2026-06-24T10:00:00Z"), description: "Vaccines" }`
- **THEN** the client sends that body with `dateRequested: "06/24/2026"` to `…/openboxes/api/stockMovements`
- **AND** the result has the `id` from the response `data`

#### Scenario: New movement without a shipment

- **WHEN** OpenBoxes answers the create with `associations.shipment: { id: null }`, because it creates the shipment later
- **THEN** the result has `associations.shipment` `undefined`

### Requirement: Update the items of a stock movement

`api.stockMovements.updateItems(id, { lineItems, removeEmptyItems? })` SHALL send `POST <apiPath>/stockMovements/{id}/updateItems` with `{ id, lineItems, removeEmptyItems }` and return the updated movement. Each line item has `product` (`{ id }`) and `quantityRequested`, and MAY have `id`, `lotNumber`, `expirationDate`, `recipient` (`{ id }`) and `sortOrder`.

#### Scenario: Add 2 items

- **WHEN** the caller sends 2 line items for movement `sm-1`
- **THEN** the client sends `POST …/stockMovements/sm-1/updateItems` with `id: "sm-1"` and the 2 line items

### Requirement: Update the requisition and the shipment of a stock movement

`api.stockMovements.updateRequisition(id, fields)` SHALL send `POST <apiPath>/stockMovements/{id}/updateRequisition` and return the movement. `api.stockMovements.updateShipment(id, fields)` SHALL send `POST <apiPath>/stockMovements/{id}/updateShipment` and resolve with no value. The shipment fields MAY have `destination` and `shipmentType` (`{ id }`), `dateShipped` and `expectedDeliveryDate` (`Date` values, sent as `MM/dd/yyyy HH:mm Z` in UTC), `trackingNumber`, `driverName` and `comments`.

#### Scenario: Shipment details

- **WHEN** the caller sends `{ shipmentType: { id: "1" }, dateShipped: new Date("2026-06-24T06:39:00Z") }` for movement `sm-1`
- **THEN** the client sends `{ shipmentType: { id: "1" }, dateShipped: "06/24/2026 06:39 Z" }` to `…/stockMovements/sm-1/updateShipment`

### Requirement: Change the status of a stock movement

`api.stockMovements.updateStatus(id, body)` SHALL send `POST <apiPath>/stockMovements/{id}/status` and resolve with no value. The body has `status` (a requisition status, for example `CHECKING` or `DISPATCHED`), and MAY have `rollback`, `statusOnly` and `clearPicklist` (booleans).

#### Scenario: Dispatch

- **WHEN** the caller sends `{ status: "DISPATCHED" }` for movement `sm-1`
- **THEN** the client sends that body to `…/stockMovements/sm-1/status`

### Requirement: Picklist of a stock movement

`api.stockMovements.createPicklist(id)` SHALL send `GET <apiPath>/stockMovements/createPickList/{id}`, and `api.stockMovements.validatePicklist(id)` SHALL send `GET <apiPath>/stockMovements/{id}/validatePicklist`. Both SHALL resolve with no value. OpenBoxes maps both to `GET`, although they change data.

#### Scenario: Create the picklist

- **WHEN** the caller creates the picklist of movement `sm-1`
- **THEN** the client sends `GET …/stockMovements/createPickList/sm-1`

### Requirement: Delete a stock movement

`api.stockMovements.delete(id)` SHALL send `DELETE <apiPath>/stockMovements/{id}` and resolve with no value.

#### Scenario: Movement that does not exist

- **WHEN** OpenBoxes answers the delete with status `404`
- **THEN** the request rejects with an HTTP error that keeps the response
