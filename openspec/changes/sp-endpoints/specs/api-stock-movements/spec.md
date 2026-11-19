## ADDED Requirements

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
