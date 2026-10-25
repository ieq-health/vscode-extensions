# AGENTS.md

Guidance for coding agents working in this repository. See `README.md` for the
human-facing overview.

## Layout

npm workspaces monorepo of VS Code extensions published under the
`christianbrassat` Marketplace publisher.

```text
packages/
  bundleq/       extension pack (no code): extensionPack, keybindings, HTML snippets
  contentq/      contentQ: insert content paths (src/extension.ts)
  firmendatenq/  firmendatenQ: insert company data placeholders
  linq/          linQ: register a sitemap, insert/replace links
  smile3d/       smile3d: insert Smile-3D videos
tsconfig.base.json  shared compiler options; each package extends it
```

Each code package is a single `src/extension.ts` compiled to `out/`. Extension
UI strings and content are German.

## Commands

Run from the repository root:

```sh
npm ci                                            # install everything
npm run compile                                   # tsc for all packages
npm run package                                   # build a .vsix per package
npm run package --workspace packages/linq         # one package
```

There are no automated tests. To verify a change, run `npm run package` (it
compiles via `vscode:prepublish`) and, for behaviour changes, open the package
folder in VS Code and use the "Run Extension" launch configuration.

## Conventions

- Toolchain (`typescript`, `@types/vscode`, `@types/node`, `@vscode/vsce`,
  `esbuild`) lives in the root `package.json` only. Do not add devDependencies
  to individual packages.
- `@types/vscode` must not be newer than the lowest `engines.vscode` of any
  package (currently `^1.77.0`). Bump them together.
- Match each file's existing indentation: tabs in contentq, firmendatenq and
  smile3d; two spaces in linq and bundleq `package.json`/sources. There is no
  formatter or linter configured.
- Keep Marketplace identity fields (`publisher`, `name`) unchanged; changing
  them breaks updates for existing installs.
- Commit messages should follow the Conventional Commits spec

## Packaging gotchas

- Packages are built with `vsce package --no-dependencies`. With npm workspaces,
  dependencies are hoisted to the root, and letting vsce collect them pulls the
  whole monorepo into the `.vsix`.
- Therefore any package with runtime `dependencies` must be bundled. linq does
  this with esbuild in its `bundle` script (run by `vscode:prepublish`). Copy
  that pattern if another package gains a runtime dependency.
- `bundleq/package.json` `extensionPack` may only reference extensions that are
  already published on the Marketplace.

## Workflow and releases

- `main` is protected: all changes go through pull requests, and CI
  (`.github/workflows/ci.yml`, one job per package) must pass.
- Each package is versioned independently. To release one, bump `version` in its
  `package.json`, add a `CHANGELOG.md` entry, merge, then push a tag
  `<package>-v<version>` (e.g. `linq-v0.5.15`). `release.yml` verifies the tag
  matches `package.json` and publishes with the `PUBLISHER_TOKEN` secret.
- Before choosing a version, check the Marketplace: some versions were published
  without being committed (contentq 0.0.5, bundleq 1.3.2), so the next version
  must be higher than what is live, not just what is in the repo.
