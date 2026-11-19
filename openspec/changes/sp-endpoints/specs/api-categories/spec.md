## Purpose

Typed access to the OpenBoxes product categories: list, read, create, update and delete, with checked responses.

## ADDED Requirements

### Requirement: List categories

`api.categories.list()` SHALL request `GET <apiPath>/categories` and return `{ objects }` with every category. OpenBoxes does not page this list.

#### Scenario: All categories

- **WHEN** OpenBoxes answers `{ data: [{ id: "cat-1", name: "Medicines", isRoot: false, categories: [] }] }`
- **THEN** the result has 1 category with `id: "cat-1"` and `name: "Medicines"`

### Requirement: Category fields

Each category SHALL have `id` and `name`, and MAY have `description`, `sortOrder`, `isRoot` and `categories` (its child categories, with the same fields).

#### Scenario: Category with children

- **WHEN** OpenBoxes answers a category with 2 child categories
- **THEN** the result category has 2 `categories`

### Requirement: Read, create, update and delete a category

`api.categories.get(id)` SHALL request `GET <apiPath>/categories/{id}`. `api.categories.create(category)` SHALL send `POST <apiPath>/categories`, and `api.categories.update(id, fields)` SHALL send `PUT <apiPath>/categories/{id}`. These 3 SHALL return the category. OpenBoxes answers them with the category itself, without a `data` envelope. The input has `name`, and MAY have `description`, `parentCategory` (`{ id }`) and `sortOrder`.

#### Scenario: New category

- **WHEN** the caller creates `{ name: "Gloves", parentCategory: { id: "cat-1" } }` and OpenBoxes answers `{ id: "cat-9", name: "Gloves" }`
- **THEN** the client sends that body to `…/openboxes/api/categories`
- **AND** the result has `{ id: "cat-9", name: "Gloves" }`

### Requirement: Delete a category

`api.categories.delete(id)` SHALL send `DELETE <apiPath>/categories/{id}` and resolve with no value.

#### Scenario: Delete

- **WHEN** OpenBoxes answers the delete of `cat-9` with status `204`
- **THEN** the request resolves with no value
