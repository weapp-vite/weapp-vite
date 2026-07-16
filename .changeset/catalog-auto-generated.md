---
'@weapp-vite/ast': patch
'@weapp-vite/dashboard': patch
'@weapp-vite/web': patch
'@wevu/compiler': patch
'rolldown-require': patch
'wevu': patch
---

基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
默认 catalog 变更键：@vitejs/plugin-vue, @vue/compiler-core, @vue/compiler-dom, autoprefixer, oxc-parser, rolldown, vite, vue, weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。
