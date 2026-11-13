# api-products Specification

## Purpose

Typed access to the OpenBoxes product endpoints: the product list and the available stock of products at a location, with typed parameters and checked responses.

## Requirements

### Requirement: List products

`api.products.list(params)` SHALL request `GET <apiPath>/products` with the optional parameters `max`, `offset` and `q` (search text). It SHALL return `{ objects, total }`, where `objects` are the products of the page and `total` is the number of products that match, from the response field `totalCount`.

Each product SHALL have `id`, `productCode`, `name`, `active` and `lotAndExpiryControl`, and MAY have `description` and `unitOfMeasure`.

#### Scenario: First page

- **WHEN** the caller runs `api.products.list({ max: 2, offset: 0 })` and OpenBoxes has 16 products
- **THEN** the client requests `…/openboxes/api/products?max=2&offset=0`
- **AND** the result has 2 `objects` and `total` 16

#### Scenario: Search

- **WHEN** the caller runs `api.products.list({ q: "AMOX500" })`
- **THEN** the client requests `…/openboxes/api/products?q=AMOX500`

### Requirement: Available items of products at a location

`api.products.availableItems({ locationId, productIds })` SHALL request `GET <apiPath>/products/availableItems` with `location.id` and repeated `product.id`, and return `{ objects }`: the available items (lots and bin locations) of the products at the location. `locationId` is required.

#### Scenario: Request for two products

- **WHEN** the caller runs `api.products.availableItems({ locationId: "1", productIds: ["p1", "p2"] })`
- **THEN** the client requests `…/openboxes/api/products/availableItems?location.id=1&product.id=p1&product.id=p2`

### Requirement: Available item fields

Each item SHALL have `inventoryItemId`, `productId`, `productCode`, `quantityAvailable`, `quantityOnHand` and `status`, and MAY have `lotNumber`, `expirationDate` (as OpenBoxes sends it, `MM/dd/yyyy`) and `binLocation` (`id`, `name`, and MAY have `locationNumber`). `productId` SHALL come from the item's product. `status` SHALL be one of `AVAILABLE`, `PICKED`, `RECALLED`, `HOLD` and `NOT_AVAILABLE`.

#### Scenario: Items with their product

- **WHEN** OpenBoxes answers an item with `product: { id: "p1", … }` and `"inventoryItem.id": "i1"`
- **THEN** the result item has `productId` `"p1"` and `inventoryItemId` `"i1"`

#### Scenario: Item without a bin location or lot

- **WHEN** OpenBoxes answers an item with `binLocation: null` and no lot number
- **THEN** the result item has `binLocation` and `lotNumber` `undefined`

### Requirement: Available items requests hold at most 50 products

`api.products.availableItems()` SHALL send at most 50 product ids in one request, to stay under URL length limits. For more products, it SHALL send one request after another and join the items in the order of the requests. An empty `productIds` SHALL return `{ objects: [] }` without a request.

#### Scenario: More than 50 products

- **WHEN** the caller asks for 120 product ids
- **THEN** the client sends 3 requests, with 50, 50 and 20 product ids
- **AND** the result has the items of the 3 responses, in that order

#### Scenario: No products

- **WHEN** the caller runs `api.products.availableItems({ locationId: "1", productIds: [] })`
- **THEN** the result is `{ objects: [] }` and the client sends no request
