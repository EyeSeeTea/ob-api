# api-people Specification

## Purpose

Typed search of OpenBoxes people by email, through the generic API.

## Requirements

### Requirement: Search people

`api.people.search({ searchAttributes })` SHALL send `POST <apiPath>/generic/person/search` with the body `{ searchAttributes }` and return `{ objects }`. Each search attribute has `property`, `operator` (`eq`, `like` or `ilike`) and `value`. Each person SHALL have `id`, and MAY have `name` and `email`. The search does not change data.

#### Scenario: Search by email

- **WHEN** the caller runs `api.people.search({ searchAttributes: [{ property: "email", operator: "ilike", value: "nurse@example.org" }] })`
- **THEN** the client sends that body to `…/openboxes/api/generic/person/search`
- **AND** the result has the people of the response `data`

#### Scenario: No match

- **WHEN** OpenBoxes answers `{ data: [] }`
- **THEN** the result is `{ objects: [] }`

#### Scenario: Empty property or value

- **WHEN** the caller runs `api.people.search({ searchAttributes: [{ property: "email", operator: "eq", value: "" }] })`
- **THEN** the client rejects the search without a request, because OpenBoxes answers `500` for an empty property or value
