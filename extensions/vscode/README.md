# weapp-vite: Practical VS Code Support

This VSCode extension adds:

- syntax highlighting for weapp-vite `<json>` blocks in `.vue` files
- a status bar entry for detected weapp-vite workspaces
- common workspace commands for `dev` / `build` / `generate` / `open` / `info`
- snippets for `<json>` blocks and `defineConfig`
- code actions for `package.json`, `vite.config.*`, and `.vue`
- light package.json diagnostics for missing common scripts
- hover, contextual completion, and doc shortcuts inside key weapp-vite files
- user settings for status bar, diagnostics, hover, completion, and CLI alias style
- an output channel with recent command execution logs

## Install (from this repo)

1. VSCode Command Palette → `Developer: Install Extension from Location...`
2. Select: `extensions/vscode`
3. Reload window

## Verify

In a `.vue` file, run `Developer: Inspect Editor Tokens and Scopes` inside a `<json>` block.

- Expected `textmate scopes` includes `source.json.comments` (for `<json>` / `lang="json"` / `lang="jsonc"` / `lang="json5"`).

## Project Detection

The extension treats a workspace as a weapp-vite project when it sees one or more of these signals:

- `package.json` dependencies containing `weapp-vite` or `create-weapp-vite`
- `package.json` scripts that call `wv` or `weapp-vite`
- a local `vite.config.*` that references `weapp-vite`
- `src/app.json` or `app.json` as supplemental project context

If detection succeeds, a `weapp-vite` status bar button appears.

## Commands

Open the Command Palette and run:

- `weapp-vite: Run Action`
- `weapp-vite: Dev`
- `weapp-vite: Build`
- `weapp-vite: Generate`
- `weapp-vite: Open DevTools`
- `weapp-vite: Doctor / Info`
- `weapp-vite: Show Project Info`
- `weapp-vite: Show Output`
- `weapp-vite: Open Docs`

The extension resolves each command in this order:

1. prefer matching `package.json` scripts such as `dev`, `build`, `open`, `generate`, `g`, `doctor`, `info`
2. fall back to `wv <command>`

The terminal working directory is the active editor's workspace folder when possible, otherwise the first opened workspace folder.

## Snippets

- `wv-json`: insert a `<json lang="jsonc">...</json>` custom block
- `wv-config`: insert a `defineConfig` skeleton
- `wv-scripts`: insert common `package.json` scripts for weapp-vite

## Editor Actions

The extension also adds practical editor actions:

- in `.vue`, use code actions or completion to insert a `weapp-vite` `<json>` block
- in `vite.config.*`, use `weapp-vite: Insert defineConfig Template`
- in `package.json`, use `weapp-vite: Insert Common Scripts`
- when a `package.json` already looks like a weapp-vite project but misses common scripts, the editor shows an informational diagnostic
- hover over common script entries, `defineConfig`, `generate`, or `<json>` blocks to see lightweight guidance
- in `package.json`, completion suggests common script keys and `wv` command values
- in `vite.config.*`, completion suggests `defineConfig`, `generate`, and `plugins` skeletons

## Settings

The extension exposes a small set of practical settings:

- `weapp-vite.showStatusBar`
- `weapp-vite.enablePackageJsonDiagnostics`
- `weapp-vite.enableHover`
- `weapp-vite.enableCompletion`
- `weapp-vite.preferWvAlias`

If you prefer explicit CLI names over aliases, disable `weapp-vite.preferWvAlias` and the extension will generate `weapp-vite dev` style commands instead of `wv dev`.

## Packaging

The extension manifest now includes:

- a publish-safe `files` whitelist
- `.vscodeignore` exclusions for tests and publishing-only docs
- local `lint`, `test`, and `check` scripts
- a `check:publish` script for pre-package verification
- a `check:package` script that validates runtime entry files and package exclusions
- a `package:dry-run` script that builds a local `.vsix` artifact
- a `publish:vsce` script for manual Marketplace publish flow
- a simple walkthrough for first-run onboarding
- command palette visibility rules to reduce irrelevant entries outside matching files or workspaces
- a dedicated GitHub Actions workflow for extension-only CI

## Publish

See `extensions/vscode/PUBLISHING.md`.
