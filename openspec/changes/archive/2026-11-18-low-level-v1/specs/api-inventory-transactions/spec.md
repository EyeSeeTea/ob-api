## MODIFIED Requirements

### Requirement: List transaction types

`api.transactionTypes.list()` SHALL request `GET <apiPath>/generic/TransactionType` and return `{ objects }`. Each type SHALL have `id`, `name` and `transactionCode` (`name`: one of `DEBIT`, `CREDIT`, `INVENTORY` and `PRODUCT_INVENTORY`).

#### Scenario: Find the consumption type

- **WHEN** OpenBoxes answers a type `{ id: "tt-1", name: "Consumption", transactionCode: { enumType: "…", name: "DEBIT" } }`
- **THEN** the result has `{ id: "tt-1", name: "Consumption", transactionCode: { name: "DEBIT" } }`

### Requirement: List inventories

`api.inventories.list()` SHALL request `GET <apiPath>/generic/inventory` and return `{ objects }`. Each inventory SHALL have `id`, and MAY have `warehouse` (`id`), the location that owns it.

#### Scenario: Inventory of a location

- **WHEN** OpenBoxes answers `{ id: "inv-1", warehouse: { id: "loc-1" } }`
- **THEN** the result has `{ id: "inv-1", warehouse: { id: "loc-1" } }`

### Requirement: Create a transaction

`api.transactions.create(transaction)` SHALL send `POST <apiPath>/generic/transaction` and return `{ id }` of the new transaction. The input has `transactionType` and `inventory` (`{ id }`), `transactionDate` (a `Date`, sent as ISO 8601) and `transactionEntries`. It MAY have `transactionNumber`, `comment` and `confirmed`. Each entry has `inventoryItem` and `product` (`{ id }`) and `quantity`, and MAY have `binLocation` (`{ id }`).

#### Scenario: Consumption

- **WHEN** the caller creates `{ transactionType: { id: "tt-1" }, inventory: { id: "inv-1" }, transactionDate: new Date("2026-06-24T06:40:00Z"), comment: "DHIS2 consumption", confirmed: true, transactionEntries: [{ inventoryItem: { id: "ii-1" }, product: { id: "p1" }, quantity: 3 }] }`
- **THEN** the client sends `{ transactionType: { id: "tt-1" }, inventory: { id: "inv-1" }, transactionDate: "2026-06-24T06:40:00.000Z", comment: "DHIS2 consumption", confirmed: true, transactionEntries: [{ inventoryItem: { id: "ii-1" }, product: { id: "p1" }, quantity: 3 }] }`
- **AND** the result is `{ id }` from the response `data`
