---
"weapp-vite": patch
"create-weapp-vite": patch
---

进一步优化小程序动态导入构建链路：在预处理阶段同时移除 `vite:build-import-analysis` 与 `native:import-analysis-build`，避免在小程序产物中注入 `__vitePreload` 包装逻辑。动态导入将直接输出为小程序可用的 `Promise.resolve().then(() => require(...))` 形式，减少运行时代码并规避浏览器预加载分支的潜在兼容性噪音。
