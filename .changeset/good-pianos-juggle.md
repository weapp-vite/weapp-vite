---
"wevu": patch
"create-weapp-vite": patch
---

`wevu/router` 新增 `router.isReady()`，用于对齐 Vue Router 的可等待启动语义。在当前小程序运行时中该 Promise 会立即 resolve，便于统一业务层调用模式（例如在初始化流程中统一 `await router.isReady()`）。
