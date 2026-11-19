# api-partial-receipts Specification

## Purpose

Typed access to the OpenBoxes partial receiving of a shipment: read the receipt with its shipment items, and save the quantities received.

## Requirements

### Requirement: Get a partial receipt

`api.partialReceipts.get(shipmentId)` SHALL request `GET <apiPath>/partialReceiving/{shipmentId}` and return the receipt from `data`.

#### Scenario: Receipt of a shipment

- **WHEN** the caller runs `api.partialReceipts.get("sh-1")`
- **THEN** the client requests `…/openboxes/api/partialReceiving/sh-1` and returns the receipt

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

#### Scenario: Pending save answered without a receipt

- **WHEN** OpenBoxes answers a `PENDING` save with `{ data: {} }`
- **THEN** the request rejects with an HTTP error that keeps the response

### Requirement: Complete a partial receipt

`api.partialReceipts.complete(shipmentId, receipt)` SHALL send the same request with `receiptStatus` `COMPLETED`, and resolve with no value. OpenBoxes answers a completed receipt with `{ data: {} }`, not with the receipt. Any other answer that is not a receipt SHALL reject the request with an HTTP error.

#### Scenario: Completed receipt

- **WHEN** the caller completes a receipt and OpenBoxes answers `{ data: {} }`
- **THEN** the request resolves with no value

#### Scenario: Unexpected completion answer

- **WHEN** OpenBoxes answers a completion with `{ data: { receiptStatus: "LOST" } }`
- **THEN** the request rejects with an HTTP error that names `POST /partialReceiving/sh-1`

### Requirement: Partial receipt body

The client SHALL send the containers and items of the input, in their order. `dateDelivered` SHALL be in UTC as `MM/dd/yyyy HH:mm Z`. Each item SHALL have the keys `lotNumber` and `expirationDate`: OpenBoxes uses the lot of the body. An absent `receiptId` or `receiptItemId`, and an `undefined` `lotNumber` or `expirationDate`, SHALL be `null`, so OpenBoxes clears it. `product`, `recipient` and `binLocation` SHALL be sent only when they are given.

#### Scenario: Body of the received quantities

- **WHEN** the caller runs `savePending` with `{ dateDelivered: new Date("2026-06-24T06:40:00Z"), containers: [{ shipmentItems: [{ shipmentItemId: "si-1", product: { id: "p1" }, recipient: { id: "u1" }, lotNumber: undefined, expirationDate: undefined, quantityReceiving: 5, cancelRemaining: false }] }] }`
- **THEN** the client sends the body `{ receiptId: null, receiptStatus: "PENDING", dateDelivered: "06/24/2026 06:40 Z", containers: [{ shipmentItems: [{ receiptItemId: null, shipmentItemId: "si-1", product: { id: "p1" }, lotNumber: null, expirationDate: null, quantityReceiving: 5, cancelRemaining: false, recipient: { id: "u1" } }] }] }`

#### Scenario: Item without the lot fields

- **WHEN** the caller writes an item without `lotNumber` or `expirationDate`
- **THEN** the call does not compile, because OpenBoxes would receive the stock without a lot
