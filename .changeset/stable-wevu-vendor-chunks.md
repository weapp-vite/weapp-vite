---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复小程序构建透传上游 `dist` 内部 hash chunk 名的问题。`wevu/dist/src-*.mjs`、`store-*.mjs` 一类内部产物现在会被改写为稳定的 `weapp-vendors/*` 文件名，避免微信开发者工具在 `dev` / 重开场景中出现 `module is not defined` 的漂移模块报错。
