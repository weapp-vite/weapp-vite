# Publishing (VSCode Marketplace)

This extension now supports automatic version bumping and automatic Marketplace publishing from GitHub Actions.

## 1) Set publisher id

Edit `extensions/vscode/package.json`:

- Ensure `"publisher"` is set to your Marketplace publisher id (this repo uses `weapp-vite`).

## 2) Create a publisher + PAT

- Create a publisher at https://marketplace.visualstudio.com/
- Create an Azure DevOps Personal Access Token (PAT) with Marketplace publish permissions.

## 3) Automatic publish on `main`

After the required secrets are configured:

- pushes merged into `main` that contain releasable `extensions/vscode` runtime or manifest changes will trigger `.github/workflows/release-vscode-extension.yml`
- the workflow reads Conventional Commit messages in the current push range and bumps:
  - `major`: commit subject contains `!` or body contains `BREAKING CHANGE:`
  - `minor`: at least one `feat(...)` commit
  - `patch`: any other releasable extension change
- the workflow updates `extensions/vscode/package.json` and `extensions/vscode/CHANGELOG.md`
- it then runs `pnpm --dir extensions/vscode run publish:vsce`
- if publish succeeds, it commits the new version metadata back to `main` and creates a git tag like `vscode-extension-v0.1.0`

Required repository secret:

- `VSCE_PAT`: Azure DevOps Marketplace publish token

## 4) Manual package and publish

From repo root:

```bash
cd extensions/vscode

# run local checks first
pnpm run check:publish

# inspect the next auto-release version without writing files
pnpm run release:plan

# write the next version + changelog locally
pnpm run release:apply

# compile TypeScript to dist/
pnpm run build

# build a local VSIX artifact
pnpm run package:dry-run

# package a .vsix for local verification
npx @vscode/vsce package

# login and publish
npx @vscode/vsce login weapp-vite
npx @vscode/vsce publish
```

For scripted local publish:

```bash
VSCE_PAT=your_token pnpm run publish:vsce
```

Notes:

- `pnpm run build` uses `tsdown` to bundle the TypeScript extension runtime into `dist/extension.js`.
- `pnpm run test` runs the TypeScript unit tests through Vitest.
- `pnpm run smoke:dist` loads the compiled `dist/extension.js` and verifies extension activation with a mocked VS Code host.
- `pnpm run check:vsix` packages a local `.vsix` and validates the final file list inside the archive.
- `check:publish` already includes `lint`, `test`, and package validation, so it is the safest pre-release gate.
- `release:plan` computes the next release bump and writes GitHub Actions outputs when running in CI.
- `release:apply` updates `package.json` and consumes the `## Unreleased` changelog entries as the next release body.

## Recommended CI Gate

At minimum, CI should run:

```bash
pnpm --dir extensions/vscode run check:publish
```

To also validate real packaging in CI or local dry-run:

```bash
pnpm --dir extensions/vscode run package:dry-run
```

This repository also includes dedicated workflows:

- `.github/workflows/ci-vscode-extension.yml`
- `.github/workflows/release-vscode-extension.yml`
