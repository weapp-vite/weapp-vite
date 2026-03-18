---
"create-weapp-vite": patch
"@weapp-vite/web": patch
---

同步升级 workspace catalog 中的 `tdesign-miniprogram` 到 `1.13.0`，并刷新 `create-weapp-vite` 生成 catalog 产物，使脚手架模板解析 `catalog:` 与命名 catalog 时能拿到当前仓库内的一致版本。对应的 `createProject` 单测也改为基于生成 catalog 做断言，避免后续 catalog 升级时因为硬编码版本号而重复误报失败。

同时将 `@weapp-vite/web` 中的 `domhandler` 依赖提升到 `^6.0.1`，与当前相关解析栈版本保持一致。
