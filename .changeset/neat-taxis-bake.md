---
"wevu": patch
"create-weapp-vite": patch
---

优化 Wevu API 文档的公开边界：移除 API 页面中不应面向业务侧展示的内部接口，并在运行时源码中为内部能力补充 `@internal` 标注；同时将 `provideGlobal` / `injectGlobal` 标记为 `@deprecated`（保留导出用于兼容过渡），统一文档与实际导出语义，降低误用内部能力的风险。
