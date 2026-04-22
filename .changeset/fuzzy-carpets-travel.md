---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复已本地化到 `miniprogram_npm` 的 copied `miniprogram` / `miniprogram_dist` 依赖在页面产物里仍保留 Node 模式 `__toESM(..., 1)` 的互操作问题。现在会沿着同作用域别名链追踪这些本地 npm 绑定，并统一降级为普通 `__toESM(...)` 包装，避免 `Dialog.confirm is not a function`、`.default.default` 等双层默认导出回归，同时补齐主包与分包 alias 链路的回归覆盖。
