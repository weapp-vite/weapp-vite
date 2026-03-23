---
'weapp-vite': patch
'create-weapp-vite': patch
---

将 `weapp-vite` 构建输出清理逻辑中的 `rimraf` 替换为 Node 原生 `fs/promises` 实现。现在输出目录和外部插件产物目录的清理统一使用 `readdir` + `rm`，保留原有的 `miniprogram_npm` 目录保护与外部插件产物整理语义，同时移除 `rimraf` 的直接依赖并更新相关测试。
