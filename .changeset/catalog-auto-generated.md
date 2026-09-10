---
'@weapp-core/schematics': patch
'@weapp-vite/ast-native': patch
'@weapp-vite/dashboard': patch
'@weapp-vite/mcp': patch
'@weapp-vite/miniprogram-automator': patch
'@weapp-vite/react': patch
'@weapp-vite/web': patch
'@wevu/compiler': patch
'weapp-ide-cli': patch
'weapp-vite': patch
---

基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
默认 catalog 变更键：@types/node, @types/react, happy-dom, magic-string, obug, react, react-reconciler, weapp-tailwindcss, zod。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。
