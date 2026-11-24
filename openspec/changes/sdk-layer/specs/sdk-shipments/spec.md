## Purpose

SDK workflows on OpenBoxes shipments, starting with the receiving protocol: choose the location, read the receipt, save it as `PENDING`, then complete it with the ids from the `PENDING` answer.

## ADDED Requirements

### Requirement: Receive a shipment

`sdk.shipments.receive(input)` SHALL take `shipmentId`, `locationId` (the shipment destination), `dateDelivered` (a `Date`) and `items`. Holding the session location lock, it SHALL send `api.chooseLocation(locationId)`, then `api.partialReceipts.get`, `savePending` and `complete` for `shipmentId`, in this order. It SHALL resolve with no value when the completion succeeds.

#### Scenario: Receive 2 items

- **WHEN** the caller receives 5 of `si-1` and 3 of `si-2`, and each step succeeds
- **THEN** the SDK sends `chooseLocation`, `get`, the `PENDING` save and the completion, in this order, and resolves with no value

### Requirement: Stop the receive at the first failed step

When a step of `receive` fails, the call SHALL reject with the error of that step and SHALL NOT send the next steps.

#### Scenario: Pending save fails

- **WHEN** the `PENDING` save answers `403`
- **THEN** the call rejects with that HTTP error, and the SDK does not send the completion

### Requirement: Receive input items

Each item SHALL have `shipmentItemId` and `quantityReceiving`, and MAY have `cancelRemaining` (default `false`), `binLocation`, `recipient` and `comment`. The workflow SHALL NOT decide which items to receive, how many, or whether the shipment was already received: the caller decides.

#### Scenario: Only the given items

- **WHEN** the `get` receipt has `si-1` and `si-2`, and the caller gives only `si-1`
- **THEN** the `PENDING` save and the completion have only `si-1`

### Requirement: Pending body from the `get` receipt

The `get` receipt is the receipt that `api.partialReceipts.get` answers. For the `PENDING` save, the SDK SHALL build each item from the item of the `get` receipt with the same `shipmentItemId`. It SHALL copy `product`, `lotNumber` and `expirationDate` from the `get` receipt item, because OpenBoxes receives the stock into the lot of the body. It SHALL take `binLocation` and `recipient` from the caller item when given, else from the `get` receipt item.

#### Scenario: Lot copied from the receipt

- **WHEN** the `get` receipt has `si-1` with `lotNumber: "LOT-1"` and `expirationDate: "12/31/2027"`, and the caller gives only `{ shipmentItemId: "si-1", quantityReceiving: 5 }`
- **THEN** the `PENDING` save has `si-1` with `lotNumber: "LOT-1"` and `expirationDate: "12/31/2027"`

### Requirement: Pending receipt and containers

For the `PENDING` save, the SDK SHALL send the `receiptId` of the `get` receipt, and the `receiptItemId` of each `get` receipt item that has one, so a receipt that is already `PENDING` keeps its receipt items and gets no duplicates. It SHALL keep the container order of the `get` receipt, and SHALL leave out the containers that have no given item.

#### Scenario: Continue a pending receipt

- **WHEN** the `get` receipt is `PENDING` with `receiptId: "r-1"` and `si-1` with `receiptItemId: "ri-1"`
- **THEN** the `PENDING` save sends `receiptId: "r-1"` and `si-1` with `receiptItemId: "ri-1"`

#### Scenario: Container without a given item

- **WHEN** the `get` receipt has container `C1` with `si-1` and container `C2` with `si-2`, and the caller gives only `si-1`
- **THEN** the `PENDING` save has 1 container, with `si-1`

### Requirement: Completion body from the pending answer

For the completion, the SDK SHALL send the same items with the `receiptId` of the `PENDING` answer, and each item with the `receiptItemId` that the `PENDING` answer has for its `shipmentItemId`.

#### Scenario: Ids from the pending answer

- **WHEN** the `PENDING` answer has `receiptId: "r-1"` and `si-1` with `receiptItemId: "ri-1"`
- **THEN** the completion sends `receiptId: "r-1"` and `si-1` with `receiptItemId: "ri-1"`

### Requirement: Check the receive input

When `items` is empty, the call SHALL reject before it sends a request. When a `shipmentItemId` is not in the `get` receipt, or the `PENDING` answer has no `receiptItemId` for a given item, the call SHALL reject with an error that names that `shipmentItemId`, and SHALL NOT send the next save.

#### Scenario: Unknown shipment item

- **WHEN** the caller gives `si-9`, and the `get` receipt has no `si-9`
- **THEN** the call rejects with an error that names `si-9`, after `get` and before any save
