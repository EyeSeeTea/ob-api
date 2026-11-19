## Purpose

Typed access to the OpenBoxes purchase orders: list, read, delete and roll back through the dedicated API, and create through the generic API, with checked responses.

## ADDED Requirements

### Requirement: List purchase orders

`api.purchaseOrders.list(params?)` SHALL request `GET <apiPath>/purchaseOrders` and return `{ objects, total }`. `params` MAY have `max` and `offset`. Each order of the list SHALL have `id`, `orderNumber`, `name` and `status`, and MAY have `origin` and `destination` (location names, as OpenBoxes sends them) and `dateOrdered`. The list SHALL NOT request the CSV format.

#### Scenario: First page

- **WHEN** OpenBoxes answers `{ data: [{ id: "po-1", orderNumber: "PO-1", name: "Gloves", status: "PENDING" }], totalPrice: 0, totalCount: 7 }`
- **THEN** the result has 1 order and `total: 7`

### Requirement: Read, delete and roll back a purchase order

`api.purchaseOrders.get(id)` SHALL request `GET <apiPath>/purchaseOrders/{id}` and return the order of the response `data`. `api.purchaseOrders.delete(id)` SHALL send `DELETE <apiPath>/purchaseOrders/{id}`, and `api.purchaseOrders.rollback(id)` SHALL send `POST <apiPath>/purchaseOrders/{id}/rollback`; both SHALL resolve with no value. OpenBoxes refuses with status `400` to delete an order that is not `PENDING`.

#### Scenario: Delete a placed order

- **WHEN** OpenBoxes answers the delete with status `400` and `{ errorMessages: [...] }`
- **THEN** the request rejects with an HTTP error that keeps the response

### Requirement: Purchase order detail fields

The order of `get` and `generic.orders.create` SHALL have `id`, `name` and `status` (`{ name }`, the OrderStatus enum as OpenBoxes sends it), and MAY have `orderNumber`.

#### Scenario: Order status

- **WHEN** OpenBoxes answers `status: { enumType: "org.pih.warehouse.order.OrderStatus", name: "PENDING" }`
- **THEN** the result order has `status: { name: "PENDING" }`

### Requirement: Create a purchase order through the generic API

`api.generic.orders.create(order)` SHALL send `POST <apiPath>/generic/order` and return the order of the response `data`. The input has `name`, `orderType`, `origin`, `destination` and `orderedBy` (`{ id }`), and MAY have `orderNumber`, `dateOrdered` (a `Date`) and `status`. OpenBoxes requires an `origin` and a `destination` that have an organization. The answer of the create has no `orderNumber`, because OpenBoxes gives the number later; the result has `orderNumber` `undefined`.

#### Scenario: New purchase order

- **WHEN** the caller creates `{ name: "Gloves", orderType: { id: "PURCHASE_ORDER" }, origin: { id: "sup-1" }, destination: { id: "loc-1" }, orderedBy: { id: "u1" } }`
- **THEN** the client sends that body to `…/openboxes/api/generic/order`
- **AND** the result has the new `id`
