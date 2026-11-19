## ADDED Requirements

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
