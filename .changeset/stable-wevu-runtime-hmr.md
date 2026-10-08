---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 classic 增量构建裁剪未变更 Wevu vendor 后页面运行时导出失效的问题，先同步页面源码中的 require 依赖并为缺失的公开导出保留稳定别名回退，确保 HMR 产物与完整构建保持一致。
