## Purpose

The SDK client (`OBSdk`): the layer on top of the low-level `OBApi` that runs OpenBoxes protocols of several requests. It owns the server version, the session location lock and the retries of temporary read failures, so each workflow uses them the same way.

## ADDED Requirements

### Requirement: Create the SDK client

`new OBSdk(options)` SHALL be synchronous and SHALL NOT send a request. `options.api` (an `OBApi`) is required. `options` MAY have `version` (an OpenBoxes version string), `retry` (`attempts`, `delayMs`) and `concurrency`. The SDK SHALL send every request through `options.api`, so it uses the session of that client.

#### Scenario: Create without a request

- **WHEN** a caller creates an `OBSdk` from an `OBApi`
- **THEN** no request is sent

### Requirement: Check the SDK options

`new OBSdk` SHALL throw a `RangeError` that names the option when `retry.attempts` or `concurrency` is not an integer of 1 or more, or `retry.delayMs` is not a finite number of 0 or more.

#### Scenario: Invalid option

- **WHEN** a caller creates an `OBSdk` with `concurrency: NaN`
- **THEN** the constructor throws a `RangeError` that names `concurrency`

### Requirement: Cancel a workflow

Every SDK workflow SHALL return a `CancelableResponse`. Cancel SHALL stop the request in progress and SHALL NOT start the next requests of the workflow.

#### Scenario: Cancel during a workflow

- **WHEN** the caller cancels a workflow while its second request is in progress
- **THEN** the second request is canceled, no later request is sent, and the workflow rejects with an abort error

### Requirement: Session location lock

The session location lock makes sure that only 1 workflow at a time changes the session location. A workflow that takes a `locationId` SHALL call `api.chooseLocation(locationId)` before its other requests. The workflows of 1 `OBSdk` that take a `locationId` SHALL run one at a time, in the order of the calls. After the workflow, the session SHALL stay at the `locationId` of that workflow. The lock SHALL NOT cover calls that the caller sends directly through the `OBApi`.

#### Scenario: Two receipts for 2 locations

- **WHEN** a caller starts a workflow for location `A` and, before it ends, a workflow for location `B` on the same `OBSdk`
- **THEN** every request of the `A` workflow is sent before `chooseLocation` for `B`

### Requirement: Release the session location lock

A workflow that fails or is canceled SHALL release the lock, so the next workflow runs. A workflow that is canceled while it waits SHALL send no request.

#### Scenario: First workflow fails

- **WHEN** the first of 2 waiting workflows rejects
- **THEN** the second workflow runs

### Requirement: Server version

`sdk.serverVersion(options?)` SHALL return a `CancelableResponse` of the server version: `appVersion` (the string from OpenBoxes) and its numeric `major`, `minor` and `patch`. A suffix such as `-SNAPSHOT` SHALL NOT change the numbers. When the caller gives `version` to `new OBSdk`, the SDK SHALL use it and SHALL NOT send a request.

#### Scenario: Snapshot version

- **WHEN** OpenBoxes answers `appVersion: "0.9.7-SNAPSHOT"`
- **THEN** the result is `{ appVersion: "0.9.7-SNAPSHOT", major: 0, minor: 9, patch: 7 }`

#### Scenario: Version given by the caller

- **WHEN** the caller creates the SDK with `version: "0.8.22"` and calls `serverVersion()`
- **THEN** no request is sent, and the result has `minor: 8` and `patch: 22`

#### Scenario: Given version without numbers

- **WHEN** the caller creates the SDK with `version: "latest"`
- **THEN** only a call of `serverVersion()` rejects, and the creation causes no unhandled rejection

### Requirement: Server version: shared read

The first call of `serverVersion` SHALL read the version with `api.appContext.get()`. Later calls SHALL reuse it without a request, and calls at the same time SHALL share 1 request. The read SHALL start at `getData()`, not at the call. A cancel SHALL reject only the wait of its caller, and SHALL NOT stop the shared read for the others.

#### Scenario: Calls at the same time

- **WHEN** 2 callers call `serverVersion()` before the first read ends
- **THEN** the SDK sends 1 `getAppContext` request, and both calls get its version

#### Scenario: One caller cancels

- **WHEN** 2 callers wait for the same read, and the first caller cancels
- **THEN** the first call rejects with an abort error, and the second call gets the version of the 1 `getAppContext` request

### Requirement: Server version: session location

`getAppContext` needs a session location. `serverVersion` MAY take `{ locationId }`. When it reads the version with a `locationId`, it SHALL hold the session location lock and send `api.chooseLocation(locationId)` before `api.appContext.get()`. Without a `locationId`, it SHALL use the current session location. When the version is already known, it SHALL send no request, also when a `locationId` is given.

#### Scenario: Read with a location

- **WHEN** the caller calls `serverVersion({ locationId: "A" })` on a new SDK
- **THEN** the SDK sends `chooseLocation` for `A`, then `getAppContext`, in the lock

#### Scenario: Version already known

- **WHEN** the version is already read and the caller calls `serverVersion({ locationId: "A" })`
- **THEN** no request is sent

### Requirement: Server version: failed shared read

When a caller gives a `locationId` and the shared read that it waits for fails, the SDK SHALL read again with that `locationId`.

#### Scenario: Shared read without a location fails

- **WHEN** a read without a location is in progress, the caller calls `serverVersion({ locationId: "A" })`, and the first read fails with status `500`
- **THEN** the first call rejects, and the SDK sends `chooseLocation` for `A`, then `getAppContext`, for the second call

### Requirement: Server version: failures

When the read of the version fails, `serverVersion()` SHALL reject, and the next call SHALL read again. When `appVersion` is missing or has no `major.minor.patch` numbers, the call SHALL reject with an error that names the value.

#### Scenario: Status 500

- **WHEN** OpenBoxes answers `getAppContext` with status `500`
- **THEN** the call rejects with an error that says that a missing session location is the likely cause, and that keeps the HTTP error as its cause
- **AND** the next call sends the request again

### Requirement: Server version: capability flags

`sdk.capabilities(options?)` SHALL return a `CancelableResponse` of an object with a boolean for each capability that the SDK knows. Each capability has a first OpenBoxes version that has it. A capability SHALL be `true` when the server version is the same as, or later than, that version. `capabilities` SHALL take the same `options` as `serverVersion`, and SHALL NOT send more requests than `serverVersion(options)`.

#### Scenario: Older server

- **WHEN** a capability starts at `0.9.0`, and the server version is `0.8.22`
- **THEN** that capability is `false`

### Requirement: Capabilities of this change

The SDK SHALL know no capability in this change, because no workflow of this change depends on the server version.

#### Scenario: Empty table

- **WHEN** the caller calls `capabilities()`
- **THEN** the result is `{}`

### Requirement: Reference version

The reference version is OpenBoxes `v0.9.7`. The SDK inputs and results SHALL have the shapes of the reference version, on every server version. A version mapper changes the request or the answer of 1 workflow step for a range of server versions. When a server version needs another shape, the version mapper of that step SHALL change it, and the caller SHALL see the reference shape.

#### Scenario: Older server shape

- **WHEN** a step has a mapper for `0.8.x`, and the server version is `0.8.22`
- **THEN** the SDK sends the request in the `0.8.x` shape, and the caller gets the result in the `v0.9.7` shape

### Requirement: Read the version only when needed

A workflow step that has no version mapper SHALL NOT read the server version.

#### Scenario: Workflow without mappers

- **WHEN** a caller runs a workflow on a new SDK, and no step of that workflow has a version mapper
- **THEN** the SDK sends no `getAppContext` request

### Requirement: Version mapper selection

A version mapper SHALL apply to a range of server versions: from a version (inclusive) and to a version (exclusive), each optional. For a server version, the SDK SHALL use the mapper whose range has that version. When no range has it, the SDK SHALL use the reference shapes without a change.

#### Scenario: Version in a range

- **WHEN** a step has a mapper for `from: "0.8.0", to: "0.9.0"`, and the server version is `0.8.22`
- **THEN** the step uses that mapper

#### Scenario: Version outside every range

- **WHEN** the same step runs on a server with version `0.9.7`
- **THEN** the step sends the reference request and reads the answer without a change

### Requirement: Retry temporary read failures

The SDK SHALL retry a `GET` request that it sends when the request fails with a network error or with status `429`, `502`, `503` or `504`. This includes the `GET` of `api.chooseLocation`: it changes only the session, so a second attempt is safe. It SHALL NOT retry other statuses, an abort, or a request that is not `GET`. The `401` login retry of the session is separate and SHALL keep working.

#### Scenario: Write is not retried

- **WHEN** a `POST` of a workflow answers `503`
- **THEN** the SDK does not send it again, and the workflow rejects with the HTTP error

### Requirement: Retry attempts and delay

The SDK SHALL make at most `retry.attempts` attempts in total (default `3`). Before attempt `n + 1` it SHALL wait `retry.delayMs × 2^(n − 1)` milliseconds (default `delayMs`: `500`). `retry.attempts: 1` SHALL turn off the retries. When the caller cancels during a wait, the SDK SHALL stop and SHALL NOT send the next attempt.

#### Scenario: Temporary failure

- **WHEN** the first `GET` answers `503` and the second answers `200`
- **THEN** the SDK waits `500` ms, and the workflow uses the second answer

#### Scenario: Two temporary failures

- **WHEN** the first and the second `GET` answer `503`, and the third answers `200`
- **THEN** the SDK waits `500` ms before the second attempt and `1000` ms before the third, and the workflow uses the third answer
