## Purpose

Typed access to the OpenBoxes application context (`GET /api/getAppContext`), the endpoint that tells the server version, with a checked response.

## ADDED Requirements

### Requirement: Read the application context

`api.appContext.get()` SHALL request `GET <apiPath>/getAppContext` through the session and return the version fields of the response `data`: `appVersion`, `buildNumber` and `buildDate`, each `undefined` when OpenBoxes sends `null` or leaves it out. The result SHALL NOT include the other fields of `data`. The typed request SHALL also know this endpoint: TypeScript SHALL accept `api.request({ method: "get", path: "/getAppContext" })`, and the client SHALL check its response at runtime.

#### Scenario: Test server

- **WHEN** OpenBoxes answers `{ data: { appVersion: "0.9.7-SNAPSHOT", buildNumber: "e475522", buildDate: null, user: { ... } } }`
- **THEN** the result is `{ appVersion: "0.9.7-SNAPSHOT", buildNumber: "e475522", buildDate: undefined }`

#### Scenario: Session without a location

- **WHEN** the session has no location and OpenBoxes answers status `500`
- **THEN** the request rejects with an HTTP error that keeps the response
