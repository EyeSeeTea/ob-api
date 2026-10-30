---
author: est-ai
profile: dhis2-android
version: "0.1.0"
generatedBy: "0.1.0"
---

# Compose Multiplatform — DHIS2 specifics

Applies to new code. See [scope](../README.md#scope-new-code-vs-legacy).
Layer boundaries (where state and use-case calls come from) live in
[architecture.md](architecture.md); this file is about how the composable is written.

## Design system first

- Check `org.hisp.dhis.mobile.ui.designsystem.component.*` before reaching for a plain
  Material component. Use the DHIS2 design system unless it genuinely lacks the
  component needed.
- Wrap screens in the project's `DHIS2Theme`, not a bare `MaterialTheme`.

## Composables vs state

- Composables collect state (`collectAsState()`) and render; they don't fetch, transform,
  or hold business logic themselves — that belongs in the ViewModel or a use case.
- Keep composables pure and stateless where possible; hoist state to the caller or the
  ViewModel rather than holding mutable state inside a composable that needs to survive
  recomposition.
- Use `@Preview` to validate a composable in isolation, especially when it has more than
  one visual state (loading/success/error).

## Resources

- Shared resources live under `commonMain/composeResources/`; a platform-specific
  resource is the exception, not the default.
