---
"weapp-vite": patch
"create-weapp-vite": patch
---

减少 bundle finalize 阶段对无 `require()` chunk 的重复扫描：同步 chunk imports 与移除隐式页面预加载时会先跳过不相关代码，并避免在没有新增依赖时重建 imports 数组，从而降低 HMR 与构建收尾阶段的无效遍历成本。
