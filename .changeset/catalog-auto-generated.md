---
'@weapp-vite/dashboard': patch
'@weapp-vite/web': patch
'rolldown-require': patch
---

基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
默认 catalog 变更键：@babel/parser, @babel/traverse, @babel/types, @icebreakers/eslint-config, @icebreakers/stylelint-config, @types/node, @vue/language-core, lru-cache, oxc-parser, rolldown, tdesign-miniprogram, vite, vue-tsc, weapp-tailwindcss。命名 catalog 变更键：tdesign-miniprogram-fixed(tdesign-miniprogram)；weapp-tailwindcss-fixed(weapp-tailwindcss)。
