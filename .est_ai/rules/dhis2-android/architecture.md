---
author: est-ai
profile: dhis2-android
version: "0.1.0"
generatedBy: "0.1.0"
---

# Architecture — DHIS2 Android specifics

DHIS2 Android SDK / KMP rules on top of [generic/architecture.md](../generic/architecture.md).

Applies to new code. See [scope](../README.md#scope-new-code-vs-legacy).

## Never bypass the SDK

- Standard DHIS2 metadata and data (tracked entities, events, data values, org units,
  programs...) are read and written only through the SDK's typed modules
  (`d2.<x>Module()...`). No hand-rolled HTTP calls or local DB access for anything the
  SDK already models — it owns persistence, offline/online sync, and API communication
  for that data.
- **Non-standard remote data — most commonly a custom datastore namespace (e.g. a
  third-party integration's sync payload) — has no typed SDK module.** Reaching it
  through `d2.httpServiceClient()` is the correct, supported way to do a custom HTTP
  call: it still goes through the SDK's transport/auth, it's just untyped. This is not
  a bypass; see `LotNumberD2Repository`/`LotNumbersApi` (unicefTjkElmis lot-number
  field) for the precedent.
- A repository for this kind of data may keep its own local cache (e.g. via
  `PreferenceProvider`/JSON) when the SDK has no module to persist it — fetch from
  network, fall back to the local cache on failure. This is the one case where
  "database operations" outside the SDK's own DB are expected, not an exception to
  avoid.
- This local cache is **fetched-data cache, not domain truth** — don't use it as a
  substitute for a real repository abstraction, and don't reach for a custom datastore
  call when the data genuinely is standard DHIS2 metadata/data with an existing SDK
  module.

## Repositories

- Repository implementations map SDK models to domain models; `D2*` types must not
  cross into the domain layer.
- SDK exceptions (`D2Error`) are translated to domain-level errors via
  `DomainErrorMapper` (or the project's equivalent) inside the repository — never let a
  raw `D2Error` escape into the domain or UI layer.
- Repository methods are `suspend` and throw domain-level exceptions; they don't return
  raw SDK exceptions or swallow unexpected ones silently.

## Use cases

- Use cases implement the shared `UseCase<in R, out T>` interface and return
  `Result<T>` from `invoke` (wrapping a `Flow<T>` when the use case emits a stream).
- Parameterless use cases use `UseCase<Unit, T>` with the provided no-arg `invoke()`
  extension, not a hand-rolled zero-arg variant.
- Business logic that coordinates more than one repository belongs in a use case, not
  duplicated across ViewModels.

## ViewModels

- ViewModels hold UI state and orchestrate use cases; they don't call the SDK or a
  repository directly.
- Async work in a ViewModel goes through the project's coroutine-tracking launcher
  (e.g. `launchUseCase`), not a bare `viewModelScope.launch` — tracked launches are what
  let instrumented tests wait on completion instead of using delays (see
  [testing.md](testing.md)).

## Dependency injection

- Koin modules are defined in `commonMain` when the bound type is shared; only
  platform-specific bindings (via `expect`/`actual`) live in `androidMain` /
  `desktopMain` modules.

## Completeness checks

- [ ] A new repository has both the domain interface and the platform implementation,
  and is wired into its Koin module.
- [ ] A new use case is wired into its Koin module and consumed only from a ViewModel,
  not called directly from a Composable.
