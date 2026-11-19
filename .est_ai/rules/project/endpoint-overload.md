# Typed endpoint overload

**Exception to** `lang/typescript.md` → _Casts: upcast yes, downcast no_.

**Where it applies:** only `requestEndpoint` in `src/api/endpoints.ts`.

- `requestEndpoint` may have an overload signature that declares `OBEndpointResponse<K>`, while its implementation returns `CancelableResponse<unknown>`. It must not contain any other downcast.
- The implementation must decode the response with the codec of the same endpoint key, before it returns the response. Without this decode, the exception does not apply.
- Code outside `requestEndpoint` never relies on this exception.

**Why:** TypeScript cannot index the codec map with the generic key `` `${M} ${Path}` ``. The runtime decode with the codec of that key makes the declared response type true.

**Remove when:** TypeScript can relate the generic key to the codec map, so the implementation can return the typed response without an overload.
