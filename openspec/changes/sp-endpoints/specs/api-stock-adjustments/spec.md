## Purpose

Typed access to the OpenBoxes stock adjustments: change the quantity on hand of inventory items at a location, with a checked response.

## ADDED Requirements

### Requirement: Create stock adjustments

`api.stockAdjustments.create(adjustments, params?)` SHALL send `POST <apiPath>/stockAdjustments` with the array of adjustments, and return `{ objects }` from the response `data`. `params` MAY have `location.id`; without it, OpenBoxes uses the session location.

#### Scenario: Add stock of a new lot

- **WHEN** the caller sends `[{ productId: "p1", lotNumber: "LOT-9", expirationDate: "12/31/2027", quantityAdjusted: 20, comments: "Found in store" }]`
- **THEN** the client sends that array to `…/openboxes/api/stockAdjustments`

#### Scenario: No location

- **WHEN** the session has no location and `params` has no `location.id`
- **THEN** OpenBoxes refuses the request, and the request rejects with an HTTP error that keeps the response

### Requirement: Stock adjustment input

Each adjustment SHALL have `quantityAdjusted`, and either `inventoryItem` (`{ id }`) or `productId` with `lotNumber` and `expirationDate` (`MM/dd/yyyy`). With `productId`, OpenBoxes finds or creates the inventory item. An adjustment MAY have `binLocation` (`{ id }`) and `comments`.

#### Scenario: Existing inventory item

- **WHEN** the caller sends `[{ inventoryItem: { id: "ii-1" }, quantityAdjusted: -2, binLocation: { id: "bin-1" } }]`
- **THEN** the client sends that array as it is
