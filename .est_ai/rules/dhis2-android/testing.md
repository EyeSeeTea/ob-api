---
author: est-ai
profile: dhis2-android
version: "0.1.0"
generatedBy: "0.1.0"
---

# Testing — DHIS2 Android specifics

DHIS2/Android testing rules on top of [generic/testing.md](../generic/testing.md).

Applies to new code. See [scope](../README.md#scope-new-code-vs-legacy).

## Unit tests

- Repository and use-case tests mock the DHIS2 SDK component they depend on (e.g. `D2`,
  a specific SDK module), not the whole SDK surface.
- Use MockK for Kotlin-friendly mocking, not Mockito-style `when(...).thenReturn(...)`.
- Tests that assert error mapping mock `DomainErrorMapper` rather than constructing a
  real `D2Error` by hand.

## Instrumented UI tests

- Use the **Robot pattern**: a robot class exposes action methods
  (`clickLoginButton()`, `typeUsername()`); assertions stay out of the robot or are
  kept clearly separate from actions.
- **Never hard-coded delays.** Async UI state goes through `CoroutineTracker` /
  `launchUseCase` so Espresso's `IdlingResource` can wait for tracked operations —
  a test that needs `Thread.sleep` or a fixed delay to pass is masking a missing
  tracked launch, not a flaky test to retry.
- Use `waitUntilExactlyOneExists()` for element visibility instead of polling loops.
- Add `Modifier.testTag()` to interactive components using the `{SCREEN}_{COMPONENT}_TAG`
  convention, and export the tag constants from the screen file for test imports.
- DHIS2 design system components are composites: click the wrapper's test tag to focus
  it, then use the `"INPUT_TEXT_FIELD"` tag for the inner field, and
  `performTextInput()` (not `performTextReplacement()`).
- Mock the network layer with `MockWebServerRobot`; instrumented tests don't hit a real
  server.
- Clean up mutable test state (database, preferences) at the end of the test, not just
  on the happy path.

## Completeness checks

- [ ] A new screen with interactive components has test tags following the
  `{SCREEN}_{COMPONENT}_TAG` convention.
- [ ] A new async ViewModel operation goes through the tracked launcher so instrumented
  tests can wait on it without a hard-coded delay.
