# Project rules

Rules that belong to **this project**, not to est-ai: they always apply, the review checks them like any other rule, and the est-ai CLI never overwrites this folder.

A project rule can:

- **Add a restriction** that est-ai does not have — e.g. "Do not edit `src/api/`: it is generated from the OpenAPI spec; change the spec and regenerate."
- **Make an explicit exception** to an est-ai rule — e.g. "New repositories in `src/data/legacy-sync/` keep returning `Promise` until the Future refactor (ticket X); `dhis2-react/architecture.md` → *Future, not Promise* does not apply there."

When a project rule makes an exception, it names the est-ai rule it overrides and where it applies; the review then does not report that rule there. Remove the exception when its reason is gone.

Write rules as invariants ("must", "never", "no …"), one topic per file (e.g. `generated-code.md`, `async.md`), and link them from here:

| File | Covers |
|------|--------|
| [`http-boundary-cast.md`](http-boundary-cast.md) | Exception: the response body cast to `Data` in HTTP client repositories |
