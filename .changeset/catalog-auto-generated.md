---
'@weapp-vite/ast-native': patch
'@weapp-vite/web': patch
'rolldown-require': patch
'weapp-ide-cli': patch
'weapp-vite': patch
---

基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, @types/node, happy-dom, rolldown, weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。
