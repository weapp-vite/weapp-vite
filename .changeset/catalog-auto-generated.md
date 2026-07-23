---
'@weapp-vite/ast': patch
'@weapp-vite/ast-native': patch
'@weapp-vite/dashboard': patch
'@weapp-vite/miniprogram-automator': patch
'@weapp-vite/web': patch
'@wevu/compiler': patch
'create-weapp-vite': patch
'weapp-vite': patch
---

基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
默认 catalog 变更键：@vue/language-core, oxc-parser, postcss, rolldown, sass, stylelint, vue-tsc, weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。
同时适配 Monaco Editor 0.56 的 worker 公开入口，恢复 Dashboard 构建。
