# ieQ health VS Code extensions

Monorepo for the VS Code extensions used for day-to-day content work at ieQ
health. All extensions are published to the Visual Studio Marketplace under the
`christianbrassat` publisher.

| Package                               | Marketplace ID                  | Description                                               |
| ------------------------------------- | ------------------------------- | --------------------------------------------------------- |
| [bundleq](packages/bundleq)           | `christianbrassat.bundleq`      | Extension pack installing everything below plus utilities |
| [contentq](packages/contentq)         | `christianbrassat.contentq`     | InsertContent made easy                                   |
| [firmendatenq](packages/firmendatenq) | `christianbrassat.firmendatenq` | Insert Firmendaten                                        |
| [linq](packages/linq)                 | `christianbrassat.linq`         | Insert links from a registered sitemap                    |
| [smile3d](packages/smile3d)           | `christianbrassat.smile3d`      | Insert Smile-3D videos                                    |

Most users only need to install **bundleQ**, which pulls in everything else.

## Repository layout

All build configuration lives at the root. A package contains only its
manifest, source and user-facing files.

```text
.github/workflows/
  ci.yml           check and package every extension on PRs and pushes to main
  release.yml      publish one extension when a <package>-v<version> tag is pushed
.vscode/           launch configurations and watch tasks for all extensions
packages/
  bundleq/         extension pack (no code): package.json, icon, HTML snippets
  contentq/        package.json, src/extension.ts, README.md, CHANGELOG.md
  firmendatenq/    ...
  linq/            ...
  smile3d/         ...
scripts/build.mjs  the build tool: manifest checks, type-check, bundle, package, release
package.json       npm workspaces root: toolchain, engines.vscode, npm scripts
tsconfig.json      one TypeScript config covering packages/*/src
.vscodeignore      one ignore file for every .vsix
LICENSE            BSD-2-Clause, copied into every .vsix
AGENTS.md          guidance for coding agents
```

## Development

### Prerequisites

- Node.js 22 or newer (CI uses 22) and npm
- VS Code 1.77 or newer

### Setup

```sh
npm ci
```

This installs the shared toolchain (`typescript`, `@types/vscode`,
`@types/node`, `@vscode/vsce`, `esbuild`) and every package's runtime
dependencies into the root `node_modules`.

### Everyday commands

Run from the repository root. Commands that accept package names apply to all
packages when none are given.

```sh
npm run check                     # validate manifests and type-check everything
npm run build                     # check, then bundle every extension
npm run package                   # check, bundle and build dist/<name>-<version>.vsix
npm run package -- linq smile3d   # only these packages
npm run watch                     # rebundle on change
npm run watch:types               # type-check on change
```

`npm run <script>` is shorthand for `node scripts/build.mjs <command>`, which you
can also call directly.

### Running and debugging an extension

Open the **repository root** in VS Code and press F5:

- **Run Extension** asks which extension to load.
- **Run All Extensions** loads all of them, which is closest to having bundleQ
  installed.

Both start the `watch` task first (bundling and type-checking in the
background), so edits are picked up after reloading the Extension Development
Host window (Ctrl+R). Errors from both appear in the Problems panel.

To try a packaged build in your normal VS Code:

```sh
npm run package -- linq
code --install-extension dist/linq-0.5.14.vsix
```

### How extensions are built

`scripts/build.mjs` is the only build tool. Packages have no `scripts`,
`tsconfig.json` or `.vscodeignore` of their own.

1. **Check:** every `packages/*/package.json` is validated against the shared
   settings: `name` matches the directory; `publisher`, `license` and
   `repository` are correct; `engines.vscode` equals the root `engines.vscode`;
   `main` is `./out/extension.js`; and there are no `scripts` or
   `devDependencies`. The root `@types/vscode` must target the same VS Code
   version as `engines.vscode`, and `.vscode/launch.json` must list every
   package. Then `tsc` type-checks all packages using the root `tsconfig.json`.
2. **Bundle:** esbuild bundles each package's `src/extension.ts`, and everything
   it imports except `vscode` (provided by VS Code), into one
   `out/extension.js`.
3. **Package:** vsce builds `dist/<name>-<version>.vsix` with
   `--no-dependencies`, the root `.vscodeignore` and the root `LICENSE`. It also
   rewrites relative links in the package README to point at
   `packages/<name>/` on GitHub.

Published extensions therefore always ship as one bundled file with no
`node_modules`. This is required in a workspace (see
[Adding a dependency](#adding-a-dependency)) and is what VS Code recommends for
load time.

### Testing

There are no automated tests. Before opening a PR, run `npm run package` (CI
does the same and attaches the `.vsix` files to the run as the `vsix`
artifact), and try any behaviour change in the Extension Development Host.

### Adding a dependency

- **Build tooling** goes in the root `package.json`:
  `npm install -D <pkg>` from the repository root.
- **Runtime dependencies** go in the package:
  `npm install <pkg> --workspace packages/<name>`.

npm workspaces hoist all dependencies to the root `node_modules`, so letting
vsce collect them would pull the whole monorepo into the `.vsix`. Instead,
runtime dependencies are inlined by the bundle step. Nothing else is needed
after installing one, but check the `.vsix` size after `npm run package`.

### Changing the minimum VS Code version

Update `engines.vscode` in the root `package.json`, the root `@types/vscode`
version, and `engines.vscode` in every package, all to the same version. The
check step fails until they agree. Raising the minimum is a user-facing change,
so mention it in each package's changelog.

### Adding a new extension

1. Create `packages/<name>/` with a `package.json`, `src/extension.ts`,
   `README.md` and `CHANGELOG.md`. Copying an existing package is the quickest
   start. `npm run check` reports anything the manifest is missing.
2. Add `<name>` to both lists in `.vscode/launch.json`. The check step fails
   until you do.
3. Run `npm install` so the workspace picks up the new package.
4. Publish it once (see [Releasing](#releasing)) before adding it to bundleQ's
   `extensionPack`: the pack can only reference extensions that already exist on
   the Marketplace.

CI and branch protection need no changes. The single `build` job covers every
package.

## Conventions

- **Commit messages and PR titles** follow
  [Conventional Commits](https://www.conventionalcommits.org/). Use the package
  name as the scope when a change is limited to one package:

  ```text
  feat(linq): support relative sitemap URLs
  fix(contentq): restore missing praxis/technik path
  chore(deps): bump esbuild to 0.25.10
  ci: cache npm downloads
  ```

- **Versioning:** every package has its own [semver](https://semver.org/)
  version. A PR that should be released bumps `version` in the package's
  `package.json` and adds an entry to its `CHANGELOG.md`.
- **Centralized build:** all tooling and configuration live at the root. Never
  add `scripts`, `devDependencies`, a `tsconfig.json` or a `.vscodeignore` to a
  package; extend `scripts/build.mjs` or the root files instead. `npm run check`
  enforces this.
- **Formatting:** there is no formatter or linter. Match the indentation of the
  file you edit: tabs in contentq, firmendatenq, smile3d and the root files;
  two spaces in linq and bundleq.
- **Marketplace identity:** never change `publisher` or `name` in a package's
  `package.json`. The Marketplace ID is derived from them, and changing either
  breaks updates for everyone who has the extension installed.
- **Language:** commands, prompts and inserted content are in German. Code,
  comments and commit messages are in English.

## Working on a protected `main`

`main` is protected. Nobody, administrators included, can push to it directly:

- every change lands through a pull request;
- the `build` CI check must pass;
- the PR branch must be up to date with `main` before merging;
- review conversations must be resolved;
- force pushes to and deletion of `main` are blocked.

No approving review is required, so you can merge your own PR once CI is green.
When squash-merging, make sure the squash commit title is a valid Conventional
Commit, as it becomes the commit on `main`.

Release tags are not affected by branch protection (see [Releasing](#releasing)).

### With Git

```sh
git clone git@github.com:ieq-health/vscode-extensions.git
cd vscode-extensions

# Start a change from an up-to-date main
git switch main
git pull --ff-only
git switch -c feat/linq-relative-urls

# ...edit, then commit
git commit -am "feat(linq): support relative sitemap URLs"
git push -u origin feat/linq-relative-urls
gh pr create --fill
```

Keeping the branch up to date when `main` has moved:

```sh
git fetch origin
git rebase origin/main
git push --force-with-lease
```

After the PR is merged:

```sh
git switch main
git pull --ff-only
git branch -d feat/linq-relative-urls
git push origin --delete feat/linq-relative-urls   # if GitHub didn't delete it
```

### With Jujutsu (jj)

jj works well with a protected `main`: you never move the `main` bookmark
yourself, you only push bookmarks for your changes. Use a colocated repository
so Git tooling and `gh` keep working:

```sh
jj git clone --colocate git@github.com:ieq-health/vscode-extensions.git
cd vscode-extensions
```

Start a change on top of the latest remote `main` and describe it up front:

```sh
jj git fetch
jj new main@origin
jj describe -m "feat(linq): support relative sitemap URLs"
# ...edit; the working copy is the change, no staging needed
```

Push it and open a PR. `jj git push -c @` creates a bookmark with a generated
name (`push-<change-id>`). Use a named bookmark if you prefer readable branch
names:

```sh
jj git push -c @                  # generated bookmark name
gh pr create --fill --head push-<change-id>

# or, with a named bookmark
jj bookmark create feat/linq-relative-urls -r @
jj git push --bookmark feat/linq-relative-urls
gh pr create --fill --head feat/linq-relative-urls
```

Addressing review feedback: edit the change in place (it keeps its change ID),
then push again. Bookmarks on rewritten commits move along automatically:

```sh
# edit files in the working copy, or `jj edit <change>` for an earlier one
jj git push                       # pushes bookmarks that changed
```

If you want a fresh commit per round of feedback, `jj commit` after the first
push and keep working in the new change. For a generated bookmark, move it
before pushing with `jj bookmark move push-<change-id> --to @-`.

Keeping the PR up to date when `main` has moved:

```sh
jj git fetch
jj rebase -d main@origin          # rebases the current change and its ancestors not on main
jj git push
```

After the PR is merged:

```sh
jj git fetch                      # picks up the new main and the deleted PR branch
jj new main@origin                # start the next change
jj abandon <old-change>           # only needed after a squash merge, if it is still shown
```

Things to avoid in jj:

- don't `jj bookmark move main` or `jj git push --bookmark main`. The push will
  be rejected anyway, but it leaves your local `main` diverged from
  `main@origin`;
- don't use `git commit`/`git rebase` in a colocated repo for the same
  change you're editing with jj. If you do run Git commands, run `jj status`
  afterwards so jj picks up the changes.

## Releasing

Each extension is released independently by pushing a tag named
`<package>-v<version>` that points at a commit on `main`.

1. **Choose the version.** Check the current Marketplace version first. Some
   versions were published from outside the repository (contentq 0.0.5, bundleq
   1.3.2), so the new version must be higher than what is live, not only what
   is in `package.json`.
2. **Open a PR** that bumps `version` in `packages/<name>/package.json` and adds
   a `CHANGELOG.md` entry, e.g. `chore(linq): release 0.5.15`. Merge it.
3. **Tag the merged commit on `main` and push the tag.**

   With Git:

   ```sh
   git switch main && git pull --ff-only
   git tag linq-v0.5.15
   git push origin linq-v0.5.15
   ```

   With jj:

   ```sh
   jj git fetch
   jj tag set linq-v0.5.15 -r main@origin
   jj git push --tag linq-v0.5.15
   ```

4. The **Release** workflow runs `node scripts/build.mjs release <tag>`, which
   checks that the tag's version matches `packages/<name>/package.json`, runs
   all checks, packages the extension and publishes it. Follow it under the repository's Actions tab. The new version
   usually shows up on the Marketplace within a few minutes.

If the workflow fails before publishing, fix the problem in a PR, then delete
and re-create the tag on the new commit:

```sh
git push origin :refs/tags/linq-v0.5.15 && git tag -d linq-v0.5.15   # Git
jj tag delete linq-v0.5.15 && jj git push --tag linq-v0.5.15          # jj
```

### Publishing credentials

`release.yml` publishes with the repository secret `PUBLISHER_TOKEN`, an Azure
DevOps personal access token with the **Marketplace → Manage** scope for the
`christianbrassat` publisher. See
[Publishing extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token)
for how to create one. These tokens expire. When a release fails with an
authentication error, create a new token and update the secret:

```sh
gh secret set PUBLISHER_TOKEN -R ieq-health/vscode-extensions
```

To publish manually in an emergency, check out the tagged commit and run the
same command as the workflow:

```sh
npm ci
VSCE_PAT=<token> node scripts/build.mjs release linq-v0.5.15
```

### Releasing bundleQ

bundleQ only references other extensions by ID. Changes to the extensions
themselves don't require a bundleQ release. Release it when its own content
changes: the extension list, keybindings or snippets.

## History

This repository combines the former `vscode-contentQ`, `vscode-firmendatenQ`,
`vscode-linQ`, `vscode-smile3d` and `vscode-bundleQ` repositories, which are
now archived. Their full histories are preserved under `packages/<name>/`.
`git log -- packages/<name>` shows a single package's history.
