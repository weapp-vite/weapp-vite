---
'@weapp-core/schematics': patch
'@weapp-vite/dashboard': patch
'@weapp-vite/mcp': patch
'weapp-ide-cli': patch
---

基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
默认 catalog 变更键：tailwind-merge, weapp-tailwindcss, zod。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。
