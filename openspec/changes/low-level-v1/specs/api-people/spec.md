## REMOVED Requirements

### Requirement: Search people by email

**Reason**: The method built the OpenBoxes search body from an email. The low-level layer takes the OpenBoxes body as it is, so the method now takes `searchAttributes`.

**Migration**: Replace `api.people.search({ email })` with `api.people.search({ searchAttributes: [{ property: "email", operator: "ilike", value: email }] })`.

## ADDED Requirements

### Requirement: Search people

`api.people.search({ searchAttributes })` SHALL send `POST <apiPath>/generic/person/search` with the body `{ searchAttributes }` and return `{ objects }`. Each search attribute has `property`, `operator` (`eq`, `like` or `ilike`) and `value`. Each person SHALL have `id`, and MAY have `name` and `email`. The search does not change data.

#### Scenario: Search by email

- **WHEN** the caller runs `api.people.search({ searchAttributes: [{ property: "email", operator: "ilike", value: "nurse@example.org" }] })`
- **THEN** the client sends that body to `…/openboxes/api/generic/person/search`
- **AND** the result has the people of the response `data`

#### Scenario: No match

- **WHEN** OpenBoxes answers `{ data: [] }`
- **THEN** the result is `{ objects: [] }`
