# Proposal

## Why

With the generic client (v1), each app writes the URL, the parameter names and the response type of each OpenBoxes call, and nothing checks the response at runtime. A wrong field shows only when the app uses it.

A real example, found while planning this change: UNICEF-TJK-scripts reads `item["product.id"]` from `GET /products/availableItems`. OpenBoxes never sends that key (it sends `product: { id, … }`), so every item gets `productId: undefined`. A typed endpoint makes this a compile error, and a checked response makes it a clear runtime error.

This is the first slice of typed endpoints. The exploration and decisions are in `.local/typed-endpoints-exploration.md` (scope, naming, `purify-ts`, OpenBoxes versions).

## Goals

- Typed methods for the product and location endpoints that UNICEF-TJK-scripts uses: `api.products.list()`, `api.products.availableItems()`, `api.locations.list()`.
- Typed parameters, so a wrong parameter name is a compile error.
- Checked responses: a response with a missing or wrong field rejects with a clear error.
- Plain result types that apps can use without a validation library.

## Non-goals

- Stock movements, partial receiving, the generic domain API (`/generic/*`), documents. They follow in later changes.
- Types per OpenBoxes version (option B). Considered later, in the SDK part.
- App entities. The types describe OpenBoxes data; apps still map them to their own entities.
- Changes to the generic client: `api.get()` and the other methods stay as they are.

## What Changes

- New `api.products`:
    - `list({ max?, offset?, q? })` → `{ objects, total }`
    - `availableItems({ locationId, productIds })` → `{ objects }`: one request per 50 products, results joined in order
- New `api.locations`:
    - `list({ locationTypeCode? })` → `{ objects }`
- Each result is checked at runtime. The result types use `undefined` for absent values (OpenBoxes sends `null`), and camelCase names for dotted keys (`"inventoryItem.id"` → `inventoryItemId`).
- An unexpected response rejects with an `HttpError` that keeps the response, as an invalid JSON body already does.
- New dependency: `purify-ts`. ob-api uses it internally; the public types do not expose it.
- README: a "Typed endpoints" section.

## User impact

Apps can replace hand-written calls:

```ts
// before
const res = await api
    .get<{ data: OBProductResponseData[]; totalCount: number }>("/products")
    .getData();

// after
const { objects, total } = await api.products.list({ max: 50 }).getData();
```

## Compatibility

Additions only. Existing calls keep their behavior. Public interface, old vs new:

|                 | Old  | New                                                                                                                      |
| --------------- | ---- | ------------------------------------------------------------------------------------------------------------------------ |
| `api.products`  | none | `list()`, `availableItems()`                                                                                             |
| `api.locations` | none | `list()`                                                                                                                 |
| Exports         | —    | `OBProduct`, `OBLocation`, `OBAvailableItem`, `OBAvailableItemStatus`, `Paginated`, `ListResult` and the parameter types |

## Rollback plan

Remove `api.products` and `api.locations`. No app uses them yet, and the generic client does not change.

## Capabilities

### New Capabilities

- `api-products`: typed product list and product availability, with checked responses.
- `api-locations`: typed location list, with checked responses.

### Modified Capabilities

- `api-client`: an unexpected response from a typed endpoint rejects with an HTTP error.

## Impact

- Code: new files under `src/api/` (products, locations, response checks), `src/api/OBApi.ts` (the two properties), `src/index.ts` (exports).
- Dependency: `purify-ts` (runtime, 1 dependency, Node and browser).
- Docs: `README.md`, `DEVELOPMENT.md` (layout).
- Verified on the UNICEF OpenBoxes server (`0.9.7-SNAPSHOT`) with GET requests only.
