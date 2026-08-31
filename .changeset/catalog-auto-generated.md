---
'@weapp-core/schematics': patch
'@weapp-vite/dashboard': patch
'@weapp-vite/mcp': patch
'@weapp-vite/web': patch
'weapp-ide-cli': patch
---

基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
默认 catalog 变更键：happy-dom, tsx, uview-plus, weapp-tailwindcss, zod。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。
