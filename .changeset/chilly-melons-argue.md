---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复了 dev 模式下新增 SFC 组件可能无法被自动引入及时识别的问题，并补充自动引入与热更新的多平台集成测试覆盖（weapp、alipay、tt），确保页面首次引用新增组件时 `usingComponents` 能稳定更新。与此同时在 CI 中新增对应的平台矩阵任务，持续防止该类回归。
