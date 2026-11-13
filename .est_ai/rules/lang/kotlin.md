---
author: est-ai
profile: lang
version: "0.1.0"
generatedBy: "0.1.0"
---

# Kotlin

Applies to new code. See [scope](../README.md#scope-new-code-vs-legacy).

- **Sealed classes for finite state**, not enums with side flags or nullable fields
  standing in for "no state yet" / "error". A `sealed class UiState` with `Loading`,
  `Success(data)`, `Error(message)` makes illegal states unrepresentable; a flat data
  class with `isLoading: Boolean` + nullable `data` + nullable `error` does not.
- **Coroutine cancellation is handled, not ignored.** A `suspend` function that talks
  to I/O or the SDK must behave correctly when its scope is cancelled — don't swallow
  `CancellationException` in a broad `catch (e: Exception)`.
- **Follow official Kotlin coding conventions**; formatting is enforced by ktlint, not
  by hand — don't fight the formatter's output in review.
- **Public APIs get KDoc** when the *why* or a non-obvious contract isn't already
  expressed by the signature (nullability, units, side effects, thread/dispatcher
  expectations).
- No `!!` to silence the compiler. A non-null assertion is allowed only right after a
  check that already proves non-nullness in a way the compiler can't infer on its own.
