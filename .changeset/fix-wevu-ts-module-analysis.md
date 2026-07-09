---
"@wevu/compiler": patch
---

修复 Wevu 页面能力外部模块分析对普通 TypeScript 文件的解析策略。现在 `.ts` / `.mts` / `.cts` 模块不会启用 JSX parser，避免包含泛型箭头函数的 `wevu` 源码在开发构建或 HMR 中被误判为 JSX 并导致 Vue 页面编译失败。
