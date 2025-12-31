# weapp-vite: Vue Custom Blocks Highlight

This VSCode extension (TextMate injection grammar) adds syntax highlighting for weapp-vite `<json>` blocks in `.vue` files.

## Install (from this repo)

1. VSCode Command Palette → `Developer: Install Extension from Location...`
2. Select: `extensions/vscode`
3. Reload window

## Verify

In a `.vue` file, run `Developer: Inspect Editor Tokens and Scopes` inside a `<json>` block.

- Expected `textmate scopes` includes `source.json.comments` (for `<json>` / `lang="json"` / `lang="jsonc"` / `lang="json5"`).

## Publish

See `extensions/vscode/PUBLISHING.md`.
