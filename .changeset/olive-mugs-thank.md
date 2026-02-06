---
"weapp-vite": patch
"create-weapp-vite": patch
---

feat: 支持支付宝平台 npm 目录策略切换，并默认使用 `node_modules`。

- 新增 `weapp.npm.alipayNpmMode` 配置，支持 `node_modules` 与 `miniprogram_npm` 两种模式。
- 默认策略切换为 `node_modules`，更贴近支付宝小程序 npm 管理语义。
- 统一支付宝平台 `usingComponents` 与 JS `require` 的 npm 引用改写逻辑，确保与目录策略一致。
- npm 构建与输出清理流程按策略保留对应目录，避免缓存与产物目录错配。
