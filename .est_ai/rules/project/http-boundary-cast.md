# Response body cast at the HTTP boundary

**Exception to** `lang/typescript.md` → *Casts: upcast yes, downcast no*.

**Where it applies:** only `src/data/*HttpClientRepository.ts`, at the one place that turns the parsed response body into the caller's `Data` type.

- An HTTP client repository may cast the parsed body (`unknown`) to the caller's generic `Data` type in one place. It must not contain any other downcast.
- Code outside `src/data/*HttpClientRepository.ts` never relies on this exception.

**Why:** the generic client (`get<Data>`, `post<Data>`, …) keeps the d2-api signatures. `Data` is chosen by each caller, so no type guard can check it in the generic layer.

**Remove when:** the typed endpoints validate response bodies with decoders and the generic layer returns `unknown`.
