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

### Requirement: Create a product

`api.products.create(product)` SHALL send `POST <apiPath>/products` and return the saved product (`id`, `productCode`, `name`). The input has `name`, `category` and `productType` (`{ id }`), because OpenBoxes rejects a product without a type, and MAY have `productCode`, `description`, `unitOfMeasure`, `lotAndExpiryControl` and `active`. OpenBoxes answers `{ product }`, not `{ data }`. When `productCode` is absent, OpenBoxes generates it.

#### Scenario: New product

- **WHEN** the caller creates `{ name: "Gloves", category: { id: "cat-1" }, productType: { id: "DEFAULT" } }` and OpenBoxes answers `{ product: { id: "p9", productCode: "GLV01", name: "Gloves" } }`
- **THEN** the client sends that body to `…/openboxes/api/products`
- **AND** the result has `{ id: "p9", productCode: "GLV01", name: "Gloves" }`

### Requirement: Update and delete a product through the generic API

`api.generic.products.update(id, fields)` SHALL send `PUT <apiPath>/generic/product/{id}` with only the given fields and return the product of the response `data`. `api.generic.products.get(id)` SHALL request `GET <apiPath>/generic/product/{id}`. `api.generic.products.delete(id)` SHALL send `DELETE <apiPath>/generic/product/{id}` and resolve with no value.

#### Scenario: Rename a product

- **WHEN** the caller runs `api.generic.products.update("p9", { name: "Nitrile gloves" })`
- **THEN** the client sends `PUT …/openboxes/api/generic/product/p9` with `{ name: "Nitrile gloves" }`
- **AND** the result has `name: "Nitrile gloves"`

### Requirement: Generic product fields

A product from the generic API SHALL have `id`, `productCode` and `name`, and MAY have `description`, `category` (the category name, a string), `unitOfMeasure`, `lotAndExpiryControl` and `active`.

#### Scenario: Category as a name

- **WHEN** OpenBoxes answers a generic product with `category: "Medicines"`
- **THEN** the result product has `category: "Medicines"`
