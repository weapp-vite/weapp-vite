# AGENTS Guidelines

## CLI Alias

- This project supports both `weapp-vite` and `wv` CLI commands.
- Treat `weapp-vite dev` and `wv dev` as equivalent forms.
- When the dependency is installed, prefer reading local package docs under `node_modules/weapp-vite/dist/docs/` before relying on stale external memory.

## AI Screenshot Workflow

- When an AI agent needs a mini-program screenshot, prefer `weapp-vite screenshot` or `wv screenshot`.
- Do not default to generic browser screenshot tools when the target is the mini-program runtime in WeChat DevTools.
- Prefer writing screenshots to a file path in the workspace, for example `.tmp/acceptance.png`.
- Before screenshot commands that require DevTools, ensure WeChat DevTools is logged in and the service port is enabled.

## AI Debug Workflow

- When terminal log inspection is needed, prefer `weapp-vite ide logs --open` or `wv ide logs --open`.
