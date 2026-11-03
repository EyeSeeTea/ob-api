# ob-api

TypeScript library to call the [OpenBoxes](https://openboxes.com/) REST API. It runs in Node and in the browser.

## Usage

```ts
import { OBApi } from "@eyeseetea/ob-api";

const api = new OBApi({
    baseUrl: "https://ob.example.org",
    auth: { username: process.env.OB_USERNAME ?? "", password: process.env.OB_PASSWORD ?? "" },
    locationId: "8a8a9e9665c4f59d0165c54ec6b10027", // optional
    timeout: 30_000, // optional, in milliseconds
});

const products = await api.get<{ data: Product[] }>("/products", { max: 10 }).getData();
```

The methods have the same argument order as d2-api: `params` is always the second argument.

| Method                       | Request                                                        |
| ---------------------------- | -------------------------------------------------------------- |
| `get(url, params?)`          | `GET`                                                          |
| `post(url, params?, data?)`  | `POST` with a JSON body                                        |
| `put(url, params?, data?)`   | `PUT` with a JSON body                                         |
| `patch(url, params?, data?)` | `PATCH` with a JSON Patch body (`application/json-patch+json`) |
| `delete(url, params?)`       | `DELETE`                                                       |

Each method returns a `CancelableResponse`. Call `getData()` for the body, `response()` for the status, headers and body, or `cancel()` to stop the request.

The client returns the body as OpenBoxes sends it. It does not remove the `{ data }` wrapper.

### URLs

Request URLs are relative to `<baseUrl>/<apiPath>`. `apiPath` is `openboxes/api` by default. `api.get("/products")` requests `https://ob.example.org/openboxes/api/products`. Set `apiPath` when OpenBoxes uses a different path.

A URL can already have a query string. The client adds `params` to it: `api.get("/products/1/availableItems?location.id=2", { max: 5 })` requests `…/availableItems?location.id=2&max=5`.

### Session

You do not log in yourself. The first request logs in to `<apiPath>/login` and the client keeps the session:

- In Node, the client keeps the session cookie and sends it with each request.
- In the browser, the browser keeps the cookie. The app and OpenBoxes must share a domain, or OpenBoxes must allow cross-domain requests with cookies.
- When a request gets status `401` (the session expired), the client logs in again and sends the request one more time.

To change the location, or to refresh the session, call `login`:

```ts
await api.login("8a8a9e9665c4f59d0165c54ec6b10028"); // later logins also use this location
```

### Errors and cancellation

A failed request rejects with an `HttpError`. It holds the `request` and, when the server responded, the `response` (`status`, `headers`, `data`). A timeout, and a response body that claims to be JSON but does not parse, also reject with an `HttpError`. For an invalid JSON body, `response.data` holds the body as text.

A canceled request rejects with an error that `isCancel` accepts. `cancel(message)` sets the message of that error.

```ts
import { HttpError, isCancel } from "@eyeseetea/ob-api";

async function getProducts(): Promise<unknown> {
    try {
        return await api.get("/products").getData();
    } catch (error) {
        if (isCancel(error)) return undefined;
        if (error instanceof HttpError) console.error(error.response?.status, error.response?.data);
        throw error;
    }
}
```

## Setup

```bash
nvm use
corepack enable
yarn install
```

## Development

| Task                                        | Command         |
| ------------------------------------------- | --------------- |
| Run all checks (types, lint, format, tests) | `yarn check`    |
| Run tests                                   | `yarn test`     |
| Format code                                 | `yarn prettify` |
| Build into `build/`                         | `yarn build`    |

## Release

1. Set `version` in `package.json`. Use a `-beta.N` suffix to publish with the `beta` tag.
2. Run `yarn release`. It builds, publishes `build/` to npm, and pushes a `v<version>` git tag.

See [DEVELOPMENT.md](DEVELOPMENT.md) for the architecture and the conventions.
