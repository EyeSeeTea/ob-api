# ob-api

TypeScript library to call the [OpenBoxes](https://openboxes.com/) REST API.

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
