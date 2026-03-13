---
'create-weapp-vite': patch
---

修复 `create-weapp-vite` 中 catalog 占位符解析测试对 `miniprogram-api-typings` 版本的硬编码断言，改为跟随生成 catalog 的当前值校验，避免 workspace catalog 升级后出现误报失败。
