# Changelog

## 0.0.1

- Initial release: highlight `.vue` `<json>` blocks as JSONC by default.

## Unreleased

- Add workspace detection, status bar entry, output channel, and a unified action picker.
- Add practical commands for `dev`, `build`, `generate`, `open`, and `doctor/info`.
- Add snippets for `<json>` blocks and `defineConfig`.
- Add editor code actions, Vue completion for `<json>` custom blocks, and package.json script diagnostics.
- Add lightweight hover help, contextual completions, and docs shortcuts for package.json, vite.config, and Vue custom blocks.
- Add extension settings for status bar, diagnostics, hover, completion, and preferred CLI alias style.
- Add pure logic tests for script suggestion and command resolution behavior.
- Add manifest validation tests, publish-safe packaging files, command palette visibility rules, and a getting-started walkthrough.
- Exclude test files from VSIX packaging and add pre-publish package checks.
- Add a dedicated package verification script for local CI and release gating.
- Add a dedicated GitHub Actions workflow for extension-only CI checks.
- Add a reusable VSIX dry-run packaging script for local and CI validation.
- Add a manual release workflow and publish script for VS Code Marketplace delivery.
