## MODIFIED Requirements

### Requirement: List stock movements

`api.stockMovements.list(params)` SHALL request `GET <apiPath>/stockMovements` with the optional parameters `direction` (`INBOUND` or `OUTBOUND`), `origin`, `destination` (location ids), `receiptStatusCode` (an array, sent as a repeated key), `max` and `offset`. It SHALL return `{ objects, total }`, with `total` from `totalCount`. The `associations` of the objects SHALL NOT have `documents`, because OpenBoxes sends none in the list.

#### Scenario: Inbound movements of a location

- **WHEN** the caller runs `api.stockMovements.list({ direction: "INBOUND", destination: "1", receiptStatusCode: ["SHIPPED", "PENDING"], max: 20, offset: 0 })`
- **THEN** the client requests `…/openboxes/api/stockMovements?direction=INBOUND&destination=1&receiptStatusCode=SHIPPED&receiptStatusCode=PENDING&max=20&offset=0`
- **AND** the result has the movements of the page and the server total

#### Scenario: No documents in the list

- **WHEN** the caller lists stock movements
- **THEN** the `associations` of the objects have no `documents` field, so the caller uses `get(id)` to read them

### Requirement: Stock movement fields

Each stock movement SHALL have `id`, `identifier`, `name`, `statusCode`, `origin` and `destination` (`id`, `name`, and MAY have `locationNumber`). It MAY have `description`, `associations`, `shipmentType` (`id`, `name`), `requestedBy` (`id`, `name`), `trackingNumber`, `dateRequested`, `dateShipped`, `expectedDeliveryDate` and `lastUpdated`. `associations` MAY have `shipment` (`id`). Dates SHALL be the strings OpenBoxes sends.

#### Scenario: Shipment id from the associations

- **WHEN** OpenBoxes answers a movement with `associations: { shipment: { id: "sh-1" } }`
- **THEN** the result has `associations.shipment.id` `"sh-1"`

### Requirement: Stock movement documents

The `associations` of a stock movement from `get(id)` SHALL have `documents` (empty when OpenBoxes sends none). Each document SHALL have `name` and `uri`, and MAY have `documentType` and `contentType`. OpenBoxes sends no document id.

#### Scenario: Movement without documents

- **WHEN** OpenBoxes answers a movement without `associations.documents`
- **THEN** the result has `associations.documents` `[]`
