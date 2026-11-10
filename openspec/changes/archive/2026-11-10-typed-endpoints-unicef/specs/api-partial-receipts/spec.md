## Purpose

Typed access to the OpenBoxes partial receiving of a shipment: read the receipt with its shipment items, and save the quantities received.

## ADDED Requirements

### Requirement: Get a partial receipt

`api.partialReceipts.get(shipmentId)` SHALL request `GET <apiPath>/partialReceiving/{shipmentId}` and return the receipt from `data`.

#### Scenario: Receipt of a shipment

- **WHEN** the caller runs `api.partialReceipts.get("sh-1")`
- **THEN** the client requests `…/openboxes/api/partialReceiving/sh-1` and returns the receipt

### Requirement: Partial receipt fields

A receipt SHALL have `shipmentId`, `receiptStatus` (one of `PENDING`, `CHECKING`, `COMPLETED` and `ROLLBACK`) and `items`, and MAY have `receiptId`, `dateShipped` and `dateDelivered`. `items` SHALL be the shipment items of all containers, in order.

#### Scenario: Items of two containers

- **WHEN** OpenBoxes answers a receipt with 2 containers of 1 item each
- **THEN** the result has `items` with the 2 items, the first container's item first

### Requirement: Partial receipt item fields

Each item SHALL have `shipmentItemId`, `productId`, `productCode`, `productName`, `quantityShipped`, `quantityReceived`, `quantityCanceled`, `quantityRemaining` and `cancelRemaining`, and MAY have `receiptItemId`, `lotNumber`, `expirationDate`, `binLocation` (`id`, `name`), `containerId`, `quantityReceiving`, `comment` and `recipientId`. The fields come from the dotted keys of OpenBoxes (`"product.id"` → `productId`, `"binLocation.id"` and `"binLocation.name"` → `binLocation`).

#### Scenario: Item without a bin location

- **WHEN** OpenBoxes answers an item with `"binLocation.id": null`
- **THEN** the result item has `binLocation` `undefined`

#### Scenario: Bin location without a name

- **WHEN** OpenBoxes answers an item with `"binLocation.id": "bin-1"` and `"binLocation.name": null`
- **THEN** the result item has `binLocation` `{ id: "bin-1", name: undefined }`

### Requirement: Save a pending partial receipt

`api.partialReceipts.savePending(shipmentId, receipt)` SHALL send `POST <apiPath>/partialReceiving/{shipmentId}` with `receiptStatus` `PENDING` and return the receipt from the response. The input has `dateDelivered` (a `Date`), `items`, and MAY have `receiptId` and `recipientId`.

#### Scenario: Saved receipt

- **WHEN** the caller saves a pending receipt and OpenBoxes answers with the updated receipt
- **THEN** the client sends a `POST` to `…/openboxes/api/partialReceiving/sh-1` and returns the updated receipt, with its `receiptItemId` values

### Requirement: Complete a partial receipt

`api.partialReceipts.complete(shipmentId, receipt)` SHALL send the same request with `receiptStatus` `COMPLETED`, and resolve with no value. OpenBoxes answers a completed receipt with `{ data: {} }`, not with the receipt.

#### Scenario: Completed receipt

- **WHEN** the caller completes a receipt and OpenBoxes answers `{ data: {} }`
- **THEN** the request resolves with no value

### Requirement: Partial receipt body

The client SHALL build the OpenBoxes body: one container with all items; `dateDelivered` in UTC as `MM/dd/yyyy HH:mm Z`, the only format OpenBoxes accepts; `null` for an absent `receiptId`, `receiptItemId`, `lotNumber` and `expirationDate`, so OpenBoxes clears them; `product` and `recipient` as `{ id }` objects and `binLocation` as `{ id, name }`, only when they are given. A `binLocation` without a `name` is sent as `{ id }`.

#### Scenario: Body of the received quantities

- **WHEN** the caller runs `savePending` with `{ dateDelivered: new Date("2026-06-24T06:40:00Z"), recipientId: "u1", items: [{ shipmentItemId: "si-1", productId: "p1", quantityReceiving: 5, cancelRemaining: false }] }`
- **THEN** the client sends the body `{ receiptId: null, receiptStatus: "PENDING", dateDelivered: "06/24/2026 06:40 Z", containers: [{ shipmentItems: [{ receiptItemId: null, shipmentItemId: "si-1", product: { id: "p1" }, lotNumber: null, expirationDate: null, quantityReceiving: 5, cancelRemaining: false, recipient: { id: "u1" } }] }] }`
