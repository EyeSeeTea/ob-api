# Project context — ob-api

This file is the project OVERVIEW and CONVENTIONS, written for the people who work on the project; AI agents read it too, as the source of the project's facts. How the AI protocol applies to the project lives in [`.est_ai/project.md`](./.est_ai/project.md). It is distinct from the behavioral capability specs under `openspec/specs/`. For setup/usage details see [`README.md`](./README.md).

## What it is

`ob-api` (`@eyeseetea/ob-api`) is a TypeScript library to call the [OpenBoxes](https://openboxes.com/) REST API. It follows the shape of [d2-api](https://github.com/EyeSeeTea/d2-api): the first version is a generic client (`get`, `post`, `put`, `patch`, `delete` on any endpoint), like `D2ApiGeneric`. Typed endpoints (for example `api.products.get(...)`) come later, on top of the generic client.

## Tech stack

- **Language**: TypeScript 6.0 (`tsconfig.json`)
- **Framework(s)**: none
- **External APIs / clients**: OpenBoxes REST API
- **Tests**: Vitest 5 (`vite.config.mts`)
- **Build**: `tsc` (`tsconfig.build.json`), output in `build/`, published from `build/`
- **Lint/format**: ESLint 10 with typescript-eslint (`eslint.config.mjs`), Prettier 3 (`.prettierrc.js`)
- **Runtime**: the library runs in Node (scripts) and in the browser (apps). Development uses Node 22 (`.nvmrc`, `nvm use`) and Yarn 4 through Corepack (`packageManager` in `package.json`)

## First-time setup (each developer)

After cloning, every developer runs these once — none of it is committed:

1. **Node and Yarn**: `nvm use`, then `corepack enable`.
2. **Local Claude Code settings**: `cp .claude/settings.local.json.template .claude/settings.local.json`
3. **References** for the AI agents: this project declares no reference (see [`.est_ai/project.md`](./.est_ai/project.md)), so the agents work from the rules alone.

## Canonical commands

| Task    | Command         |
| ------- | --------------- |
| Install | `yarn install`  |
| Build   | `yarn build`    |
| Test    | `yarn test`     |
| Lint    | `yarn lint`     |
| Format  | `yarn prettify` |
| Check   | `yarn check`    |
| Release | `yarn release`  |

`yarn build` runs `yarn check` first. `yarn release` builds, publishes `build/` to npm (with the `beta` tag when the version contains `beta`), and pushes a `v<version>` git tag.

## Architecture

The layout is copied from d2-api so the two libraries stay alike:

```
src/
  api/            The public client (OBApi) and the session (login, retry on 401)
  repositories/   Interfaces and types: HttpClientRepository, HttpError, CancelableResponse
  data/           Implementations: FetchHttpClientRepository (keeps the session cookie in Node)
  utils/          Shared utilities: URL and query string building, Set-Cookie parsing
  __tests__/      Test helpers shared by the specs (fetch stub); not built
  index.ts        Public exports
```

The client depends on the `HttpClientRepository` interface, not on a specific HTTP library. A request goes `OBApi` (adds `apiPath`, unless the request sets `skipApiPrefix`) → session (logs in when necessary, retries once on `401`) → `HttpClientRepository` (adds `baseUrl`, sends with `fetch`). Requests return a `CancelableResponse`, the same type that d2-api returns, so apps can wrap both libraries the same way.

The library must run in Node and in the browser. It uses one `fetch` backend, because `fetch` works in both, as in d2-api. OpenBoxes keeps the login session in a cookie. In Node, the client keeps the cookie from the login response and sends it with each request. In the browser, the browser keeps the cookie (`credentials: "include"`).

Browser use depends on the server setup: the browser sends the cookie only when the app and OpenBoxes share a domain, or when OpenBoxes allows cross-domain requests with cookies. Settle this when a browser project starts.

`CancelableResponse` and `HttpClientRepository` are copied from d2-api. A shared package for both libraries may replace the copies later.

## Code conventions

Project rules checked in reviews (extra restrictions, or exceptions to the shared EyeSeeTea rules) live in [`.est_ai/rules/project/`](./.est_ai/rules/project/README.md).

- New code goes in the correct layer per the architecture above.
- Keep the public API close to d2-api's `D2ApiGeneric` (method names and argument order), so code moves easily between the two libraries.
- Export everything public from `src/index.ts`.

## Verification

Before considering a change done, run the project's checks:

- **All checks** (`yarn check`) — runs every check below, so none is skipped.
- Typecheck (`yarn typecheck`)
- Lint (`yarn lint`)
- Format (`yarn prettify-check`)
- Tests (`yarn test`)
- Update `README.md` with any new user-facing behavior and an example.

## Testing strategy

- Tests are `*.spec.ts` files in `__tests__/` folders next to the code they test. The build excludes them.
- Unit tests do not call a real OpenBoxes server: mock the HTTP layer.
- Add or adjust tests whenever behavior changes.

## Git workflow

- Format (`yarn prettify`) before committing.
- Branch from `development` (unless the work depends on an unmerged branch); merge back to the same branch you started from.
- Branch naming: `feature/<name>` for features, `fix/<name>` for bugs, `refactor/<name>` for refactors.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/).
