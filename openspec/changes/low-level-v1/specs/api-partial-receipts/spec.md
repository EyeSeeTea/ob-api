## MODIFIED Requirements

### Requirement: Partial receipt fields

A receipt SHALL have `shipmentId`, `receiptStatus` (one of `PENDING`, `CHECKING`, `COMPLETED` and `ROLLBACK`) and `containers`, and MAY have `receiptId`, `dateShipped` and `dateDelivered`. Each container SHALL have `shipmentItems`, and MAY have `container` (`id`, and MAY have `name`). The containers and their items SHALL be in the order that OpenBoxes sends.

#### Scenario: Items of two containers

- **WHEN** OpenBoxes answers a receipt with 2 containers of 1 item each
- **THEN** the result has 2 `containers`, each with its 1 item in `shipmentItems`

#### Scenario: Items without a container

- **WHEN** OpenBoxes answers a container with `"container.id": null`
- **THEN** the result container has `container` `undefined` and keeps its `shipmentItems`

### Requirement: Partial receipt item fields

Each item SHALL have `shipmentItemId`, `product` (`id`, `productCode`, `name`), `quantityShipped`, `quantityReceived`, `quantityCanceled`, `quantityRemaining` and `cancelRemaining`. It MAY have `receiptItemId`, `lotNumber`, `expirationDate`, `binLocation`, `container` and `recipient` (each with `id`, and MAY have `name`), `quantityReceiving` and `comment`. A nested object whose `id` is `null` SHALL be `undefined`.

#### Scenario: Item without a bin location

- **WHEN** OpenBoxes answers an item with `"binLocation.id": null`
- **THEN** the result item has `binLocation` `undefined`

#### Scenario: Bin location without a name

- **WHEN** OpenBoxes answers an item with `"binLocation.id": "bin-1"` and `"binLocation.name": null`
- **THEN** the result item has `binLocation` `{ id: "bin-1", name: undefined }`

### Requirement: Save a pending partial receipt

`api.partialReceipts.savePending(shipmentId, receipt)` SHALL send `POST <apiPath>/partialReceiving/{shipmentId}` with `receiptStatus` `PENDING` and return the receipt from the response. The input has `dateDelivered` (a `Date`) and `containers` (each with `shipmentItems`), and MAY have `receiptId`.

#### Scenario: Saved receipt

- **WHEN** the caller saves a pending receipt and OpenBoxes answers with the updated receipt
- **THEN** the client sends a `POST` to `…/openboxes/api/partialReceiving/sh-1` and returns the updated receipt, with its `receiptItemId` values

### Requirement: Partial receipt body

The client SHALL send the containers and items of the input, in their order. `dateDelivered` SHALL be in UTC as `MM/dd/yyyy HH:mm Z`, the only format OpenBoxes accepts. An absent `receiptId`, `receiptItemId`, `lotNumber` or `expirationDate` SHALL be `null`, so OpenBoxes clears it. `product`, `recipient` and `binLocation` SHALL be sent only when they are given.

#### Scenario: Body of the received quantities

- **WHEN** the caller runs `savePending` with `{ dateDelivered: new Date("2026-06-24T06:40:00Z"), containers: [{ shipmentItems: [{ shipmentItemId: "si-1", product: { id: "p1" }, recipient: { id: "u1" }, quantityReceiving: 5, cancelRemaining: false }] }] }`
- **THEN** the client sends the body `{ receiptId: null, receiptStatus: "PENDING", dateDelivered: "06/24/2026 06:40 Z", containers: [{ shipmentItems: [{ receiptItemId: null, shipmentItemId: "si-1", product: { id: "p1" }, lotNumber: null, expirationDate: null, quantityReceiving: 5, cancelRemaining: false, recipient: { id: "u1" } }] }] }`
