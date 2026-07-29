---
'@weapp-vite/ast-native': patch
'@weapp-vite/dashboard': patch
'@wevu/api': patch
---

基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
默认 catalog 变更键：@types/node, miniprogram-api-typings, oxc-parser, postcss, tailwind-variants, weapp-tailwindcss。命名 catalog 变更键：latest(miniprogram-api-typings)；weapp-tailwindcss-fixed(weapp-tailwindcss)。
