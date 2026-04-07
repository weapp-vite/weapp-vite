# Publishing (VSCode Marketplace)

This extension is ready for Marketplace publishing, but you must set a real publisher id first.

## 1) Set publisher id

Edit `extensions/vscode/package.json`:

- Ensure `"publisher"` is set to your Marketplace publisher id (this repo uses `weapp-vite`).

## 2) Create a publisher + PAT

- Create a publisher at https://marketplace.visualstudio.com/
- Create an Azure DevOps Personal Access Token (PAT) with Marketplace publish permissions.

## 3) Package and publish

From repo root:

```bash
cd extensions/vscode

# run local checks first
pnpm run check:publish

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
- `check:publish` already includes `lint`, `test`, and package validation, so it is the safest pre-release gate.

## Recommended CI Gate

At minimum, CI should run:

```bash
pnpm --dir extensions/vscode run check:publish
```

To also validate real packaging in CI or local dry-run:

```bash
pnpm --dir extensions/vscode run package:dry-run
```

This repository also includes a dedicated workflow:

- `.github/workflows/ci-vscode-extension.yml`
- `.github/workflows/release-vscode-extension.yml`
