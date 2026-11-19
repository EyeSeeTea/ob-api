## MODIFIED Requirements

### Requirement: Available items of products at a location

`api.products.availableItems({ location: { id }, product: { id } })` SHALL send 1 request: `GET <apiPath>/products/availableItems` with `location.id` and a repeated `product.id`, one for each id in `product.id`. It SHALL return `{ objects }`: the available items (lots and bin locations) of the products at the location.

#### Scenario: Request for two products

- **WHEN** the caller runs `api.products.availableItems({ location: { id: "1" }, product: { id: ["p1", "p2"] } })`
- **THEN** the client sends 1 request to `…/openboxes/api/products/availableItems?location.id=1&product.id=p1&product.id=p2`

### Requirement: Available item fields

Each item SHALL have `inventoryItem` (`id`), `product` (`id`), `productCode`, `quantityAvailable`, `quantityOnHand` and `status`, and MAY have `lotNumber`, `expirationDate` (as OpenBoxes sends it, `MM/dd/yyyy`) and `binLocation` (`id`, `name`, and MAY have `locationNumber`). `status` SHALL be one of `AVAILABLE`, `PICKED`, `RECALLED`, `HOLD` and `NOT_AVAILABLE`.

#### Scenario: Items with their product

- **WHEN** OpenBoxes answers an item with `product: { id: "p1", … }` and `"inventoryItem.id": "i1"`
- **THEN** the result item has `product: { id: "p1" }` and `inventoryItem: { id: "i1" }`

#### Scenario: Item without a bin location or lot

- **WHEN** OpenBoxes answers an item with `binLocation: null` and no lot number
- **THEN** the result item has `binLocation` and `lotNumber` `undefined`

## REMOVED Requirements

### Requirement: Available items requests hold at most 50 products

**Reason**: The low-level layer sends 1 request per method. Splitting the product ids into several requests is logic, so it moves to the SDK layer.

**Migration**: Split the product ids into groups of at most 50, to stay under URL length limits, and call `availableItems` once for each group. The SDK layer will supply this as one function.
