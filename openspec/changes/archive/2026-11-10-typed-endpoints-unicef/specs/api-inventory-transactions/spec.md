## Purpose

Typed access to the OpenBoxes generic API for inventory transactions: list the transaction types and the inventories, and create a transaction such as a consumption.

## ADDED Requirements

### Requirement: List transaction types

`api.transactionTypes.list()` SHALL request `GET <apiPath>/generic/TransactionType` and return `{ objects }`. Each type SHALL have `id`, `name` and `transactionCode` (one of `DEBIT`, `CREDIT`, `INVENTORY` and `PRODUCT_INVENTORY`, from `transactionCode.name`).

#### Scenario: Find the consumption type

- **WHEN** OpenBoxes answers a type `{ id: "tt-1", name: "Consumption", transactionCode: { enumType: "…", name: "DEBIT" } }`
- **THEN** the result has `{ id: "tt-1", name: "Consumption", transactionCode: "DEBIT" }`

### Requirement: List inventories

`api.inventories.list()` SHALL request `GET <apiPath>/generic/inventory` and return `{ objects }`. Each inventory SHALL have `id`, and MAY have `warehouseId` (from `warehouse.id`), the location that owns it.

#### Scenario: Inventory of a location

- **WHEN** OpenBoxes answers `{ id: "inv-1", warehouse: { id: "loc-1" } }`
- **THEN** the result has `{ id: "inv-1", warehouseId: "loc-1" }`

### Requirement: Create a transaction

`api.transactions.create(transaction)` SHALL send `POST <apiPath>/generic/transaction` and return `{ id }` of the new transaction. The input has `transactionTypeId`, `inventoryId`, `transactionDate` (a `Date`), `entries` (`inventoryItemId`, `productId`, `quantity`, and MAY have `binLocationId`), and MAY have `transactionNumber`, `comment` and `confirmed`. The client SHALL send ids as `{ id }` objects, `transactionDate` as an ISO 8601 string, and `binLocation` only when it is given.

#### Scenario: Consumption

- **WHEN** the caller creates `{ transactionTypeId: "tt-1", inventoryId: "inv-1", transactionDate: new Date("2026-06-24T06:40:00Z"), comment: "DHIS2 consumption", confirmed: true, entries: [{ inventoryItemId: "ii-1", productId: "p1", quantity: 3 }] }`
- **THEN** the client sends `{ transactionType: { id: "tt-1" }, inventory: { id: "inv-1" }, transactionDate: "2026-06-24T06:40:00.000Z", comment: "DHIS2 consumption", confirmed: true, transactionEntries: [{ inventoryItem: { id: "ii-1" }, product: { id: "p1" }, quantity: 3 }] }`
- **AND** the result is `{ id }` from the response `data`
