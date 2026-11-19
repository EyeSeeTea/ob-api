## Purpose

Typed access to the OpenBoxes location list, with an optional filter by location type and checked responses.

## ADDED Requirements

### Requirement: List locations

`api.locations.list(params)` SHALL request `GET <apiPath>/locations` with the optional parameter `locationTypeCode`. It SHALL return `{ objects }`, the locations that the user can see. OpenBoxes does not page this list.

Each location SHALL have `id`, `name`, `active` and `locationType` (`id`, `name`, `locationTypeCode`), and MAY have `locationNumber` and `parentLocation` (`id`, `name`).

#### Scenario: All locations

- **WHEN** the caller runs `api.locations.list()`
- **THEN** the client requests `…/openboxes/api/locations`
- **AND** the result has one object for each location in the response

#### Scenario: Filter by location type

- **WHEN** the caller runs `api.locations.list({ locationTypeCode: "DEPOT" })`
- **THEN** the client requests `…/openboxes/api/locations?locationTypeCode=DEPOT`

#### Scenario: Location without a number

- **WHEN** OpenBoxes answers a location with `locationNumber: null`
- **THEN** the result location has `locationNumber` `undefined`
