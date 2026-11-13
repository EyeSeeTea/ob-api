---
author: est-ai
profile: generic
version: "0.1.0"
generatedBy: "0.1.0"
---

# Rules — index

The contracts a reference example cannot express by itself. These are **invariants**, not tutorials: if the code in `reference/` already shows *how* to build something, that knowledge does not belong here. Rules cover the boundaries, the "never do X", and the cross-cutting constraints no single snippet can carry.

Read [the manual](../README.md) first for *why* the protocol is split this way.

## Scope: new code vs legacy

These rules describe the standard for **new code and new modules** (except [generic/process.md](generic/process.md), which is about how the work is done and applies to every change). Legacy that predates a rule is **not a violation** — it is respected, not migrated opportunistically. A pattern is migrated to the new standard only in a **deliberate refactor of bounded scope**, never as a side effect of an unrelated task. See the manual for the full rationale.

## Index

Rules are grouped along three axes, plus the project's own rules. A future CLI assembles the relevant folders per project: `generic/` always, the matching `lang/` file for the language, and the matching profile folder for the stack. `project/` belongs to the project: it always applies and the CLI never overwrites it.

**`generic/`** — any language, any stack:

| File | Covers |
|------|--------|
| [generic/functional.md](generic/functional.md) | Functional programming, immutability |
| [generic/architecture.md](generic/architecture.md) | Clean Architecture (stack-agnostic): single responsibility, layers, repositories, use cases, domain modeling |
| [generic/security.md](generic/security.md) | Secrets, input validation at boundaries, unsafe operations |
| [generic/testing.md](generic/testing.md) | What must be tested, behavior-not-implementation, test quality |
| [generic/process.md](generic/process.md) | How the work is done: when to plan, when to stop and ask, verification and human review, shared systems |

**`lang/`** — per language (a TS stack uses `typescript.md`; a Kotlin/KMP stack uses
`kotlin.md`; future: `groovy.md`):

| File | Covers |
|------|--------|
| [lang/typescript.md](lang/typescript.md) | Type safety, derived unions, no unsafe casts, functional/immutability syntax |
| [lang/kotlin.md](lang/kotlin.md) | Sealed classes, `expect`/`actual`, coroutine cancellation, ktlint |


**`dhis2-react/`** — React + DHIS2 stack:

| File | Covers |
|------|--------|
| [dhis2-react/architecture.md](dhis2-react/architecture.md) | d2-api, `D2Api`, `MetadataPick`, `FutureData`, CompositionRoot |
| [dhis2-react/react.md](dhis2-react/react.md) | Components, hooks, styling, presentation logic |
| [dhis2-react/testing.md](dhis2-react/testing.md) | Repository test doubles, assertion matchers, Playwright accessibility queries |

**`project/`** — this project's own rules (added restrictions and explicit exceptions to the rules above); see [project/README.md]

**`dhis2-android/`** — Kotlin Multiplatform + DHIS2 Android SDK stack (used by all
Android forks — see [forks/android/](../forks/android/)):

| File | Covers |
|------|--------|
| [dhis2-android/architecture.md](dhis2-android/architecture.md) | DHIS2 Android SDK, repositories, use cases, ViewModels, Koin |
| [dhis2-android/compose.md](dhis2-android/compose.md) | DHIS2 design system, theming, composable/state boundaries |
| [dhis2-android/testing.md](dhis2-android/testing.md) | Robot pattern, `CoroutineTracker`, MockK, test tag convention |
