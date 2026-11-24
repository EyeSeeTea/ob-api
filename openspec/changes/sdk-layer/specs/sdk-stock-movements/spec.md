## Purpose

SDK workflows on OpenBoxes stock movements: the protocols that need more than 1 stock movement request, such as a list with the documents of each movement.

## ADDED Requirements

### Requirement: List stock movements with their documents

`sdk.stockMovements.listWithDocuments(params)` SHALL take the same `params` as `api.stockMovements.list`, and SHALL read 1 page with it. Then it SHALL read each movement of the page with `api.stockMovements.get(id)`, and SHALL return `{ objects, total }`: the movements from `get`, in the order of the list, and the `total` of the list. The workflow needs no session location, so it SHALL NOT wait for the session location lock.

#### Scenario: Page of 3 movements

- **WHEN** the list answers 3 movements and `total: 12`, and each `get` answers a movement with its documents
- **THEN** the result has the 3 movements with `associations.documents`, in the list order, and `total: 12`

#### Scenario: Empty page

- **WHEN** the list answers no movement
- **THEN** the result is `{ objects: [], total }`, and no `get` is sent

### Requirement: Reads of the movement details

`listWithDocuments` SHALL send at most `concurrency` reads at the same time (`options.concurrency` of the SDK, default `4`). When 1 read fails, the call SHALL reject with that error, SHALL cancel the reads in progress, and SHALL NOT start more reads.

#### Scenario: Concurrency limit

- **WHEN** the page has 10 movements and `concurrency` is `4`
- **THEN** at most 4 `get` requests are in progress at any time

#### Scenario: One read fails

- **WHEN** the `get` of the second movement answers `404`
- **THEN** the call rejects with that HTTP error, and no new `get` starts
