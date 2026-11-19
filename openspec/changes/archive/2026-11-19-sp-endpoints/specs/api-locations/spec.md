## ADDED Requirements

### Requirement: Read a location

`api.locations.get(id)` SHALL request `GET <apiPath>/locations/{id}` and return the location, with the location fields of the list.

#### Scenario: One location

- **WHEN** the caller reads location `loc-1`
- **THEN** the client requests `…/openboxes/api/locations/loc-1` and returns the location of the response `data`

### Requirement: Create and update a location

`api.locations.create(location)` SHALL send `POST <apiPath>/locations`, and `api.locations.update(id, fields)` SHALL send `POST <apiPath>/locations/{id}`. Both SHALL return the saved location. The input has `name` and `locationType` (`{ id }`), and MAY have `locationNumber`, `organization` (OpenBoxes requires it for most location types, for example a depot), `parentLocation` (`{ id }`), `active` and `supportedActivities`. An update sends only the given fields.

#### Scenario: New depot

- **WHEN** the caller creates `{ name: "District depot", locationType: { id: "lt-depot" } }`
- **THEN** the client sends that body to `…/openboxes/api/locations` and returns the location with its new `id`

### Requirement: Delete a location

`api.locations.delete(id)` SHALL send `DELETE <apiPath>/locations/{id}` and resolve with no value when OpenBoxes answers `204`. The client SHALL NOT hide an error status: OpenBoxes 0.9.7 deletes the location and then answers `404`, so the request rejects.

#### Scenario: Delete on OpenBoxes 0.9.7

- **WHEN** OpenBoxes deletes the location and answers `404` with "No row with the given identifier exists"
- **THEN** the request rejects with an HTTP error that keeps the response
- **AND** a next `get` of the location rejects, because OpenBoxes answers `{ data: null }`

#### Scenario: Location in use

- **WHEN** OpenBoxes refuses the delete with status `400` or `500`
- **THEN** the request rejects with an HTTP error that keeps the response

### Requirement: List location types

`api.locations.locationTypes()` SHALL request `GET <apiPath>/locations/locationTypes` and return `{ objects }`. Each type SHALL have `id` and `name`, and MAY have `description`, `locationTypeCode` and `supportedActivities`.

#### Scenario: Depot type

- **WHEN** OpenBoxes answers `{ data: [{ id: "lt-depot", name: "Depot", locationTypeCode: "DEPOT", supportedActivities: [] }] }`
- **THEN** the result has 1 type with `locationTypeCode: "DEPOT"`
