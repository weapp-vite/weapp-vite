---
"weapp-vite": patch
---

为 `weapp-vite/runtime` 新增原生 layout 宿主访问 API：`registerLayoutHosts`、`unregisterLayoutHosts`、`resolveLayoutHost` 与 `waitForLayoutHost`。原生页面现在可以直接调用 layout 内注册的 toast、message 等共享反馈节点，不需要在业务页面里手写 layout 组件注册表。
