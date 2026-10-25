# ieQ health VS Code extensions

| Package | Marketplace ID | Description |
|---|---|---|
| [bundleq](packages/bundleq) | `christianbrassat.bundleq` | Extension pack installing everything below plus utilities |
| [contentq](packages/contentq) | `christianbrassat.contentq` | InsertContent made easy |
| [firmendatenq](packages/firmendatenq) | `christianbrassat.firmendatenq` | Insert Firmendaten |
| [linq](packages/linq) | `christianbrassat.linq` | Insert links from a registered sitemap |
| [smile3d](packages/smile3d) | `christianbrassat.smile3d` | Insert Smile-3D videos |

## Development

```sh
npm install
npm run compile          # all packages
npm run package          # build .vsix files for all packages
```

To debug an extension, open its folder (e.g. `packages/linq`) in VS Code and
run "Run Extension".

## Releasing

Each extension is versioned and released independently.

1. Bump `version` in `packages/<name>/package.json` and update its `CHANGELOG.md`.
2. Tag the commit as `<name>-v<version>` and push the tag, e.g. `linq-v0.5.15`.

The release workflow checks that the tag matches the package version and
publishes that package to the Marketplace using the `PUBLISHER_TOKEN` secret.
