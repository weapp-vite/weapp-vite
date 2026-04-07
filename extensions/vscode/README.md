# weapp-vite: Vue Custom Blocks Highlight

This VSCode extension adds:

- syntax highlighting for weapp-vite `<json>` blocks in `.vue` files
- a `weapp-vite: Generate` command that runs `weapp-vite generate` in the current workspace terminal

## Install (from this repo)

1. VSCode Command Palette → `Developer: Install Extension from Location...`
2. Select: `extensions/vscode`
3. Reload window

## Verify

In a `.vue` file, run `Developer: Inspect Editor Tokens and Scopes` inside a `<json>` block.

- Expected `textmate scopes` includes `source.json.comments` (for `<json>` / `lang="json"` / `lang="jsonc"` / `lang="json5"`).

## Command

Open the Command Palette and run `weapp-vite: Generate`.

- The command runs `weapp-vite generate` in a VSCode terminal.
- The terminal working directory is the first opened workspace folder.

## Publish

See `extensions/vscode/PUBLISHING.md`.
