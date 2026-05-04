---
'weapp-vite': patch
'wevu': patch
'create-weapp-vite': patch
---

为 `wevu` 增加通用的 `useAsyncPullDownRefresh()` 与 `useChangeModel()`，将模板和示例中重复的下拉刷新停止逻辑、TDesign `change` 表单绑定垫片收敛到运行时核心能力，减少业务模板需要维护的宿主胶水代码。同时为 `weapp-vite prepare` 增加平台参数，让多平台项目可以生成带平台上下文的 `.weapp-vite` 类型支持文件。
