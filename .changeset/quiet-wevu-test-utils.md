---
"@wevu/test-utils": minor
'wevu': patch
'create-weapp-vite': patch
---

新增 `@wevu/test-utils`，可以在不构建 WXML 的情况下测试 Wevu Composition API 的响应式状态、依赖注入、生命周期和事件，并提供 `mountComposable` wrapper。同步补充 Wevu 的测试运行时入口，避免轻量测试污染小程序全局注册状态。
