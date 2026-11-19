## Purpose

Typed access to the OpenBoxes stock transfers (stock moved between bin locations, and returns): list, read, create, update, delete, send and roll back, with checked responses.

## ADDED Requirements

### Requirement: List stock transfers

`api.stockTransfers.list(params)` SHALL request `GET <apiPath>/stockTransfers` and return `{ objects, total }`. `params` SHALL have `location` (the location id), because OpenBoxes answers `400` without it, and MAY have `max` and `offset`. Each object SHALL be a summary (`Order.toJson`): `id`, `orderNumber`, `name`, `status` and `orderItemsCount`, and MAY have `origin`, `destination` and `createdBy` (names) and `dateCreated`.

#### Scenario: Transfers of a location

- **WHEN** the caller runs `api.stockTransfers.list({ location: "loc-1", max: 10 })`
- **THEN** the client requests `…/openboxes/api/stockTransfers?location=loc-1&max=10`
- **AND** the result has `total` from `totalCount`
- **AND** each object has `origin` and `destination` as location names, without an `id`

### Requirement: Stock transfer fields

A stock transfer of `get`, `create` and `update` SHALL have `id`, `stockTransferNumber`, `status` and `stockTransferItems`, and MAY have `description`, `origin` and `destination` (`id`, `name`, from the dotted keys), `type`, `dateCreated`, `dateShipped` and `orderedBy`. OpenBoxes sends `""` for some absent strings (`dateShipped`, `trackingNumber`); the client SHALL give `undefined` for them.

#### Scenario: Transfer without a shipment date

- **WHEN** OpenBoxes answers a transfer with `dateShipped: ""`
- **THEN** the result transfer has `dateShipped` `undefined`

### Requirement: Stock transfer item fields

Each item SHALL have `id`, `product` (`id`, `productCode`, `name`) and `quantity`, and MAY have `inventoryItem` (`id`), `lotNumber`, `expirationDate`, `originBinLocation` and `destinationBinLocation` (`id`, `name`), `quantityOnHand` and `status`. The dotted keys SHALL become nested objects.

#### Scenario: Item bins

- **WHEN** OpenBoxes answers an item with `"originBinLocation.id": "bin-1"` and `"originBinLocation.name": "A1"`
- **THEN** the result item has `originBinLocation: { id: "bin-1", name: "A1" }`

### Requirement: Read, create, update and delete a stock transfer

`api.stockTransfers.get(id)` SHALL request `GET <apiPath>/stockTransfers/{id}`, `create(transfer)` SHALL send `POST <apiPath>/stockTransfers`, and `update(id, transfer)` SHALL send `PUT <apiPath>/stockTransfers/{id}`. These 3 SHALL return the transfer of the response `data`. `delete(id)` SHALL send `DELETE <apiPath>/stockTransfers/{id}` and resolve with no value. OpenBoxes refuses a create or update when the session has no location.

#### Scenario: Move stock to another bin

- **WHEN** the caller creates a transfer with 1 item from bin `bin-1` to bin `bin-2`
- **THEN** the client sends the item with `originBinLocation: { id: "bin-1" }` and `destinationBinLocation: { id: "bin-2" }` to `…/openboxes/api/stockTransfers`
- **AND** the result has the new `id` and `stockTransferNumber`

#### Scenario: Complete a transfer

- **WHEN** the caller updates a transfer with `status: "COMPLETED"`
- **THEN** the client sends `PUT …/stockTransfers/{id}` with `id` and `status` in the body, and OpenBoxes completes the transfer

### Requirement: Transfer id in the update body

`api.stockTransfers.update(id, transfer)` SHALL send the `id` in the body too, because OpenBoxes reads the transfer id from the body and creates a new transfer without it.

#### Scenario: Update keeps the transfer

- **WHEN** the caller runs `api.stockTransfers.update("st-1", { description: "Edited" })`
- **THEN** the client sends `{ description: "Edited", id: "st-1" }`
- **AND** OpenBoxes updates `st-1`, and creates no new transfer

### Requirement: Stock transfer input

The client SHALL send the input fields as they are given, with `dateShipped` converted. The input MAY have `description`, `status`, `origin` and `destination` (`{ id }`; OpenBoxes uses the session location when they are absent), `dateShipped` (a `Date`, sent as `MM/dd/yyyy`) and `stockTransferItems`. Each item has `product`, `inventoryItem`, `originBinLocation` and `destinationBinLocation` (`{ id }`) and `quantity`, and MAY have `id`.

#### Scenario: Shipment date

- **WHEN** the caller creates a transfer with `dateShipped: new Date("2026-06-24T10:00:00Z")`
- **THEN** the client sends `dateShipped: "06/24/2026"`

### Requirement: Send and roll back a stock transfer

`api.stockTransfers.sendShipment(id)` SHALL send `POST <apiPath>/stockTransfers/{id}/sendShipment`, and `api.stockTransfers.rollback(id)` SHALL send `POST <apiPath>/stockTransfers/{id}/rollback`. Both SHALL resolve with no value.

#### Scenario: Send a return

- **WHEN** the caller sends the shipment of transfer `st-1`
- **THEN** the client sends `POST …/openboxes/api/stockTransfers/st-1/sendShipment`
