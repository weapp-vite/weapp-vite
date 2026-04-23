---
'@weapp-vite/dashboard': patch
'@wevu/api': patch
'rolldown-require': patch
'wevu': patch
---

基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
默认 catalog 变更键：@vue/compiler-core, @vue/compiler-dom, miniprogram-api-typings, rolldown, vite, vue。命名 catalog 变更键：latest(miniprogram-api-typings)。
