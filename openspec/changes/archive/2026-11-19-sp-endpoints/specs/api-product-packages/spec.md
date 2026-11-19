## Purpose

Typed access to the OpenBoxes product packages: the package of a product supplier through the dedicated API, and read, create, update and delete through the generic API.

## ADDED Requirements

### Requirement: Create the package of a product supplier

`api.productPackages.create(command)` SHALL send `POST <apiPath>/productPackages` and return the product supplier of the response `data` (`id`). The input has `productSupplier` and `uom` (`{ id }`) and `productPackageQuantity`, and MAY have `minOrderQuantity`, `productPackagePrice`, `contractPricePrice`, `contractPriceValidUntil` (a `Date`) and `tieredPricing`. OpenBoxes answers with the product supplier, not with the package.

#### Scenario: Box of 100

- **WHEN** the caller creates `{ productSupplier: { id: "ps-1" }, uom: { id: "BX" }, productPackageQuantity: 100 }`
- **THEN** the client sends that body to `…/openboxes/api/productPackages`
- **AND** the result has the `id` of the product supplier

### Requirement: Product packages through the generic API

`api.generic.productPackages` SHALL have `get(id)` (`GET <apiPath>/generic/productPackage/{id}`), `create(productPackage)` (`POST <apiPath>/generic/productPackage`), `update(id, fields)` (`PUT <apiPath>/generic/productPackage/{id}`) and `delete(id)` (`DELETE`, no value). The first 3 SHALL return the package of the response `data`. The create input has `product` and `uom` (`{ id }`) and `quantity`, and MAY have `name`, `description` and `gtin`.

#### Scenario: Change the package size

- **WHEN** the caller runs `api.generic.productPackages.update("pp-1", { quantity: 50 })`
- **THEN** the client sends `PUT …/openboxes/api/generic/productPackage/pp-1` with `{ quantity: 50 }`
- **AND** the result has `quantity: 50`

### Requirement: Product package fields

A package SHALL have `id`, `quantity` and `uom` (`id`, `name`, `code`), and MAY have `name`, `description` and `productPrice` (`id`, `price`).

#### Scenario: Package without a price

- **WHEN** OpenBoxes answers a package with `productPrice: { id: null, price: null }`
- **THEN** the result package has `productPrice` `undefined`
