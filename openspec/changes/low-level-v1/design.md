# Design

## Context

See proposal.md (Why). The current state:

- `OBApi.request<Data>(options)` is untyped: the caller chooses `Data`. `get`, `post`, `put`, `patch` and `delete` call it.
- Each resource module (`src/api/products.ts`, `stockMovements.ts`, `partialReceipts.ts`, `inventoryTransactions.ts`, `people.ts`, `locations.ts`) has a purify-ts codec for the OpenBoxes response, and a mapper to a public type. `responseCheck.ts` (`getChecked`, `postChecked`) sends the request and checks it with the codec.
- The URL, the codec and the params of each endpoint are only inside its resource method. Nothing ties a path to its types.

Known constraints:

- OpenBoxes has no schema endpoint. The codecs are written by hand from the Grails source (v0.9.9) and real responses (test server, `0.9.7-SNAPSHOT`).
- The same endpoint can answer different shapes: `POST /partialReceiving/{id}` answers the receipt for `PENDING`, and `{ data: {} }` for `COMPLETED`.
- 3 calls are outside the JSON API: `uploadDocument` (form data, outside `apiPath`), `downloadDocument` (binary, any server path) and `chooseLocation` (no JSON answer).

## Goals / Non-Goals

**Goals:**

- One place declares each typed endpoint: its method, path, params, body and response codec.
- The typed `request` and the resource methods share that declaration, so they cannot disagree.

**Non-Goals:**

- A generic type-level "unflatten" of dotted keys. The mappers stay explicit.
- Typed entries for the 3 calls outside the JSON API.

## Decisions

### 1. An endpoint map, keyed by `"<method> <path>"`

A new module `src/api/endpoints.ts` declares a constant object:

```ts
export const OB_ENDPOINTS = {
    "get /stockMovements": { response: stockMovementListCodec },
    "get /stockMovements/{id}": { response: stockMovementDetailCodec },
    "post /partialReceiving/{shipmentId}": { response: receiptOrCompletedCodec },
    // …
} as const;
```

Next to it, a type map gives the `params` and the `data` (body) of each key, because these go out and need no runtime check. The response type is `GetType` of the codec, so the type and the runtime check come from one source.

`api.request` takes `{ method, path }` as separate fields, joined to the key at the type level. `pathParams` is required when the path has `{…}` segments, and it is not allowed otherwise. A template literal type extracts the names.

- Alternative: one method per resource only, without a typed `request`. Rejected: the meeting asked for a typed `request`, and a single map makes the endpoint list easy to review against the Grails `UrlMappings`.
- Alternative: types only, without runtime codecs in the map. Rejected: the response check is a project rule (api-client spec, "Typed endpoints check the response").

### 2. The typed `request` returns the OpenBoxes body; the resource methods reshape it

The typed `request` returns the checked body as OpenBoxes sends it (the `data` envelope, dotted keys, `null`). The resource methods call it, then map the result with the mechanical rules: dotted keys to nested objects, `null` to `undefined`, `{ data, totalCount }` to `{ objects, total }`.

So there are 2 typed levels:

| Level                     | Input                                                             | Output                                       |
| ------------------------- | ----------------------------------------------------------------- | -------------------------------------------- |
| `api.request`             | OpenBoxes params and body (dotted query names, strings for dates) | OpenBoxes body, checked                      |
| `api.<resource>.<method>` | OpenBoxes names, nested objects, `Date`                           | OpenBoxes names, nested objects, `undefined` |

- Alternative: `request` returns the reshaped result too. Rejected: then `request` would not "replicate 100%" the OpenBoxes endpoint, and 2 methods would return the same thing.

### 3. Lowercase methods, as in d2-api

`method: "get"`, with the same `Method` type as `requestUntyped` and `HttpRequest`. d2-api uses lowercase methods too (`"get" | "post" | "put" | "delete"`, and `"PATCH"` only for a `fetch` quirk that ob-api already handles inside its HTTP client). So the typed `request` passes the method through, without a conversion.

- Alternative: uppercase (`"GET"`), as in the meeting sketch and the Grails mappings. Rejected: 2 spellings of the same method in one client, and a conversion step.

### 4. `requestUntyped` is the old `request`

The rename keeps all its options (`skipApiPrefix`, `responseDataType`, `headers`). `get`, `post`, `put`, `patch` and `delete` call it. The 3 calls outside the JSON API call it too.

### 5. One endpoint, 2 resource methods for receipts

`savePending` and `complete` both use `POST /partialReceiving/{shipmentId}`. Its codec in the map accepts both answers (`oneOf` of the receipt and `{ data: {} }`). Each method narrows the result. This is the "very simple logic" that the meeting allowed: it chooses the `receiptStatus` and the type of the answer, and sends 1 request.

### 6. Explicit mappers, with a small shared helper

Each resource keeps its explicit mapper, as today. A shared helper builds an optional nested reference from dotted keys: `toRef(id, name)` returns `undefined` when `id` is `null`, else `{ id, name: name ?? undefined }`. It replaces the same code in the receipt item (`binLocation`, `container`, `recipient`). Before adding it, search `src/utils/` for an existing helper.

- Alternative: a generic `unflatten` with a template literal type. Rejected: the type is hard to read, and it gives `null` handling no place.

### 7. The list envelope stays `{ objects, total }`

This is the d2-api name, and unwrapping `{ data }` is mechanical. The typed `request` still returns `{ data, totalCount }`.

### 8. Typed search operators

`POST /generic/{resource}/search` accepts only `eq` (the default), `like` and `ilike` (`GenericApiService.buildCriterion`, v0.9.9). Any other operator, or an empty `value`, makes OpenBoxes fail. So `operator` is the union `"eq" | "like" | "ilike"`, and the type rejects other values.

### 9. Type tests with `@ts-expect-error`

The compile-time requirements (unknown path, wrong method, wrong param) are tested in a spec file with `// @ts-expect-error` lines. `yarn typecheck` (part of `yarn check`) fails when such a line has no error. No new dependency.

## Data flow

```
caller
  → api.partialReceipts.savePending(shipmentId, input)          resource layer: input → OpenBoxes body (Date → string, null for clear)
    → api.request({ method: "post", path: "/partialReceiving/{shipmentId}", pathParams, data })
        endpoint map: build the URL, pick the codec
      → api.requestUntyped({ method: "post", url, data })
        → session.send → HttpClientRepository (fetch)            session: lazy login, 401 retry, cancel
      ← response body
    ← codec check (HttpError on mismatch) → OpenBoxes body type
  ← mapper: dotted keys → nested, null → undefined → OBPartialReceipt
```

## Risks / Trade-offs

- [The types of the map are complex, and editor errors can be hard to read] → Keep the map flat (about 11 keys), and add a type test with a readable error for an unknown path.
- [The OpenBoxes body types become public through `request`] → Export them only through 2 helper types, `OBEndpointKey` and `OBEndpointResponse<K>`, not one name for each wire type.
- [The resource inputs are longer to write than before, for example `product: { id }` instead of `productId`] → Accepted: the meeting chose the OpenBoxes shape. The SDK layer can offer short forms later.
- [A reshaping mistake breaks a live call that works today] → Re-run the live read script and the write checks on the test server (shipment `064BDC` is unused).

## Migration Plan

1. Implement on `feature/typed-endpoints`, in the order of tasks.md.
2. Run `yarn check`, then the live checks.
3. Rollback: revert the commits. Nothing is published, and no data migrates.

## Open Questions

- Does `GET /products/availableItems` accept a request with no `product.id`? Check on the test server. The answer changes only a test.
