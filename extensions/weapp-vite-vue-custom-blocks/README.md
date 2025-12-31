# weapp-vite: Vue Custom Blocks Highlight (local)

This is a local VSCode extension (TextMate injection grammar) that adds syntax highlighting for weapp-vite `<json>` blocks in `.vue` files.

## Install (from this repo)

1. VSCode Command Palette → `Developer: Install Extension from Location...`
2. Select: `extensions/weapp-vite-vue-custom-blocks`
3. Reload window

## Verify

In a `.vue` file, run `Developer: Inspect Editor Tokens and Scopes` inside a `<json>` block.

- Expected `textmate scopes` includes `source.json.comments` (for `<json>` / `lang="json"` / `lang="jsonc"` / `lang="json5"`).
