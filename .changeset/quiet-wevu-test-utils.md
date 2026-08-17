---
"@wevu/test-utils": minor
'wevu': patch
'create-weapp-vite': patch
---

扩展 `@wevu/test-utils`，新增 `wevuSfc()` Vitest 入口和 `mountComponent()`，可以直接导入真实 Vue SFC 并在不构建 WXML 的情况下测试 setup、props、data、computed、methods、watch、emits、provide/inject、响应式状态和生命周期。保留 `mountComposable` 兼容入口，并继续由 `@mpcore/test` 负责完整编译产物、WXML 查询和宿主交互。同步补充 Wevu 的不注册组件定义运行时入口，避免轻量测试污染小程序全局注册状态。
