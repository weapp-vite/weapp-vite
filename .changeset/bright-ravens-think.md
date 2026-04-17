---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复本地分包按依赖列表复制 `miniprogram_npm` 产物时遗漏 copied `miniprogram` 包传递依赖的问题。像 `miniprogram-computed` 这类通过 build-npm 复制的 CJS 小程序包，声明在分包后会继续把 `rfdc`、`fast-deep-equal` 等运行时依赖一并带入分包产物，避免真实 DevTools 运行时报模块缺失。
