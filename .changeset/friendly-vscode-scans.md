---
"@weapp-vite/vscode": patch
---

Reduce VS Code extension scan pressure in non-weapp-vite monorepos by removing broad package.json/Vite config activation and excluding dependency, cache, and generated folders from workspace file scans.
