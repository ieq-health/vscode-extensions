# AGENTS.md

Guidance for coding agents working in this repository. See `README.md` for the
human-facing overview.

## Layout

npm workspaces monorepo of VS Code extensions published under the
`christianbrassat` Marketplace publisher. All build configuration is
centralized at the root; packages hold only a manifest, source and user-facing
files.

```text
packages/
  bundleq/       extension pack (no code): extensionPack, keybindings, HTML snippets
  contentq/      contentQ: insert content paths (src/extension.ts)
  firmendatenq/  firmendatenQ: insert company data placeholders
  linq/          linQ: register a sitemap, insert/replace links
  smile3d/       smile3d: insert Smile-3D videos
scripts/build.mjs  the only build tool: manifest checks, tsc, esbuild, vsce
tsconfig.json      single TypeScript config for packages/*/src (noEmit)
.vscodeignore      shared by every .vsix
.vscode/           root launch configs and watch tasks
LICENSE            BSD-2-Clause, copied into each .vsix at package time
```

Each code package is a single `src/extension.ts`, bundled to
`out/extension.js`. Extension UI strings and content are German.

## Commands

Run from the repository root:

```sh
npm ci                         # install everything
npm run check                  # validate manifests + type-check (fast; run this first)
npm run build                  # check + bundle all packages
npm run package                # check + bundle + dist/<name>-<version>.vsix for all
npm run package -- linq        # one or more named packages
```

There are no automated tests. To verify a change, run `npm run package`. For
behaviour changes, use "Run Extension" from the root `.vscode/launch.json`.

## Conventions

- Never add `scripts`, `devDependencies`, `tsconfig.json`, `.vscodeignore`,
  `LICENSE` or `.vscode/` to a package. Put tooling in the root `package.json`
  and behaviour in `scripts/build.mjs`. `npm run check` rejects package
  `scripts`/`devDependencies`.
- Manifests are validated by `validateManifests()` in `scripts/build.mjs`: the
  name equals the directory name, plus fixed `publisher`, `license`,
  `repository`, `main` and `engines.vscode`. If a check fails, fix the
  manifest, not the check, unless the shared setting itself is meant to
  change.
- The VS Code version is set in the root `package.json` `engines.vscode`.
  Packages and root `@types/vscode` must match it, so change all of them
  together.
- `.vscode/launch.json` must list every package (picker input and "Run All
  Extensions"). The check enforces this.
- Match each file's existing indentation: tabs in contentq, firmendatenq,
  smile3d and root files; two spaces in linq and bundleq. There is no formatter
  or linter configured.
- Keep Marketplace identity fields (`publisher`, `name`) unchanged; changing
  them breaks updates for existing installs.
- Commit messages should follow the Conventional Commits spec, using the
  package name as the scope for single-package changes (e.g. `fix(linq): ...`).

## Packaging gotchas

- vsce runs with `dependencies: false`. With npm workspaces, dependencies are
  hoisted to the root, and letting vsce collect them pulls the whole monorepo
  into the `.vsix`. Runtime `dependencies` reach users only because esbuild
  inlines them into `out/extension.js`.
- `bundleq/package.json` `extensionPack` may only reference extensions that are
  already published on the Marketplace.

## Workflow and releases

- `main` is protected: all changes go through pull requests, and the single
  `build` CI job (`.github/workflows/ci.yml`, runs `npm run package`) must pass.
- Each package is versioned independently. To release one, bump `version` in its
  `package.json`, add a `CHANGELOG.md` entry, merge, then push a tag
  `<package>-v<version>` (e.g. `linq-v0.5.15`). `release.yml` runs
  `node scripts/build.mjs release <tag>`, which verifies the tag against
  `package.json` and publishes with the `PUBLISHER_TOKEN` secret.
- Before choosing a version, check the Marketplace: some versions were published
  without being committed (contentq 0.0.5, bundleq 1.3.2), so the next version
  must be higher than what is live, not just what is in the repo.
