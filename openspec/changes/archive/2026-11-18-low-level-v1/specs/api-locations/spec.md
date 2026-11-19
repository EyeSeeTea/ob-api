## MODIFIED Requirements

### Requirement: List locations

`api.locations.list(params)` SHALL request `GET <apiPath>/locations` with the optional parameter `locationTypeCode`, one of `OB_LOCATION_TYPE_CODES` (the OpenBoxes `LocationTypeCode` enum). It SHALL return `{ objects }`, the locations that the user can see. OpenBoxes does not page this list.

#### Scenario: All locations

- **WHEN** the caller runs `api.locations.list()`
- **THEN** the client requests `…/openboxes/api/locations`
- **AND** the result has one object for each location in the response

#### Scenario: Filter by location type

- **WHEN** the caller runs `api.locations.list({ locationTypeCode: "DEPOT" })`
- **THEN** the client requests `…/openboxes/api/locations?locationTypeCode=DEPOT`

#### Scenario: Unknown location type code

- **WHEN** the caller writes `api.locations.list({ locationTypeCode: "NOPE" })`
- **THEN** the call does not compile, because OpenBoxes answers `500` for this request

## ADDED Requirements

### Requirement: Location fields

Each location SHALL have `id`, `name`, `active` and `locationType` (`id`, `name`, `locationTypeCode`), and MAY have `locationNumber` and `parentLocation` (`id`, `name`). The client SHALL reject a response with a `locationTypeCode` that is not in `OB_LOCATION_TYPE_CODES`.

#### Scenario: Location without a number

- **WHEN** OpenBoxes answers a location with `locationNumber: null`
- **THEN** the result location has `locationNumber` `undefined`
