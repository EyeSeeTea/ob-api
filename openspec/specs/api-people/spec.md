# api-people Specification

## Purpose

Typed search of OpenBoxes people by email, through the generic API.

## Requirements

### Requirement: Search people by email

`api.people.search({ email })` SHALL send `POST <apiPath>/generic/person/search` with `{ searchAttributes: [{ property: "email", operator: "ilike", value: email }] }` and return `{ objects }`. Each person SHALL have `id`, and MAY have `name` and `email`. The search does not change data.

#### Scenario: Search

- **WHEN** the caller runs `api.people.search({ email: "nurse@example.org" })`
- **THEN** the client sends that body to `…/openboxes/api/generic/person/search`
- **AND** the result has the people of the response `data`

#### Scenario: No match

- **WHEN** OpenBoxes answers `{ data: [] }`
- **THEN** the result is `{ objects: [] }`
